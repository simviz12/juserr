/**
 * Migración ADITIVA: módulo Estado de Resultados.
 * Es idempotente (IF NOT EXISTS) y no borra ni modifica datos existentes.
 *
 *   node scripts/migrate-estado-resultados.mjs
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql.transaction([
	// Categoría contable de cada gasto de caja (null = clasificación automática por concepto)
	sql`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS categoria text`,
	sql`CREATE TABLE IF NOT EXISTS movimientos_contables (
		id serial PRIMARY KEY,
		tipo text NOT NULL CHECK (tipo IN ('devolucion', 'descuento', 'otro_ingreso', 'gasto')),
		categoria text,
		descripcion text NOT NULL,
		monto numeric(14, 2) NOT NULL CHECK (monto > 0),
		fecha timestamp NOT NULL,
		estado text NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'anulado')),
		usuario_id integer REFERENCES usuarios(id),
		anulado_por integer REFERENCES usuarios(id),
		anulado_en timestamp,
		created_at timestamp DEFAULT now()
	)`,
	sql`CREATE INDEX IF NOT EXISTS movimientos_contables_fecha_idx ON movimientos_contables (fecha)`,
	// Índices por fecha para los reportes por rango (antes eran recorridos completos de tabla)
	sql`CREATE INDEX IF NOT EXISTS turnos_fecha_idx ON turnos (fecha)`,
	sql`CREATE INDEX IF NOT EXISTS gastos_fecha_idx ON gastos (fecha)`,
	sql`CREATE INDEX IF NOT EXISTS movimientos_inventario_fecha_idx ON movimientos_inventario (fecha)`
]);

console.log('Migración aplicada: gastos.categoria, movimientos_contables e índices por fecha.');
