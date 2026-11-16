/**
 * Freno de fuerza bruta para los logins, guardado en Postgres (compartido por
 * todas las instancias, sobrevive a reinicios y arranques en frío).
 *
 * Cada intento se CUENTA ANTES de verificar la contraseña con un UPSERT
 * atómico: ráfagas en paralelo no pasan todas "antes de registrar el fallo".
 *
 * Tres claves con límites distintos dentro de una ventana de 15 min:
 *   - ip+cuenta (5):  un atacante desde una IP agota rápido sus intentos.
 *   - cuenta   (20):  ataque distribuido contra una cuenta. Más alto para que
 *                     bloquear a un usuario ajeno a propósito sea costoso.
 *   - ip       (50):  barrido de muchas cuentas desde una IP. Alto porque un
 *                     restaurante entero puede compartir la IP del router.
 */
import { inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { intentosLogin } from './schema';

export const VENTANA_MS = 15 * 60_000;

export interface ClaveLimite {
	clave: string;
	max: number;
}

/** Claves del intento de login de `cuenta` desde `ip`. */
export function clavesLogin(ip: string, cuenta: string): ClaveLimite[] {
	return [
		{ clave: `ipcuenta:${ip}|${cuenta}`, max: 5 },
		{ clave: `cuenta:${cuenta}`, max: 20 },
		{ clave: `ip:${ip}`, max: 50 }
	];
}

/**
 * Registra el intento y devuelve los minutos de bloqueo (0 = puede intentar).
 * Si la ventana de una clave venció, su contador vuelve a empezar.
 */
export async function reservarIntento(claves: ClaveLimite[], ahora = new Date()): Promise<number> {
	const ventana = `${VENTANA_MS / 1000} seconds`;
	const filas = await db
		.insert(intentosLogin)
		.values(claves.map((c) => ({ clave: c.clave, fallos: 1, desde: ahora })))
		.onConflictDoUpdate({
			target: intentosLogin.clave,
			set: {
				fallos: sql`CASE WHEN ${intentosLogin.desde} < ${ahora}::timestamptz - ${ventana}::interval THEN 1 ELSE ${intentosLogin.fallos} + 1 END`,
				desde: sql`CASE WHEN ${intentosLogin.desde} < ${ahora}::timestamptz - ${ventana}::interval THEN ${ahora}::timestamptz ELSE ${intentosLogin.desde} END`
			}
		})
		.returning({
			clave: intentosLogin.clave,
			fallos: intentosLogin.fallos,
			desde: intentosLogin.desde
		});

	let restanteMs = 0;
	for (const f of filas) {
		const max = claves.find((c) => c.clave === f.clave)?.max ?? Infinity;
		if (f.fallos > max)
			restanteMs = Math.max(restanteMs, VENTANA_MS - (ahora.getTime() - f.desde.getTime()));
	}

	// Limpieza ocasional de claves vencidas (evita que la tabla crezca sin límite).
	if (Math.random() < 0.02) {
		await db
			.delete(intentosLogin)
			.where(sql`${intentosLogin.desde} < ${ahora}::timestamptz - ${ventana}::interval`);
	}
	return Math.ceil(restanteMs / 60_000);
}

/**
 * Login correcto: se olvidan los intentos de la cuenta. El de la IP solo se
 * descuenta (un acierto no debe "lavar" un barrido de otras cuentas).
 */
export async function intentoExitoso(claves: ClaveLimite[]): Promise<void> {
	const deCuenta = claves.filter((c) => !c.clave.startsWith('ip:')).map((c) => c.clave);
	const deIp = claves.filter((c) => c.clave.startsWith('ip:')).map((c) => c.clave);
	await Promise.all([
		deCuenta.length ? db.delete(intentosLogin).where(inArray(intentosLogin.clave, deCuenta)) : null,
		deIp.length
			? db
					.update(intentosLogin)
					.set({ fallos: sql`greatest(${intentosLogin.fallos} - 1, 0)` })
					.where(inArray(intentosLogin.clave, deIp))
			: null
	]);
}
