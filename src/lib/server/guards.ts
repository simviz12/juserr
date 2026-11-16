/**
 * Guardas de defensa en profundidad.
 *
 * hooks.server.ts es el control central, pero cada load/acción sensible vuelve
 * a comprobar sus requisitos aquí: si el hook se salta por un bug de
 * enrutamiento (p. ej. una URL con `%` codificados), la ruta sigue cerrada.
 */
import { error } from '@sveltejs/kit';
import type { PlatformAdmin } from './platform-auth';

/** Exige sesión de la consola de plataforma. Devuelve el admin. */
export function exigirAdminPlataforma(locals: App.Locals): PlatformAdmin {
	const admin = locals.platformAdmin;
	if (!admin) error(404, 'Not found');
	return admin;
}

/** Exige que el restaurante en sesión tenga el módulo activo hoy. */
export function exigirModulo(locals: App.Locals, codigo: string): void {
	const ent = locals.entitlements;
	if (!locals.user || !ent) error(401, 'Sesión inválida');
	if (!ent.modulos.includes(codigo)) error(403, 'Módulo no contratado');
}
