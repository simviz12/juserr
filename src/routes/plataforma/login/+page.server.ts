import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { platformAdmins } from '$lib/server/schema';
import { crearSesionPlataforma } from '$lib/server/platform-auth';
import { limpiarFallos, minutosBloqueo, registrarFallo } from '$lib/server/login-throttle';
import type { Actions, PageServerLoad } from './$types';

let senuelo: Promise<string> | null = null;
const hashSenuelo = () => (senuelo ??= hash('senuelo-plataforma-que-nunca-coincide'));

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.platformAdmin) redirect(303, '/plataforma');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const fd = await request.formData();
		const email = fd.get('email')?.toString().trim().toLowerCase().slice(0, 120) ?? '';
		const password = fd.get('password')?.toString() ?? '';
		if (!email || !password)
			return fail(400, { message: 'Escribe tu correo y contraseña.', email });

		const claves = [`ip:${getClientAddress()}`, `plataforma:${email}`];
		const bloqueo = minutosBloqueo(claves);
		if (bloqueo > 0)
			return fail(429, { message: `Demasiados intentos. Intenta en ${bloqueo} min.`, email });

		const [admin] = await db
			.select({ id: platformAdmins.id, passwordHash: platformAdmins.passwordHash })
			.from(platformAdmins)
			.where(eq(sql`lower(${platformAdmins.email})`, email));
		const valida = await verify(admin?.passwordHash ?? (await hashSenuelo()), password);
		if (!admin || !valida) {
			registrarFallo(claves);
			return fail(400, { message: 'Correo o contraseña incorrectos.', email });
		}
		limpiarFallos(claves);
		await crearSesionPlataforma(cookies, admin.id);
		redirect(303, '/plataforma');
	}
};
