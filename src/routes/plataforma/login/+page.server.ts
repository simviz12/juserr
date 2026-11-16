import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { platformAdmins } from '$lib/server/schema';
import { crearSesionPlataforma } from '$lib/server/platform-auth';
import { clavesLogin, intentoExitoso, reservarIntento } from '$lib/server/login-throttle';
import { verificarTotp } from '$lib/server/totp';
import type { Actions, PageServerLoad } from './$types';

let senuelo: Promise<string> | null = null;
const hashSenuelo = () => (senuelo ??= hash('senuelo-plataforma-que-nunca-coincide'));
const MAX_PASSWORD = 256;
const INCORRECTO = 'Correo, contraseña o código incorrectos.';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.platformAdmin) redirect(303, '/plataforma');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const fd = await request.formData();
		const email = fd.get('email')?.toString().trim().toLowerCase().slice(0, 120) ?? '';
		const password = fd.get('password')?.toString() ?? '';
		const codigo = fd.get('codigo')?.toString().trim() ?? '';
		if (!email || !password)
			return fail(400, { message: 'Escribe tu correo y contraseña.', email });
		if (password.length > MAX_PASSWORD) return fail(400, { message: INCORRECTO, email });

		const claves = clavesLogin(getClientAddress(), `plataforma:${email}`);
		const bloqueo = await reservarIntento(claves);
		if (bloqueo > 0)
			return fail(429, { message: `Demasiados intentos. Intenta en ${bloqueo} min.`, email });

		const [admin] = await db
			.select({
				id: platformAdmins.id,
				passwordHash: platformAdmins.passwordHash,
				totpSecret: platformAdmins.totpSecret
			})
			.from(platformAdmins)
			.where(eq(sql`lower(${platformAdmins.email})`, email));
		const valida = await verify(admin?.passwordHash ?? (await hashSenuelo()), password);
		if (!admin || !valida) return fail(400, { message: INCORRECTO, email });

		// Segundo factor. Con PLATFORM_REQUIRE_TOTP=1 un admin sin TOTP no puede entrar.
		if (admin.totpSecret) {
			if (!verificarTotp(admin.totpSecret, codigo))
				return fail(400, { message: INCORRECTO, email, pideCodigo: true });
		} else if (env.PLATFORM_REQUIRE_TOTP === '1') {
			return fail(403, {
				message:
					'Tu cuenta no tiene segundo factor. Configúralo con `pnpm plataforma:admin --totp`.',
				email
			});
		}

		await intentoExitoso(claves);
		await crearSesionPlataforma(cookies, admin.id);
		redirect(303, '/plataforma');
	}
};
