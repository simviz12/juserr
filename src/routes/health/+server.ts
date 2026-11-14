import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * Sonda de salud para el balanceador / Docker / monitoreo externo.
 * Público y sin datos sensibles: solo dice si la app responde y llega a la BD.
 */
export const GET: RequestHandler = async () => {
	const inicio = Date.now();
	try {
		await db.execute(sql`SELECT 1`);
		return json(
			{ ok: true, db: 'ok', ms: Date.now() - inicio },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (err) {
		console.error('[health] la base de datos no responde:', err);
		return json(
			{ ok: false, db: 'error' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}
};
