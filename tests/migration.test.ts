/**
 * Ensayo de migrations/0001_multitenant.sql sobre una copia del esquema de
 * producción anterior (tests/fixtures/legacy-schema.sql) con datos.
 * Garantiza que la migración:
 *   1. no pierde ni altera datos y asigna todo al restaurante #1;
 *   2. deja la base EXACTAMENTE como la describe src/lib/server/schema.ts;
 *   3. es idempotente (correrla dos veces no rompe nada).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../src/lib/server/schema';

const legacy = readFileSync(new URL('./fixtures/legacy-schema.sql', import.meta.url), 'utf8');
const migracion = readFileSync(
	new URL('../migrations/0001_multitenant.sql', import.meta.url),
	'utf8'
);

const TABLAS_NEGOCIO = [
	'usuarios',
	'categorias',
	'productos',
	'movimientos_inventario',
	'bebidas',
	'movimientos_bebidas',
	'pizza_sabores',
	'pizza_ruedas',
	'pizza_sobras',
	'pizza_ventas',
	'turnos',
	'transacciones_turno',
	'gastos',
	'cierres_dia',
	'cortes_semanales',
	'rubros_config',
	'lineas_gastronomicas',
	'items_linea',
	'cierres_linea',
	'ventas_items',
	'movimientos_contables'
];

/**
 * "Huella" del esquema: columnas (tipo, nulabilidad, default), restricciones
 * (por definición, sin importar el nombre autogenerado) e índices (por nombre y
 * definición). Dos bases con la misma huella se comportan igual.
 */
async function huella(db: PGlite) {
	const columnas = await db.query<{ v: string }>(`
		SELECT table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') AS v
		FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_migraciones'`);
	const restricciones = await db.query<{ v: string }>(`
		SELECT conrelid::regclass::text || ' ' || pg_get_constraintdef(oid) AS v
		FROM pg_constraint WHERE connamespace = 'public'::regnamespace`);
	const indices = await db.query<{ v: string }>(`
		SELECT indexdef AS v FROM pg_indexes
		WHERE schemaname = 'public' AND indexname NOT IN (SELECT conname FROM pg_constraint)`);
	const ordenar = (r: { rows: { v: string }[] }) => r.rows.map((x) => x.v).sort();
	return {
		columnas: ordenar(columnas),
		restricciones: ordenar(restricciones),
		indices: ordenar(indices)
	};
}

async function conteos(pg: PGlite) {
	const out: Record<string, number> = {};
	for (const t of TABLAS_NEGOCIO) {
		const r = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
		out[t] = r.rows[0].n;
	}
	return out;
}

let pg: PGlite;
let antes: Record<string, number>;

beforeAll(async () => {
	pg = new PGlite();
	await pg.exec(legacy.replaceAll('--> statement-breakpoint', ''));
	// Datos como los de producción (un restaurante con historia)
	await pg.exec(`
		INSERT INTO rubros_config (nombre_negocio) VALUES ('ChuzoOS GastroFlow Gourmet');
		INSERT INTO usuarios (nombre, password_hash, rol) VALUES ('admin', 'x', 'jefe'), ('Cajera', 'x', 'empleado');
		INSERT INTO sesiones (id, user_id, expires_at) VALUES ('s1', 1, now() + interval '1 day');
		INSERT INTO categorias (nombre) VALUES ('Carnes');
		INSERT INTO productos (nombre, categoria_id, unidad_medida) VALUES ('Masa', 1, 'unidad'), ('Pan', 1, 'unidad');
		INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, costo_total) VALUES (2, 1, 'entrada', 10, 25000.50);
		INSERT INTO pizza_sabores (nombre) VALUES ('Hawaiana');
		INSERT INTO turnos (monto, transferencias) VALUES (350000.25, 120000);
		INSERT INTO transacciones_turno (turno_id, plataforma, monto) VALUES (1, 'nequi', 120000);
		INSERT INTO gastos (turno_id, descripcion, monto) VALUES (1, 'Hielo', 12000);
		INSERT INTO pizza_ventas (sabor_id, turno_id, cantidad_vendida) VALUES (1, 1, 16);
		INSERT INTO lineas_gastronomicas (codigo, nombre, producto_control_id) VALUES ('burger', 'Hamburguesas', 2);
		INSERT INTO items_linea (linea_id, nombre, precio_venta) VALUES (1, 'Clásica', 18000);
		INSERT INTO cierres_linea (turno_id, linea_id, inicial, sobrantes, consumidas) VALUES (1, 1, 10, 4, 6);
		INSERT INTO ventas_items (turno_id, item_id, linea_id, cantidad, precio_unitario) VALUES (1, 1, 1, 6, 18000);
		INSERT INTO cierres_dia (total_efectivo) VALUES (350000);
		INSERT INTO cortes_semanales (total_calculado) VALUES (470000);
		INSERT INTO movimientos_contables (tipo, descripcion, monto, fecha) VALUES ('gasto', 'Arriendo', 1200000, now());
		INSERT INTO saas_suscripciones (plan_codigo) VALUES ('pro');
	`);
	antes = await conteos(pg);
	await pg.exec(migracion);
});

describe('migración 0001 multi-restaurante', () => {
	it('crea el restaurante #1 con un código válido derivado del nombre', async () => {
		const r = await pg.query<{ id: number; codigo: string; nombre: string }>(
			'SELECT id, codigo, nombre FROM tenants'
		);
		expect(r.rows).toEqual([
			{ id: 1, codigo: 'chuzoos-gastroflow-gourmet', nombre: 'ChuzoOS GastroFlow Gourmet' }
		]);
	});

	it('no pierde datos y asigna todo al restaurante #1', async () => {
		expect(await conteos(pg)).toEqual(antes);
		for (const t of TABLAS_NEGOCIO) {
			const r = await pg.query<{ n: number }>(
				`SELECT count(*)::int AS n FROM ${t} WHERE tenant_id IS DISTINCT FROM 1`
			);
			expect(r.rows[0].n, t).toBe(0);
		}
		const monto = await pg.query<{ monto: string }>('SELECT monto FROM turnos WHERE id = 1');
		expect(monto.rows[0].monto).toBe('350000.25');
		const sesiones = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM sesiones');
		expect(sesiones.rows[0].n).toBe(1); // nadie pierde la sesión
	});

	it('activa Core y los add-ons del restaurante #1 por 30 días', async () => {
		const r = await pg.query<{ modulo: string; dias: number }>(
			`SELECT modulo, (vigente_hasta - (now() AT TIME ZONE 'America/Bogota')::date) AS dias
			 FROM suscripciones_modulo WHERE tenant_id = 1 ORDER BY modulo`
		);
		expect(r.rows.map((x) => x.modulo)).toEqual([
			'core',
			'estado-resultados',
			'finanzas-avanzadas',
			'produccion'
		]);
		expect(r.rows.every((x) => x.dias === 30)).toBe(true);
	});

	it('hace las unicidades por restaurante (otro restaurante puede repetir código de línea y usuario)', async () => {
		await pg.exec(`
			INSERT INTO tenants (codigo, nombre) VALUES ('otro', 'Otro');
			INSERT INTO lineas_gastronomicas (tenant_id, codigo, nombre) VALUES (2, 'burger', 'Burgers del otro');
			INSERT INTO usuarios (tenant_id, nombre, password_hash) VALUES (2, 'ADMIN', 'x');
		`);
		await expect(
			pg.exec(`INSERT INTO usuarios (tenant_id, nombre, password_hash) VALUES (2, 'Admin', 'x')`)
		).rejects.toThrow();
		await expect(
			pg.exec(
				`INSERT INTO lineas_gastronomicas (tenant_id, codigo, nombre) VALUES (2, 'burger', 'x')`
			)
		).rejects.toThrow();
		await expect(pg.exec(`INSERT INTO turnos (monto) VALUES (1)`)).rejects.toThrow(/tenant_id/);
	});

	it('es idempotente', async () => {
		await expect(pg.exec(migracion)).resolves.toBeDefined();
		expect((await pg.query('SELECT 1 FROM tenants WHERE id = 1')).rows).toHaveLength(1);
	});

	it('deja la base idéntica a src/lib/server/schema.ts', async () => {
		// Base de referencia creada directamente desde schema.ts
		const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
		const ref = new PGlite();
		for (const stmt of ddl) await ref.exec(stmt);

		const [migrada, esperada] = await Promise.all([huella(pg), huella(ref)]);
		// Lo insertado por la prueba de unicidades no afecta la estructura.
		expect(migrada.columnas).toEqual(esperada.columnas);
		expect(migrada.restricciones).toEqual(esperada.restricciones);
		expect(migrada.indices).toEqual(esperada.indices);
	});
});
