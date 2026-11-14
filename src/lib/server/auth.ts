import { db } from './db';
import { sesiones, tenants, usuarios } from './schema';
import { and, eq, ne } from 'drizzle-orm';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';

const DAY_MS = 86_400_000;
const SESSION_DAYS = 30;
const RENEW_BEFORE_DAYS = 15;
const CACHE_TTL_MS = 60_000;

export type SessionUser = typeof usuarios.$inferSelect;
export type Session = typeof sesiones.$inferSelect;

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

export function sessionIdFromToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(token: string, userId: number): Promise<Session> {
	const session: Session = {
		id: sessionIdFromToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS)
	};
	await db.insert(sesiones).values(session);
	return session;
}

// Caché en memoria para no consultar la BD en cada navegación (TTL 60 s).
interface CachedSession {
	user: SessionUser;
	session: Session;
	cachedAt: number;
}
const sessionCache = new Map<string, CachedSession>();

/**
 * Valida el token de sesión. Un usuario de un restaurante cancelado no tiene
 * sesión válida (los suspendidos sí entran, pero solo ven facturación).
 */
export async function validateSessionToken(
	token: string
): Promise<{ session: Session | null; user: SessionUser | null }> {
	const sessionId = sessionIdFromToken(token);

	const cached = sessionCache.get(sessionId);
	if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
		if (Date.now() < cached.session.expiresAt.getTime())
			return { session: cached.session, user: cached.user };
		sessionCache.delete(sessionId);
	}

	const [row] = await db
		.select({ user: usuarios, session: sesiones })
		.from(sesiones)
		.innerJoin(usuarios, eq(sesiones.userId, usuarios.id))
		.innerJoin(tenants, and(eq(usuarios.tenantId, tenants.id), ne(tenants.estado, 'cancelado')))
		.where(eq(sesiones.id, sessionId));

	if (!row) {
		sessionCache.delete(sessionId);
		return { session: null, user: null };
	}

	const { user, session } = row;
	if (Date.now() >= session.expiresAt.getTime()) {
		sessionCache.delete(sessionId);
		await db.delete(sesiones).where(eq(sesiones.id, session.id));
		return { session: null, user: null };
	}

	if (Date.now() >= session.expiresAt.getTime() - RENEW_BEFORE_DAYS * DAY_MS) {
		session.expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
		await db
			.update(sesiones)
			.set({ expiresAt: session.expiresAt })
			.where(eq(sesiones.id, session.id));
	}

	sessionCache.set(sessionId, { user, session, cachedAt: Date.now() });
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
	const ids = await db
		.select({ id: usuarios.id })
		.from(usuarios)
		.where(eq(usuarios.tenantId, tenantId));
	for (const { id } of ids) await invalidateUserSessions(id);
}

export async function invalidateSession(sessionId: string) {
	sessionCache.delete(sessionId);
	await db.delete(sesiones).where(eq(sesiones.id, sessionId));
}
