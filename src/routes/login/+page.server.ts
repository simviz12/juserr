import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tenants, usuarios } from '$lib/server/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { createSession, generateSessionToken, SESSION_COOKIE_OPTS } from '$lib/server/auth';
import { clavesLogin, intentoExitoso, reservarIntento } from '$lib/server/login-throttle';
import type { Actions, PageServerLoad } from './$types';

/** Cookie (no sensible) que recuerda el código del restaurante en este dispositivo. */
const COOKIE_CODIGO = 'restaurante';
const UN_ANIO = 60 * 60 * 24 * 365;
/** argon2 sobre entradas enormes es caro: se corta antes de verificar. */
const MAX_PASSWORD = 256;
const CREDENCIALES_INVALIDAS = 'Código de restaurante, usuario o contraseña incorrectos.';

// Hash señuelo: si el restaurante o el usuario no existen se verifica igual una
// contraseña, para que el tiempo de respuesta no revele qué datos eran válidos.
let senuelo: Promise<string> | null = null;
const hashSenuelo = () => (senuelo ??= hash('senuelo-que-nunca-coincide'));

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user) redirect(302, '/');
	return { codigo: cookies.get(COOKIE_CODIGO) ?? '' };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const codigo = formData.get('codigo')?.toString().trim().toLowerCase().slice(0, 40) ?? '';
		const username = formData.get('username')?.toString().trim().slice(0, 60) ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!codigo || !username || !password) {
			return fail(400, {
				message: 'Completa el código del restaurante, el usuario y la contraseña.',
				codigo
			});
		}

		if (password.length > MAX_PASSWORD)
			return fail(400, { message: CREDENCIALES_INVALIDAS, codigo });

		const claves = clavesLogin(event.getClientAddress(), `${codigo}/${username.toLowerCase()}`);
		const bloqueo = await reservarIntento(claves);
		if (bloqueo > 0) {
			return fail(429, {
				message: `Demasiados intentos fallidos. Intenta de nuevo en ${bloqueo} min.`,
				codigo
			});
		}

		const [user] = await db
			.select({ id: usuarios.id, passwordHash: usuarios.passwordHash })
			.from(usuarios)
			.innerJoin(tenants, eq(usuarios.tenantId, tenants.id))
			.where(
				and(
					eq(tenants.codigo, codigo),
					ne(tenants.estado, 'cancelado'),
					sql`lower(${usuarios.nombre}) = lower(${username})`
				)
			);

		const valida = await verify(user?.passwordHash ?? (await hashSenuelo()), password);
		if (!user || !valida) return fail(400, { message: CREDENCIALES_INVALIDAS, codigo });
		await intentoExitoso(claves);

		const token = generateSessionToken();
		await createSession(token, user.id);

		event.cookies.set('session', token, SESSION_COOKIE_OPTS);
		event.cookies.set(COOKIE_CODIGO, codigo, {
			path: '/login',
			httpOnly: true,
			secure: import.meta.env.PROD,
			sameSite: 'lax',
			maxAge: UN_ANIO
		});

		redirect(302, '/');
	}
};
