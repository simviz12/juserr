/**
 * Aislamiento entre restaurantes sobre una base Postgres real (PGlite).
 *
 * Hay dos restaurantes, A y B, con datos marcados. Con la sesión de B se
 * ejecutan TODAS las páginas (load) y se comprueba que ningún dato de A aparece;
 * luego se intenta leer/modificar/borrar registros de A desde las acciones de B
 * usando sus ids, y se comprueba que no pasa nada (404) y que A queda intacto.
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
const A = { tenant: 1, marca: 'SECRETO-A', monto: '777777.77' };
const B = { tenant: 2 };
const ids: Record<string, number> = {};

beforeAll(async () => {
	pg = new PGlite();
	for (const stmt of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema)))
		await pg.exec(stmt);
	const db = drizzle(pg, { schema });
	// drizzle/pglite no tiene batch (es de neon-http): en la prueba se ejecuta en secuencia.
	Object.assign(db, {
		batch: async (qs: Promise<unknown>[]) => {
			const r = [];
			for (const q of qs) r.push(await q);
			return r;
		}
	});
	holder.db = db;

	await pg.exec(`
		INSERT INTO modulos_catalogo (codigo, nombre, precio_mensual_cents, es_core) VALUES
			('core', 'Plan Core', 6900000, true), ('estado-resultados', 'ER', 2900000, false),
			('finanzas-avanzadas', 'FA', 2500000, false), ('produccion', 'P', 1500000, false);
		INSERT INTO tenants (id, codigo, nombre) VALUES (1, 'resto-a', 'Restaurante ${A.marca}'), (2, 'resto-b', 'Restaurante B');
		SELECT setval(pg_get_serial_sequence('tenants', 'id'), 2);
	`);
	for (const t of [1, 2]) {
		const m = t === 1 ? A.marca : 'b';
		const monto = t === 1 ? A.monto : '1000';
		const r = await pg.query<{
			u: number;
			p: number;
			c: number;
			s: number;
			l: number;
			i: number;
			tu: number;
			g: number;
			mc: number;
		}>(`
			WITH
			u AS (INSERT INTO usuarios (tenant_id, nombre, password_hash, rol) VALUES (${t}, 'admin', 'x', 'jefe') RETURNING id),
			u2 AS (INSERT INTO usuarios (tenant_id, nombre, password_hash, rol) VALUES (${t}, 'cajero-${m}', 'x', 'cajero') RETURNING id),
			c AS (INSERT INTO categorias (tenant_id, nombre) VALUES (${t}, 'Cat ${m}') RETURNING id),
			p AS (INSERT INTO productos (tenant_id, nombre, unidad_medida, stock_actual, stock_minimo) VALUES (${t}, 'Insumo ${m}', 'unidad', 1, 5) RETURNING id),
			masa AS (INSERT INTO productos (tenant_id, nombre, unidad_medida, stock_actual) VALUES (${t}, 'Masa', 'unidad', 10) RETURNING id),
			s AS (INSERT INTO pizza_sabores (tenant_id, nombre, precio_porcion) VALUES (${t}, 'Sabor ${m}', 5000) RETURNING id),
			l AS (INSERT INTO lineas_gastronomicas (tenant_id, codigo, nombre) VALUES (${t}, 'burger', 'Linea ${m}') RETURNING id),
			cfg AS (INSERT INTO rubros_config (tenant_id, nombre_negocio) VALUES (${t}, 'Negocio ${m}') RETURNING id),
			tu AS (INSERT INTO turnos (tenant_id, monto, transferencias, descripcion, fecha) VALUES (${t}, ${monto}, 0, 'Turno ${m}', now() - interval '1 hour') RETURNING id)
			SELECT (SELECT id FROM u) u, (SELECT id FROM p) p, (SELECT id FROM c) c, (SELECT id FROM s) s, (SELECT id FROM l) l, 0 i, (SELECT id FROM tu) tu, 0 g, 0 mc`);
		const row = r.rows[0];
		const it = await pg.query<{ id: number }>(
			`INSERT INTO items_linea (tenant_id, linea_id, nombre, precio_venta) VALUES (${t}, ${row.l}, 'Plato ${m}', 18000) RETURNING id`
		);
		const g = await pg.query<{ id: number }>(
			`INSERT INTO gastos (tenant_id, turno_id, descripcion, monto, fecha) VALUES (${t}, ${row.tu}, 'Gasto ${m}', 5000, now() - interval '1 hour') RETURNING id`
		);
		const mc = await pg.query<{ id: number }>(
			`INSERT INTO movimientos_contables (tenant_id, tipo, categoria, descripcion, monto, fecha) VALUES (${t}, 'gasto', 'arriendo', 'Arriendo ${m}', 100000, now() - interval '1 hour') RETURNING id`
		);
		await pg.exec(`
			INSERT INTO movimientos_inventario (tenant_id, producto_id, tipo, cantidad, costo_total, fecha) VALUES (${t}, ${row.p}, 'entrada', 1, 9999, now() - interval '1 hour');
			INSERT INTO cierres_dia (tenant_id, total_efectivo, fecha) VALUES (${t}, ${monto}, now() - interval '1 hour');
			INSERT INTO cortes_semanales (tenant_id, total_calculado, fecha_corte) VALUES (${t}, ${monto}, now() - interval '1 hour');
			INSERT INTO suscripciones_modulo (tenant_id, modulo, vigente_hasta, precio_mensual_cents)
				SELECT ${t}, codigo, current_date + 30, precio_mensual_cents FROM modulos_catalogo;
		`);
		const pre = t === 1 ? 'a' : 'b';
		Object.assign(ids, {
			[`${pre}User`]: row.u,
			[`${pre}Producto`]: row.p,
			[`${pre}Categoria`]: row.c,
			[`${pre}Sabor`]: row.s,
			[`${pre}Linea`]: row.l,
			[`${pre}Item`]: it.rows[0].id,
			[`${pre}Gasto`]: g.rows[0].id,
			[`${pre}Mov`]: mc.rows[0].id
		});
	}
});

const ENT = {
	estadoCore: 'al-dia' as const,
	modulos: ['estado-resultados', 'finanzas-avanzadas', 'produccion'],
	coreVigenteHasta: '2099-01-01',
	diasParaVencer: 30,
	diasGraciaRestantes: null
};
function localsB() {
	return {
		user: {
			id: ids.bUser,
			tenantId: B.tenant,
			nombre: 'admin',
			rol: 'jefe',
			passwordHash: 'x',
			createdAt: null
		},
		session: null,
		tenant: {
			id: B.tenant,
			codigo: 'resto-b',
			nombre: 'Restaurante B',
			estado: 'activo',
			diasGracia: 5
		},
		entitlements: ENT,
		platformAdmin: null
	};
}
function evento(path: string, form?: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(form ?? {})) fd.append(k, v);
	return {
		locals: localsB(),
		url: new URL(`http://test${path}`),
		params: {},
		cookies: { get: () => undefined, set: () => {}, delete: () => {} },
		request: new Request(`http://test${path}`, form ? { method: 'POST', body: fd } : undefined),
		getClientAddress: () => '127.0.0.1'
	} as never;
}

type Ruta = { load?: (e: never) => unknown; actions?: Record<string, (e: never) => unknown> };
const RUTAS: Record<string, () => Promise<Ruta>> = {
	'/dashboard': () => import('../src/routes/dashboard/+page.server'),
	'/bodega': () => import('../src/routes/bodega/+page.server'),
	'/productos': () => import('../src/routes/productos/+page.server'),
	'/configuracion/categorias': () => import('../src/routes/configuracion/categorias/+page.server'),
	'/configuracion/sabores': () => import('../src/routes/configuracion/sabores/+page.server'),
	'/configuracion/personal': () => import('../src/routes/configuracion/personal/+page.server'),
	'/configuracion/rubros': () => import('../src/routes/configuracion/rubros/+page.server'),
	'/turnos/cierre': () => import('../src/routes/turnos/cierre/+page.server'),
	'/finanzas/caja': () => import('../src/routes/finanzas/caja/+page.server'),
	'/finanzas/semanal': () => import('../src/routes/finanzas/semanal/+page.server'),
	'/finanzas/mensual': () => import('../src/routes/finanzas/mensual/+page.server'),
	'/finanzas/resumen': () => import('../src/routes/finanzas/resumen/+page.server'),
	'/finanzas/estado-resultados': () =>
		import('../src/routes/finanzas/estado-resultados/+page.server'),
	'/reportes/produccion': () => import('../src/routes/reportes/produccion/+page.server'),
	'/modulos': () => import('../src/routes/modulos/+page.server'),
	'/facturacion': () => import('../src/routes/facturacion/+page.server')
};

/** Rastros de A que nunca deben verse desde B. */
const RASTROS_A = [A.marca, '777777', 'resto-a'];

describe('aislamiento entre restaurantes: páginas', () => {
	for (const [path, cargar] of Object.entries(RUTAS)) {
		it(`${path} no muestra datos de otro restaurante`, async () => {
			const mod = await cargar();
			const data = JSON.stringify(await mod.load!(evento(path)));
			for (const r of RASTROS_A) expect(data, `${path} filtra "${r}"`).not.toContain(r);
		});
	}

	it('el layout (alertas de stock y negocio) tampoco', async () => {
		const mod = await import('../src/routes/+layout.server');
		const data = JSON.stringify(await mod.load(evento('/dashboard')));
		for (const r of RASTROS_A) expect(data).not.toContain(r);
		expect(data).toContain('Insumo b'); // sí ve su propia alerta de stock
	});
});

const filaA = async (tabla: string, id: number) =>
	(await pg.query(`SELECT * FROM ${tabla} WHERE id = ${id}`)).rows[0];
const status = (r: unknown) => (r as { status?: number })?.status;

describe('aislamiento entre restaurantes: acciones con ids de otro restaurante', () => {
	const intentos: [string, string, string, () => Record<string, string>, string, () => number][] = [
		[
			'/productos',
			'update',
			'editar producto',
			() => ({
				id: String(ids.aProducto),
				nombre: 'HACK',
				unidadMedida: 'unidad',
				precio: '1',
				stockMinimo: '1'
			}),
			'productos',
			() => ids.aProducto
		],
		[
			'/productos',
			'delete',
			'borrar producto',
			() => ({ id: String(ids.aProducto) }),
			'productos',
			() => ids.aProducto
		],
		[
			'/configuracion/categorias',
			'update',
			'editar categoría',
			() => ({ id: String(ids.aCategoria), nombre: 'HACK' }),
			'categorias',
			() => ids.aCategoria
		],
		[
			'/configuracion/categorias',
			'delete',
			'borrar categoría',
			() => ({ id: String(ids.aCategoria) }),
			'categorias',
			() => ids.aCategoria
		],
		[
			'/configuracion/sabores',
			'toggle',
			'desactivar sabor',
			() => ({ id: String(ids.aSabor) }),
			'pizza_sabores',
			() => ids.aSabor
		],
		[
			'/configuracion/sabores',
			'delete',
			'borrar sabor',
			() => ({ id: String(ids.aSabor) }),
			'pizza_sabores',
			() => ids.aSabor
		],
		[
			'/configuracion/personal',
			'update',
			'editar usuario',
			() => ({ id: String(ids.aUser), nombre: 'HACK', rol: 'cajero' }),
			'usuarios',
			() => ids.aUser
		],
		[
			'/configuracion/personal',
			'delete',
			'borrar usuario',
			() => ({ id: String(ids.aUser) }),
			'usuarios',
			() => ids.aUser
		],
		[
			'/configuracion/rubros',
			'actualizarItem',
			'editar plato',
			() => ({ id: String(ids.aItem), nombre: 'HACK', precio_venta: '1000' }),
			'items_linea',
			() => ids.aItem
		],
		[
			'/configuracion/rubros',
			'toggleItem',
			'pausar plato',
			() => ({ id: String(ids.aItem) }),
			'items_linea',
			() => ids.aItem
		],
		[
			'/configuracion/rubros',
			'eliminarItem',
			'borrar plato',
			() => ({ id: String(ids.aItem) }),
			'items_linea',
			() => ids.aItem
		],
		[
			'/configuracion/rubros',
			'actualizarControl',
			'cambiar insumo de control',
			() => ({ linea_id: String(ids.aLinea), producto_control_id: String(ids.bProducto) }),
			'lineas_gastronomicas',
			() => ids.aLinea
		],
		[
			'/finanzas/estado-resultados',
			'anular',
			'anular movimiento contable',
			() => ({ id: String(ids.aMov) }),
			'movimientos_contables',
			() => ids.aMov
		],
		[
			'/finanzas/estado-resultados',
			'categorizar',
			'recategorizar gasto',
			() => ({ id: String(ids.aGasto), categoria: 'nomina' }),
			'gastos',
			() => ids.aGasto
		]
	];

	for (const [path, accion, desc, form, tabla, idA] of intentos) {
		it(`no puede ${desc} de otro restaurante`, async () => {
			const antes = await filaA(tabla, idA());
			const mod = await RUTAS[path]();
			const r = await mod.actions![accion](evento(path, form()));
			expect(status(r), `${path}?/${accion}`).toBe(404);
			expect(await filaA(tabla, idA())).toEqual(antes);
		});
	}

	it('no puede colgar un plato en la línea de otro restaurante', async () => {
		const mod = await RUTAS['/configuracion/rubros']();
		const r = await mod.actions!.crearItem(
			evento('/configuracion/rubros', {
				linea_id: String(ids.aLinea),
				nombre: 'HACK',
				precio_venta: '1000'
			})
		);
		expect(status(r)).toBe(404);
		expect((await pg.query(`SELECT 1 FROM items_linea WHERE nombre = 'HACK'`)).rows).toHaveLength(
			0
		);
	});

	it('no puede registrar compras sobre el inventario de otro restaurante', async () => {
		const antes = await filaA('productos', ids.aProducto);
		const mod = await RUTAS['/bodega']();
		const r = await mod.actions!.default(
			evento('/bodega', {
				tipo_operacion: 'entrada',
				tipo_insumo: String(ids.aProducto),
				cantidad: '5',
				precioTotalCompra: '1000'
			})
		);
		expect(status(r)).toBe(404);
		expect(await filaA('productos', ids.aProducto)).toEqual(antes);
	});

	it('no puede asignar a su producto una categoría de otro restaurante', async () => {
		const mod = await RUTAS['/productos']();
		const r = await mod.actions!.create(
			evento('/productos', {
				nombre: 'Nuevo',
				unidadMedida: 'unidad',
				precio: '1',
				stockMinimo: '1',
				categoriaId: String(ids.aCategoria)
			})
		);
		expect(status(r)).toBe(400);
	});

	it('lo que B crea queda en B (y A no lo ve)', async () => {
		const mod = await RUTAS['/configuracion/categorias']();
		await mod.actions!.create(evento('/configuracion/categorias', { nombre: 'Solo de B' }));
		const r = await pg.query<{ tenant_id: number }>(
			`SELECT tenant_id FROM categorias WHERE nombre = 'Solo de B'`
		);
		expect(r.rows).toEqual([{ tenant_id: B.tenant }]);
	});

	it('el cierre de turno de B solo toca el inventario y los turnos de B', async () => {
		const antes = await pg.query(
			`SELECT id, stock_actual FROM productos WHERE tenant_id = ${A.tenant} ORDER BY id`
		);
		const mod = await RUTAS['/turnos/cierre']();
		const r = (await mod.actions!.default(
			evento('/turnos/cierre', {
				monto: '50000',
				nequi: '0',
				masas_sobrantes: '2',
				porciones_sobrantes: '0',
				porciones_mermadas: '0',
				[`linea_${ids.bLinea}_sobrantes`]: '0'
			})
		)) as { success?: boolean; turnoId?: number };
		expect(r.success, JSON.stringify(r)).toBe(true);
		const t = await pg.query<{ tenant_id: number }>(
			`SELECT tenant_id FROM turnos WHERE id = ${r.turnoId}`
		);
		expect(t.rows[0].tenant_id).toBe(B.tenant);
		const despues = await pg.query(
			`SELECT id, stock_actual FROM productos WHERE tenant_id = ${A.tenant} ORDER BY id`
		);
		expect(despues.rows).toEqual(antes.rows);
	});
});
