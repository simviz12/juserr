-- ═══════════════════════════════════════════════════════════════════════
-- 0001 · Multi-restaurante (tenants) + módulos de pago.
--
-- Aditiva y segura sobre una base mono-restaurante existente:
--   * Crea las tablas de plataforma y el catálogo de módulos.
--   * Crea el restaurante #1 y le asigna TODOS los datos existentes.
--   * Agrega tenant_id NOT NULL a las tablas de negocio.
--   * Activa Core + add-ons para el restaurante #1 (cliente fundador).
-- El runner (scripts/migrate.mjs) la ejecuta en UNA transacción: o se aplica
-- completa o no cambia nada.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
	id serial PRIMARY KEY,
	codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	nombre text NOT NULL,
	estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'cancelado')),
	dias_gracia integer NOT NULL DEFAULT 5 CHECK (dias_gracia BETWEEN 0 AND 60),
	limite_usuarios integer CHECK (limite_usuarios > 0),
	contacto_nombre text,
	contacto_telefono text,
	contacto_email text,
	created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modulos_catalogo (
	codigo text PRIMARY KEY,
	nombre text NOT NULL,
	descripcion text NOT NULL DEFAULT '',
	precio_mensual_cents bigint NOT NULL CHECK (precio_mensual_cents >= 0),
	es_core boolean NOT NULL DEFAULT false,
	publico boolean NOT NULL DEFAULT true,
	orden integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS platform_admins (
	id serial PRIMARY KEY,
	email text NOT NULL UNIQUE,
	nombre text NOT NULL,
	password_hash text NOT NULL,
	created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_sesiones (
	id text PRIMARY KEY,
	admin_id integer NOT NULL REFERENCES platform_admins(id),
	expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS suscripciones_modulo (
	tenant_id integer NOT NULL REFERENCES tenants(id),
	modulo text NOT NULL REFERENCES modulos_catalogo(codigo),
	estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
	vigente_hasta date NOT NULL,
	precio_mensual_cents bigint NOT NULL CHECK (precio_mensual_cents >= 0),
	created_at timestamp DEFAULT now(),
	updated_at timestamp DEFAULT now(),
	PRIMARY KEY (tenant_id, modulo)
);

CREATE TABLE IF NOT EXISTS pagos (
	id serial PRIMARY KEY,
	tenant_id integer NOT NULL REFERENCES tenants(id),
	monto_cents bigint NOT NULL CHECK (monto_cents >= 0),
	detalle jsonb NOT NULL,
	metodo text NOT NULL,
	referencia text,
	nota text,
	registrado_por integer REFERENCES platform_admins(id),
	created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pagos_tenant_idx ON pagos (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS solicitudes_modulo (
	id serial PRIMARY KEY,
	tenant_id integer NOT NULL REFERENCES tenants(id),
	modulo text NOT NULL REFERENCES modulos_catalogo(codigo),
	estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida', 'descartada')),
	solicitado_por integer,
	created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria_plataforma (
	id serial PRIMARY KEY,
	admin_id integer REFERENCES platform_admins(id),
	tenant_id integer REFERENCES tenants(id),
	accion text NOT NULL,
	detalle jsonb,
	created_at timestamp DEFAULT now()
);

-- ── Catálogo inicial (precios en centavos de COP; editables en la consola) ──
INSERT INTO modulos_catalogo (codigo, nombre, descripcion, precio_mensual_cents, es_core, orden) VALUES
	('core', 'Plan Core', 'Cierre de turno con arqueo de caja, bodega e inventario, productos, caja diaria, dashboard, personal y configuración.', 6900000, true, 0),
	('finanzas-avanzadas', 'Finanzas avanzadas', 'Resumen financiero por rango, corte semanal, reporte mensual y exportación a PDF y Excel.', 2500000, false, 10),
	('estado-resultados', 'Estado de Resultados', 'Pérdidas y ganancias en cascada con márgenes, comparativos, desglose por línea y exportación.', 2900000, false, 20),
	('produccion', 'Reporte de producción', 'Producción y ventas por línea y por plato, con exportación a Excel.', 1500000, false, 30)
ON CONFLICT (codigo) DO NOTHING;

-- ── Restaurante #1: dueño de todos los datos existentes ──
INSERT INTO tenants (id, codigo, nombre, limite_usuarios)
SELECT 1,
	COALESCE(NULLIF(trim(BOTH '-' FROM regexp_replace(translate(lower(n.nombre), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '-', 'g')), ''), 'restaurante'),
	n.nombre,
	-- Se conserva el límite de usuarios del plan anterior (sin límite si no había).
	(SELECT limite_usuarios FROM saas_suscripciones WHERE limite_usuarios > 0 ORDER BY id LIMIT 1)
FROM (SELECT COALESCE((SELECT nombre_negocio FROM rubros_config ORDER BY id LIMIT 1), 'Mi restaurante') AS nombre) n
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 1);
SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT max(id) FROM tenants), 1));

-- ── tenant_id en todas las tablas de negocio ──
DO $$
DECLARE
	t text;
BEGIN
	FOREACH t IN ARRAY ARRAY[
		'usuarios', 'categorias', 'productos', 'movimientos_inventario', 'bebidas', 'movimientos_bebidas',
		'pizza_sabores', 'pizza_ruedas', 'pizza_sobras', 'pizza_ventas', 'turnos', 'transacciones_turno',
		'gastos', 'cierres_dia', 'cortes_semanales', 'rubros_config', 'lineas_gastronomicas', 'items_linea',
		'cierres_linea', 'ventas_items', 'movimientos_contables'
	] LOOP
		EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id)', t);
		EXECUTE format('UPDATE %I SET tenant_id = 1 WHERE tenant_id IS NULL', t);
		EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
	END LOOP;
END $$;

-- ── Unicidades: pasan de globales a "por restaurante" ──
ALTER TABLE lineas_gastronomicas DROP CONSTRAINT IF EXISTS lineas_gastronomicas_codigo_key;
ALTER TABLE lineas_gastronomicas DROP CONSTRAINT IF EXISTS lineas_gastronomicas_codigo_unique;
CREATE UNIQUE INDEX IF NOT EXISTS lineas_gastronomicas_tenant_codigo_uq ON lineas_gastronomicas (tenant_id, codigo);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_tenant_nombre_uq ON usuarios (tenant_id, lower(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS rubros_config_tenant_uq ON rubros_config (tenant_id);

-- ── Índices: toda consulta filtra por restaurante (y casi siempre por fecha) ──
DROP INDEX IF EXISTS turnos_fecha_idx;
DROP INDEX IF EXISTS gastos_fecha_idx;
DROP INDEX IF EXISTS movimientos_inventario_fecha_idx;
DROP INDEX IF EXISTS movimientos_contables_fecha_idx;
DROP INDEX IF EXISTS cierres_linea_fecha_idx;
DROP INDEX IF EXISTS ventas_items_fecha_idx;
CREATE INDEX IF NOT EXISTS categorias_tenant_idx ON categorias (tenant_id);
CREATE INDEX IF NOT EXISTS productos_tenant_idx ON productos (tenant_id);
CREATE INDEX IF NOT EXISTS pizza_sabores_tenant_idx ON pizza_sabores (tenant_id);
CREATE INDEX IF NOT EXISTS items_linea_tenant_idx ON items_linea (tenant_id);
CREATE INDEX IF NOT EXISTS movimientos_inventario_tenant_fecha_idx ON movimientos_inventario (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS pizza_ventas_tenant_fecha_idx ON pizza_ventas (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS turnos_tenant_fecha_idx ON turnos (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS transacciones_turno_tenant_fecha_idx ON transacciones_turno (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS gastos_tenant_fecha_idx ON gastos (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS cierres_dia_tenant_fecha_idx ON cierres_dia (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS cortes_semanales_tenant_fecha_idx ON cortes_semanales (tenant_id, fecha_corte);
CREATE INDEX IF NOT EXISTS cierres_linea_tenant_fecha_idx ON cierres_linea (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS ventas_items_tenant_fecha_idx ON ventas_items (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS movimientos_contables_tenant_fecha_idx ON movimientos_contables (tenant_id, fecha);
-- Se conservan los índices por turno (cierres_linea_turno_idx, ventas_items_turno_idx).

-- ── Restaurante #1: Core + todos los add-ons, pagados por 30 días ──
-- Registra su pago en la consola /plataforma antes de que venza.
INSERT INTO suscripciones_modulo (tenant_id, modulo, vigente_hasta, precio_mensual_cents)
SELECT 1, codigo, (now() AT TIME ZONE 'America/Bogota')::date + 30, precio_mensual_cents
FROM modulos_catalogo
WHERE es_core OR publico          -- nunca módulos a medida/exclusivos de otros restaurantes
ON CONFLICT (tenant_id, modulo) DO NOTHING;
