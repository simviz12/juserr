import { db } from '$lib/server/db';
import { usuarios, saasSuscripciones } from '$lib/server/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import * as argon2 from '@node-rs/argon2';
import type { Actions, PageServerLoad } from './$types';
import { isRol } from '$lib/auth/access';
import { invalidateUserSessions } from '$lib/server/auth';

const MIN_PASSWORD = 8;

async function limiteUsuarios(): Promise<number | null> {
	const [sub] = await db.select({ limite: saasSuscripciones.limiteUsuarios }).from(saasSuscripciones).limit(1);
	return sub?.limite ?? null;
}

async function nombreDuplicado(nombre: string, exceptId?: number) {
	const rows = await db.select({ id: usuarios.id }).from(usuarios).where(sql`lower(${usuarios.nombre}) = lower(${nombre})`);
	return rows.some((r) => r.id !== exceptId);
}

export const load: PageServerLoad = async ({ locals }) => {
	const [list, limite] = await Promise.all([
		db
			.select({ id: usuarios.id, nombre: usuarios.nombre, rol: usuarios.rol, createdAt: usuarios.createdAt })
			.from(usuarios)
			.orderBy(asc(usuarios.id)),
		limiteUsuarios()
	]);
	return {
		personal: list.map((u) => ({ ...u, createdAt: u.createdAt ? u.createdAt.toISOString() : null })),
		limite,
		yo: locals.user?.id ?? null
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const nombre = fd.get('nombre')?.toString().trim().slice(0, 60) ?? '';
		const rawPassword = fd.get('password')?.toString() ?? '';
		const rol = fd.get('rol')?.toString() ?? '';

		if (!nombre || !rawPassword || !rol) return fail(400, { error: 'Todos los campos son obligatorios.' });
		if (!isRol(rol)) return fail(400, { error: 'Rol inválido.' });
		if (rawPassword.length < MIN_PASSWORD) {
			return fail(400, { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
		}
		if (await nombreDuplicado(nombre)) return fail(409, { error: `Ya existe un usuario llamado "${nombre}".` });

		const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(usuarios);
		const limite = await limiteUsuarios();
		if (limite !== null && total >= limite) {
			return fail(403, { error: `Tu plan permite ${limite} usuario(s). Mejora el plan en Suscripción para agregar más.` });
		}

		try {
			await db.insert(usuarios).values({ nombre, passwordHash: await argon2.hash(rawPassword), rol });
			return { success: true, message: `Usuario ${nombre} creado.` };
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Error al crear el usuario.' });
		}
	},

	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const nombre = fd.get('nombre')?.toString().trim().slice(0, 60) ?? '';
		const rawPassword = fd.get('password')?.toString() ?? '';
		const rol = fd.get('rol')?.toString() ?? '';

		if (!id || !nombre || !rol) return fail(400, { error: 'Faltan campos obligatorios.' });
		if (!isRol(rol)) return fail(400, { error: 'Rol inválido.' });
		if (rawPassword && rawPassword.length < MIN_PASSWORD) {
			return fail(400, { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
		}
		if (await nombreDuplicado(nombre, id)) return fail(409, { error: `Ya existe un usuario llamado "${nombre}".` });

		const [antes] = await db.select({ rol: usuarios.rol }).from(usuarios).where(eq(usuarios.id, id));
		if (!antes) return fail(404, { error: 'El usuario no existe.' });

		// Evitar dejar el sistema sin administradores
		if (antes.rol === 'jefe' && rol !== 'jefe') {
			const [{ jefes }] = await db.select({ jefes: sql<number>`count(*)::int` }).from(usuarios).where(eq(usuarios.rol, 'jefe'));
			if (jefes <= 1) return fail(400, { error: 'No puedes quitarle el rol de Jefe al último administrador.' });
		}

		try {
			const updates: { nombre: string; rol: string; passwordHash?: string } = { nombre, rol };
			if (rawPassword) updates.passwordHash = await argon2.hash(rawPassword);
			await db.update(usuarios).set(updates).where(eq(usuarios.id, id));
			// Cambio de rol o contraseña => cerrar las sesiones abiertas de ese usuario
			if (rawPassword || antes.rol !== rol) await invalidateUserSessions(id);
			return { success: true, message: `Usuario ${nombre} actualizado.` };
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Error al actualizar el usuario.' });
		}
	},

	delete: async ({ request, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Usuario inválido.' });
		if (id === locals.user?.id) return fail(400, { error: 'No puedes eliminar tu propio usuario.' });

		const [u] = await db.select({ rol: usuarios.rol, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.id, id));
		if (!u) return fail(404, { error: 'El usuario no existe.' });
		if (u.rol === 'jefe') {
			const [{ jefes }] = await db.select({ jefes: sql<number>`count(*)::int` }).from(usuarios).where(eq(usuarios.rol, 'jefe'));
			if (jefes <= 1) return fail(400, { error: 'No puedes eliminar al último Jefe del sistema.' });
		}

		try {
			await invalidateUserSessions(id);
			await db.delete(usuarios).where(eq(usuarios.id, id));
			return { success: true, message: `Usuario ${u.nombre} eliminado.` };
		} catch {
			return fail(409, { error: 'No se puede eliminar porque tiene registros asociados (movimientos de bodega).' });
		}
	}
};
