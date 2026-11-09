/**
 * Política de acceso por rol (isomórfica: la usan hooks.server.ts y la navegación).
 *
 * Principio: "deny by default". Un rol desconocido recibe los permisos mínimos
 * (los de cajero) en lugar de acceso total, que era el comportamiento anterior.
 */

export const ROLES = ['jefe', 'bodeguero', 'cajero', 'empleado'] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABELS: Record<Rol, string> = {
	jefe: 'Administrador',
	bodeguero: 'Bodeguero',
	cajero: 'Cajero',
	empleado: 'Empleado'
};

interface RolePolicy {
	/** Ruta de inicio tras login. */
	home: string;
	/** Prefijos permitidos. `'*'` = todo. */
	allow: readonly string[];
}

const POLICY: Record<Rol, RolePolicy> = {
	jefe: { home: '/dashboard', allow: ['*'] },
	bodeguero: { home: '/bodega', allow: ['/bodega', '/turnos/cierre'] },
	cajero: { home: '/turnos/cierre', allow: ['/turnos/cierre'] },
	empleado: { home: '/turnos/cierre', allow: ['/turnos/cierre'] }
};

/** Rutas accesibles para cualquier usuario autenticado. */
const ALWAYS_ALLOWED = ['/', '/logout'];
/** Rutas accesibles sin sesión. */
export const PUBLIC_PATHS = ['/login'];

export function isRol(value: unknown): value is Rol {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Normaliza el rol guardado en BD; cualquier valor inválido cae al mínimo privilegio. */
export function normalizeRol(value: unknown): Rol {
	const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
	return isRol(v) ? v : 'cajero';
}

function matchesPrefix(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(prefix + '/');
}

export function canAccess(rol: unknown, path: string): boolean {
	if (ALWAYS_ALLOWED.includes(path)) return true;
	const policy = POLICY[normalizeRol(rol)];
	return policy.allow.some((p) => p === '*' || matchesPrefix(path, p));
}

export function homeFor(rol: unknown): string {
	return POLICY[normalizeRol(rol)].home;
}

export function isPublicPath(path: string): boolean {
	return PUBLIC_PATHS.some((p) => matchesPrefix(path, p));
}
