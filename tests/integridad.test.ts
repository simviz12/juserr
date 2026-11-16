/**
 * Integridad de datos ante envíos repetidos y concurrencia (Postgres real con PGlite):
 *   - el cierre de turno es idempotente (doble clic = un turno);
 *   - un comprobante Nequi no se puede usar dos veces, sin límite de historial;
 *   - el cierre de turno ya no sobrescribe todos los productos "Pizza…";
 *   - las compras de Bodega no se pisan entre sí;
 *   - un solo cierre de caja por día y una sola solicitud pendiente por módulo.
 */
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
vi.mock('$env/dynamic/private', () => ({ env: {} }));

let pg: PGlite;
const T = 1;
let userId = 0;

beforeAll(async () => {
	pg = new PGlite();
	for (const stmt of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema)))
		await pg.exec(stmt);
	const db = drizzle(pg, { schema });
	// PGlite no tiene batch de neon-http: se emula con BEGIN/COMMIT sobre la
	// misma conexión, así un error revierte el lote completo igual que en Neon.
	Object.assign(db, {
		batch: async (qs: Promise<unknown>[]) => {
			await pg.exec('BEGIN');
			try {
				const r = [];
				for (const q of qs) r.push(await q);
				await pg.exec('COMMIT');
				return r;
			} catch (e) {
				await pg.exec('ROLLBACK');
				throw e;
			}
		}
	});
	holder.db = db;
	await pg.exec(`
		INSERT INTO modulos_catalogo (codigo, nombre, precio_mensual_cents, es_core) VALUES
			('core', 'Plan Core', 6900000, true), ('produccion', 'P', 1500000, false);
		INSERT INTO tenants (id, codigo, nombre) VALUES (${T}, 'resto', 'Resto');
		INSERT INTO rubros_config (tenant_id, nombre_negocio, habilitar_chuzos, habilitar_hamburguesas,
			habilitar_lasanas, habilitar_carnes) VALUES (${T}, 'Resto', false, false, false, false);
		INSERT INTO productos (tenant_id, nombre, unidad_medida, stock_actual) VALUES
			(${T}, 'Masa', 'unidad', 10),
			(${T}, 'Pizza (Porciones)', 'porcion', 4),
			(${T}, 'Pizza hawaiana congelada', 'unidad', 50);
	`);
	const u = await pg.query<{ id: number }>(
		`INSERT INTO usuarios (tenant_id, nombre, password_hash, rol) VALUES (${T}, 'jefe', 'x', 'jefe') RETURNING id`
	);
	userId = u.rows[0].id;
});

function evento(path: string, form: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.append(k, v);
	return {
		locals: {
			user: { id: userId, tenantId: T, nombre: 'jefe', rol: 'jefe' },
			session: null,
			tenant: { id: T, codigo: 'resto', nombre: 'Resto', estado: 'activo', diasGracia: 5 },
			entitlements: {
				tenant: 'resto',
				estadoCore: 'al-dia',
				modulos: [],
				coreVigenteHasta: '2099-01-01',
				diasParaVencer: 30,
				diasGraciaRestantes: null
			},
			platformAdmin: null
		},
		url: new URL(`http://test${path}`),
		params: {},
		cookies: { get: () => undefined, set: () => {}, delete: () => {} },
		request: new Request(`http://test${path}`, { method: 'POST', body: fd }),
		getClientAddress: () => '127.0.0.1'
	} as never;
}

const stock = async (nombre: string) =>
	Number(
		(
			await pg.query<{ s: string }>(`SELECT stock_actual s FROM productos WHERE nombre = $1`, [
				nombre
			])
		).rows[0].s
	);
const contar = async (tabla: string) =>
	Number((await pg.query<{ n: string }>(`SELECT count(*) n FROM ${tabla}`)).rows[0].n);

describe('cierre de turno', () => {
	it('un envío repetido con la misma clave no crea otro turno', async () => {
		const { closeShiftAction } =
			await import('../src/lib/features/shifts/server/close-shift.action');
		const form = {
			clave: 'clave-idempotencia-0001',
			monto: '50000',
			nequi: '20000',
			ref_nequi: 'M12345',
			masas_sobrantes: '6',
			porciones_sobrantes: '3'
		};
		const r1 = (await closeShiftAction(evento('/turnos/cierre', form))) as { success?: boolean };
		const r2 = (await closeShiftAction(evento('/turnos/cierre', form))) as {
			success?: boolean;
			message?: string;
		};
		expect(r1.success).toBe(true);
		expect(r2.success).toBe(true);
		expect(r2.message).toMatch(/ya estaba registrado/);
		expect(await contar('turnos')).toBe(1);
		expect(await contar('transacciones_turno')).toBe(1);
	});

	it('solo actualiza UN producto de porciones (no todos los "Pizza…")', async () => {
		expect(await stock('Pizza (Porciones)')).toBe(3);
		expect(await stock('Pizza hawaiana congelada')).toBe(50);
	});

	it('descuenta las masas usadas en vez de fijar el valor (no pierde compras)', async () => {
		// 10 iniciales − (10 − 6 sobrantes) = 6
		expect(await stock('Masa')).toBe(6);
	});

	it('rechaza un comprobante Nequi ya usado en otro turno', async () => {
		const { closeShiftAction } =
			await import('../src/lib/features/shifts/server/close-shift.action');
		const r = (await closeShiftAction(
			evento('/turnos/cierre', {
				clave: 'clave-idempotencia-0002',
				monto: '1000',
				nequi: '5000',
				ref_nequi: 'm12345',
				masas_sobrantes: '6'
			})
		)) as { status?: number };
		expect(r.status).toBe(409);
		expect(await contar('turnos')).toBe(1);
	});
});

describe('bodega', () => {
	it('dos compras simultáneas suman las dos (no se pisan)', async () => {
		const { actions } = await import('../src/routes/bodega/+page.server');
		const [{ id }] = (
			await pg.query<{ id: number }>(`SELECT id FROM productos WHERE nombre = 'Masa'`)
		).rows;
		const antes = await stock('Masa');
		await Promise.all(
			[1, 2].map(() =>
				actions.default(
					evento('/bodega', {
						tipo_operacion: 'entrada',
						tipo_insumo: String(id),
						cantidad: '5',
						precioTotalCompra: '10000'
					})
				)
			)
		);
		expect(await stock('Masa')).toBe(antes + 10);
		const movs = await pg.query<{ c: string }>(
			`SELECT cantidad c FROM movimientos_inventario WHERE producto_id = $1`,
			[id]
		);
		expect(movs.rows.map((m) => Number(m.c))).toEqual([5, 5]);
	});

	it('rechaza cantidades absurdas', async () => {
		const { actions } = await import('../src/routes/bodega/+page.server');
		const r = (await actions.default(
			evento('/bodega', { tipo_operacion: 'entrada', tipo_insumo: '1', cantidad: '1e20' })
		)) as { status?: number };
		expect(r.status).toBe(400);
	});
});

describe('restricciones únicas', () => {
	it('un solo cierre de caja por día', async () => {
		await pg.exec(
			`INSERT INTO cierres_dia (tenant_id, total_efectivo, fecha) VALUES (${T}, 1, '2026-05-01 17:00')`
		);
		await expect(
			pg.exec(
				`INSERT INTO cierres_dia (tenant_id, total_efectivo, fecha) VALUES (${T}, 1, '2026-05-01 18:00')`
			)
		).rejects.toThrow(/cierres_dia_tenant_dia_uq/);
	});

	it('una sola solicitud pendiente por módulo (doble clic simultáneo)', async () => {
		const { solicitarModulo } = await import('../src/lib/billing/server');
		const r = await Promise.allSettled([
			solicitarModulo(T, userId, 'produccion'),
			solicitarModulo(T, userId, 'produccion')
		]);
		expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
		expect(await contar(`solicitudes_modulo WHERE estado = 'pendiente'`)).toBe(1);
	});
});
