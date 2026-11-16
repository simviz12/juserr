/**
 * Utilidades para errores de Postgres (neon-http, node-postgres y PGlite
 * exponen `code` y `constraint`; drizzle a veces los envuelve en `cause`).
 */
interface PgError {
	code?: string;
	constraint?: string;
	message?: string;
	cause?: unknown;
}

function causas(err: unknown): PgError[] {
	const out: PgError[] = [];
	let e: unknown = err;
	for (let i = 0; i < 5 && e && typeof e === 'object'; i++) {
		out.push(e as PgError);
		e = (e as PgError).cause;
	}
	return out;
}

/** ¿El error es una violación de unicidad (23505), opcionalmente de `restriccion`? */
export function esViolacionUnica(err: unknown, restriccion?: string): boolean {
	return causas(err).some(
		(c) =>
			c.code === '23505' &&
			(!restriccion ||
				c.constraint === restriccion ||
				(typeof c.message === 'string' && c.message.includes(restriccion)))
	);
}

/** ¿Algún error de la cadena tiene el código SQLSTATE `codigo`? */
export function esCodigoPg(err: unknown, codigo: string): boolean {
	return causas(err).some((c) => c.code === codigo);
}
