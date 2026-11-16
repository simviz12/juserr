import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { log } from '$lib/server/log';
import { version } from '$app/environment';
import type { RequestHandler } from './$types';

/** La sonda responde en ≤ 2 s aunque la base esté colgada (no bloquea al balanceador). */
const LIMITE_MS = 2_000;

/**
 * Sonda de salud para el balanceador / Docker / monitoreo externo.
 * Público y sin datos sensibles: solo dice si la app responde y llega a la BD.
 */
export const GET: RequestHandler = async () => {
	const inicio = Date.now();
	const headers = { 'cache-control': 'no-store' };
	try {
		await Promise.race([
			db.execute(sql`SELECT 1`),
			new Promise((_, rechazar) =>
				setTimeout(() => rechazar(new Error(`sin respuesta en ${LIMITE_MS} ms`)), LIMITE_MS)
			)
		]);
		return json({ ok: true, db: 'ok', ms: Date.now() - inicio, version }, { headers });
	} catch (err) {
		log.error('health: la base de datos no responde', { ms: Date.now() - inicio, err });
		return json({ ok: false, db: 'error', version }, { status: 503, headers });
	}
};
