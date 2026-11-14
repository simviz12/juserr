/**
 * Sesiones de la consola de plataforma (/plataforma). Totalmente separadas de
 * las de los restaurantes: otra tabla, otra cookie (limitada a /plataforma) y
 * duración corta, porque desde aquí se activan módulos y se registran pagos.
 */
import { db } from './db';
import { platformAdmins, platformSesiones, auditoriaPlataforma } from './schema';
import { eq } from 'drizzle-orm';
import { generateSessionToken, sessionIdFromToken } from './auth';
import type { Cookies } from '@sveltejs/kit';

export const PLATFORM_COOKIE = 'psession';
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

export type PlatformAdmin = { id: number; email: string; nombre: string };

export async function crearSesionPlataforma(cookies: Cookies, adminId: number): Promise<void> {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + DURACION_MS);
	await db.insert(platformSesiones).values({ id: sessionIdFromToken(token), adminId, expiresAt });
	cookies.set(PLATFORM_COOKIE, token, {
		path: '/plataforma',
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: 'strict',
		expires: expiresAt
	});
}

export async function validarSesionPlataforma(
	token: string | undefined
): Promise<PlatformAdmin | null> {
	if (!token) return null;
	const [row] = await db
		.select({
			id: platformAdmins.id,
			email: platformAdmins.email,
			nombre: platformAdmins.nombre,
			expiresAt: platformSesiones.expiresAt
		})
		.from(platformSesiones)
		.innerJoin(platformAdmins, eq(platformSesiones.adminId, platformAdmins.id))
		.where(eq(platformSesiones.id, sessionIdFromToken(token)));
	if (!row) return null;
	if (row.expiresAt.getTime() <= Date.now()) {
		await db.delete(platformSesiones).where(eq(platformSesiones.id, sessionIdFromToken(token)));
		return null;
	}
	return { id: row.id, email: row.email, nombre: row.nombre };
}

export async function cerrarSesionPlataforma(cookies: Cookies): Promise<void> {
	const token = cookies.get(PLATFORM_COOKIE);
	if (token)
		await db.delete(platformSesiones).where(eq(platformSesiones.id, sessionIdFromToken(token)));
	cookies.delete(PLATFORM_COOKIE, { path: '/plataforma' });
}

/** Deja constancia de una acción de la consola. */
export async function auditar(
	adminId: number,
	tenantId: number | null,
	accion: string,
	detalle?: unknown
): Promise<void> {
	await db
		.insert(auditoriaPlataforma)
		.values({ adminId, tenantId, accion, detalle: detalle ?? null });
}
