import { db } from './db';
import { sesiones, tenants, usuarios } from './schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';

const DAY_MS = 86_400_000;
const SESSION_DAYS = 30;
const RENEW_BEFORE_DAYS = 15;
/** Caducidad absoluta: aunque se use a diario, la sesión exige login cada 90 días. */
const ABSOLUTE_DAYS = 90;
/**
 * Caché corta por instancia. Un logout, un cambio de rol o una suspensión se
 * aplican al instante en la instancia que los hizo y en ≤ CACHE_TTL_MS en las demás.
 */
const CACHE_TTL_MS = 5_000;
const CACHE_MAX = 5_000;

/** Cookie de sesión del restaurante (misma configuración en login y en el hook). */
export const SESSION_COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * SESSION_DAYS
} as const;

/** Usuario en sesión. NUNCA incluye el hash de la contraseña (viaja al layout). */
export type SessionUser = { id: number; tenantId: number; nombre: string; rol: string };
export type Session = typeof sesiones.$inferSelect;

const COLUMNAS_USUARIO = {
	id: usuarios.id,
	tenantId: usuarios.tenantId,
	nombre: usuarios.nombre,
	rol: usuarios.rol
};

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

export function sessionIdFromToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(token: string, userId: number): Promise<Session> {
	const ahora = new Date();
	const session: Session = {
		id: sessionIdFromToken(token),
		userId,
		expiresAt: new Date(ahora.getTime() + SESSION_DAYS * DAY_MS),
		createdAt: ahora
	};
	await db.insert(sesiones).values(session);
	return session;
}

interface CachedSession {
	user: SessionUser;
	session: Session;
	cachedAt: number;
}
const sessionCache = new Map<string, CachedSession>();

function cachear(id: string, entry: CachedSession) {
	// Map conserva el orden de inserción: al llenarse se descarta la entrada más antigua.
	if (sessionCache.size >= CACHE_MAX) {
		const primera = sessionCache.keys().next().value;
		if (primera !== undefined) sessionCache.delete(primera);
	}
	sessionCache.set(id, entry);
}

const caducaAbsoluta = (s: Session) =>
	s.createdAt ? s.createdAt.getTime() + ABSOLUTE_DAYS * DAY_MS : Infinity;

/**
 * Valida el token de sesión. Un usuario de un restaurante cancelado no tiene
 * sesión válida (los suspendidos sí entran, pero solo ven facturación).
 */
export async function validateSessionToken(
	token: string
): Promise<{ session: Session | null; user: SessionUser | null }> {
	const sessionId = sessionIdFromToken(token);
	const ahora = Date.now();

	const cached = sessionCache.get(sessionId);
	if (cached && ahora - cached.cachedAt < CACHE_TTL_MS) {
		if (ahora < cached.session.expiresAt.getTime())
			return { session: cached.session, user: cached.user };
		sessionCache.delete(sessionId);
	}

	const [row] = await db
		.select({ user: COLUMNAS_USUARIO, session: sesiones })
		.from(sesiones)
		.innerJoin(usuarios, eq(sesiones.userId, usuarios.id))
		.innerJoin(tenants, and(eq(usuarios.tenantId, tenants.id), ne(tenants.estado, 'cancelado')))
		.where(eq(sesiones.id, sessionId));

	if (!row) {
		sessionCache.delete(sessionId);
		return { session: null, user: null };
	}

	const { user, session } = row;
	if (ahora >= session.expiresAt.getTime() || ahora >= caducaAbsoluta(session)) {
		sessionCache.delete(sessionId);
		await db.delete(sesiones).where(eq(sesiones.id, session.id));
		return { session: null, user: null };
	}

	if (ahora >= session.expiresAt.getTime() - RENEW_BEFORE_DAYS * DAY_MS) {
		session.expiresAt = new Date(Math.min(ahora + SESSION_DAYS * DAY_MS, caducaAbsoluta(session)));
		await db
			.update(sesiones)
			.set({ expiresAt: session.expiresAt })
			.where(eq(sesiones.id, session.id));
	}

	cachear(sessionId, { user, session, cachedAt: ahora });
	return { session, user };
}

/** Cierra todas las sesiones de un usuario (cambio de rol, contraseña o borrado). */
export async function invalidateUserSessions(userId: number) {
	for (const [id, entry] of sessionCache) {
		if (entry.user.id === userId) sessionCache.delete(id);
	}
	await db.delete(sesiones).where(eq(sesiones.userId, userId));
}

/** Cierra todas las sesiones de un restaurante (cancelación desde la consola). */
export async function invalidateTenantSessions(tenantId: number) {
	for (const [id, entry] of sessionCache) {
		if (entry.user.tenantId === tenantId) sessionCache.delete(id);
	}
	await db
		.delete(sesiones)
		.where(
			inArray(
				sesiones.userId,
				db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.tenantId, tenantId))
			)
		);
}

export async function invalidateSession(sessionId: string) {
	sessionCache.delete(sessionId);
	await db.delete(sesiones).where(eq(sesiones.id, sessionId));
}
