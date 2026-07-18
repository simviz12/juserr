import { db } from './db';
import { sesiones, usuarios } from './schema';
import { eq } from 'drizzle-orm';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(token: string, userId: number): Promise<typeof sesiones.$inferSelect> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: typeof sesiones.$inferInsert = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 dias
  };
  await db.insert(sesiones).values(session);
  return session;
}

export async function validateSessionToken(token: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const result = await db
    .select({ user: usuarios, session: sesiones })
    .from(sesiones)
    .innerJoin(usuarios, eq(sesiones.userId, usuarios.id))
    .where(eq(sesiones.id, sessionId));

  if (result.length < 1) {
    return { session: null, user: null };
  }

  const { user, session } = result[0];
  
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sesiones).where(eq(sesiones.id, session.id));
    return { session: null, user: null };
  }

  // Renovar si queda menos de 15 dias
  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db.update(sesiones).set({ expiresAt: session.expiresAt }).where(eq(sesiones.id, session.id));
  }

  return { session, user };
}

export async function invalidateSession(sessionId: string) {
  await db.delete(sesiones).where(eq(sesiones.id, sessionId));
}
 
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
export function requireRole(event: RequestEvent, role: string) {
  if (!event.locals.user || event.locals.user.rol !== role) {
    throw error(403, 'Acceso denegado');
  }
}