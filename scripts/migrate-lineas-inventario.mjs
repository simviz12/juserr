/**
 * Migración ADITIVA: control por inventario de todas las líneas (no solo pizzas).
 * Es idempotente (IF NOT EXISTS) y no borra ni modifica datos existentes.
 *
 *   node scripts/migrate-lineas-inventario.mjs
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

await sql.transaction([
	sql`ALTER TABLE lineas_gastronomicas ADD COLUMN IF NOT EXISTS producto_control_id integer REFERENCES productos(id)`,
	sql`ALTER TABLE items_linea ADD COLUMN IF NOT EXISTS unidades_control real DEFAULT 1`,
	sql`CREATE TABLE IF NOT EXISTS cierres_linea (
		id serial PRIMARY KEY,
		turno_id integer NOT NULL REFERENCES turnos(id),
		linea_id integer NOT NULL REFERENCES lineas_gastronomicas(id),
		producto_id integer REFERENCES productos(id),
		inicial real NOT NULL,
		sobrantes real NOT NULL,
		mermas real NOT NULL DEFAULT 0,
		consumidas real NOT NULL,
		venta_esperada numeric(12, 2) NOT NULL DEFAULT 0,
		desglose_completo boolean DEFAULT false,
		fecha timestamp DEFAULT now()
	)`,
	sql`CREATE TABLE IF NOT EXISTS ventas_items (
		id serial PRIMARY KEY,
		turno_id integer NOT NULL REFERENCES turnos(id),
		item_id integer NOT NULL REFERENCES items_linea(id),
		linea_id integer NOT NULL REFERENCES lineas_gastronomicas(id),
		cantidad real NOT NULL,
		precio_unitario numeric(10, 2) NOT NULL,
		costo_unitario numeric(10, 2) DEFAULT 0,
		fecha timestamp DEFAULT now()
	)`,
	sql`CREATE INDEX IF NOT EXISTS cierres_linea_turno_idx ON cierres_linea (turno_id)`,
	sql`CREATE INDEX IF NOT EXISTS cierres_linea_fecha_idx ON cierres_linea (fecha)`,
	sql`CREATE INDEX IF NOT EXISTS ventas_items_turno_idx ON ventas_items (turno_id)`,
	sql`CREATE INDEX IF NOT EXISTS ventas_items_fecha_idx ON ventas_items (fecha)`
]);

console.log('Migración aplicada: cierres_linea, ventas_items, producto_control_id, unidades_control.');
