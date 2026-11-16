/** Freno de fuerza bruta compartido (Postgres real en memoria con PGlite). */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../src/lib/server/schema';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', () => ({
	get db() {
		return holder.db;
	}
}));

const { clavesLogin, intentoExitoso, reservarIntento } =
	await import('../src/lib/server/login-throttle');

beforeAll(async () => {
	const pg = new PGlite();
	for (const stmt of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema)))
		await pg.exec(stmt);
	holder.db = drizzle(pg, { schema });
});

describe('freno de fuerza bruta del login', () => {
	it('bloquea ip+cuenta al 6.º intento y libera al vencer la ventana', async () => {
		const claves = clavesLogin('10.0.0.1', 'resto/ana');
		const t0 = new Date('2026-01-01T12:00:00Z');
		for (let i = 0; i < 5; i++) expect(await reservarIntento(claves, t0)).toBe(0);
		expect(await reservarIntento(claves, t0)).toBe(15);
		const t1 = new Date(t0.getTime() + 60_000);
		expect(await reservarIntento(claves, t1)).toBe(14);
		const t2 = new Date(t0.getTime() + 16 * 60_000);
		expect(await reservarIntento(claves, t2)).toBe(0);
	});

	it('cuenta los intentos en paralelo (no hay carrera antes de verificar)', async () => {
		const claves = clavesLogin('10.0.0.2', 'resto/beto');
		const t = new Date('2026-01-02T12:00:00Z');
		const r = await Promise.all(Array.from({ length: 10 }, () => reservarIntento(claves, t)));
		expect(r.filter((m) => m === 0)).toHaveLength(5);
	});

	it('otra IP no queda bloqueada por los fallos de un atacante en la misma cuenta', async () => {
		const t = new Date('2026-01-03T12:00:00Z');
		for (let i = 0; i < 6; i++) await reservarIntento(clavesLogin('6.6.6.6', 'resto/caro'), t);
		expect(await reservarIntento(clavesLogin('10.0.0.3', 'resto/caro'), t)).toBe(0);
	});

	it('un ingreso correcto reinicia los intentos de la cuenta', async () => {
		const claves = clavesLogin('10.0.0.4', 'resto/dani');
		const t = new Date('2026-01-04T12:00:00Z');
		for (let i = 0; i < 5; i++) await reservarIntento(claves, t);
		await intentoExitoso(claves);
		expect(await reservarIntento(claves, t)).toBe(0);
	});
});
