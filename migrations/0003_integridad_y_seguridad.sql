-- ═══════════════════════════════════════════════════════════════════════
-- 0003 · Integridad de datos, rendimiento y endurecimiento de seguridad.
--
--   * Freno de login compartido (intentos_login) y segundo factor (TOTP)
--     para la consola de plataforma.
--   * Caducidad absoluta de sesiones (sesiones.created_at).
--   * Cantidades exactas: real (float4) → numeric(12,3). Dinero: numeric(10,2)
--     (tope ~100 millones) → numeric(14,2).
--   * Doble envío: idempotencia del cierre de turno, un cierre de caja por
--     día, una solicitud pendiente por módulo, comprobantes Nequi únicos.
--   * Índices para las consultas por turno, usuario y producto.
--   * CHECKs de movimientos_contables iguales a los que ya tiene producción.
--
-- Aditiva e idempotente. Si hay duplicados que impiden un índice único de
-- productos o cierres_dia, NO se borra nada: se avisa (WARNING) y se omite
-- ese índice para que una persona revise los datos.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Seguridad ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intentos_login (
	clave text PRIMARY KEY NOT NULL,
	fallos integer DEFAULT 0 NOT NULL,
	desde timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS totp_secret text;

-- Las sesiones existentes cuentan desde hoy para la caducidad absoluta.
ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS sesiones_user_idx ON sesiones USING btree (user_id);
CREATE INDEX IF NOT EXISTS platform_sesiones_admin_idx ON platform_sesiones USING btree (admin_id);
CREATE INDEX IF NOT EXISTS auditoria_plataforma_tenant_idx ON auditoria_plataforma USING btree (tenant_id, created_at);

-- ── Tipos numéricos exactos ────────────────────────────────────────────
ALTER TABLE productos ALTER COLUMN stock_actual SET DATA TYPE numeric(12, 3);
ALTER TABLE productos ALTER COLUMN stock_minimo SET DATA TYPE numeric(12, 3);
ALTER TABLE productos ALTER COLUMN stock_minimo SET DEFAULT 5;
ALTER TABLE productos ALTER COLUMN precio SET DATA TYPE numeric(14, 2);
ALTER TABLE productos ALTER COLUMN precio SET DEFAULT '0';
ALTER TABLE productos ALTER COLUMN precio_costo SET DATA TYPE numeric(14, 2);
ALTER TABLE productos ALTER COLUMN precio_costo SET DEFAULT '0';

ALTER TABLE movimientos_inventario ALTER COLUMN cantidad SET DATA TYPE numeric(12, 3);
ALTER TABLE movimientos_inventario ALTER COLUMN costo_unitario SET DATA TYPE numeric(14, 2);
ALTER TABLE movimientos_inventario ALTER COLUMN costo_unitario SET DEFAULT '0';
ALTER TABLE movimientos_inventario ALTER COLUMN costo_total SET DATA TYPE numeric(14, 2);
ALTER TABLE movimientos_inventario ALTER COLUMN costo_total SET DEFAULT '0';

ALTER TABLE bebidas ALTER COLUMN precio SET DATA TYPE numeric(14, 2);

ALTER TABLE pizza_sabores ALTER COLUMN precio_porcion SET DATA TYPE numeric(14, 2);
ALTER TABLE pizza_sabores ALTER COLUMN precio_porcion SET DEFAULT '0';
ALTER TABLE pizza_sabores ALTER COLUMN precio_rueda SET DATA TYPE numeric(14, 2);
ALTER TABLE pizza_sabores ALTER COLUMN precio_rueda SET DEFAULT '0';
ALTER TABLE pizza_sobras ALTER COLUMN cantidad SET DATA TYPE numeric(12, 3);
ALTER TABLE pizza_ventas ALTER COLUMN cantidad_vendida SET DATA TYPE numeric(12, 3);

ALTER TABLE turnos ALTER COLUMN monto SET DATA TYPE numeric(14, 2);
ALTER TABLE turnos ALTER COLUMN transferencias SET DATA TYPE numeric(14, 2);
ALTER TABLE turnos ALTER COLUMN transferencias SET DEFAULT '0';
ALTER TABLE turnos ALTER COLUMN masas_iniciales SET DATA TYPE numeric(12, 3);
ALTER TABLE turnos ALTER COLUMN masas_sobrantes SET DATA TYPE numeric(12, 3);

ALTER TABLE transacciones_turno ALTER COLUMN monto SET DATA TYPE numeric(14, 2);
ALTER TABLE gastos ALTER COLUMN monto SET DATA TYPE numeric(14, 2);

ALTER TABLE cierres_dia ALTER COLUMN total_efectivo SET DATA TYPE numeric(14, 2);
ALTER TABLE cierres_dia ALTER COLUMN total_transferencias SET DATA TYPE numeric(14, 2);
ALTER TABLE cierres_dia ALTER COLUMN total_transferencias SET DEFAULT '0';
ALTER TABLE cierres_dia ALTER COLUMN total_turnos SET DATA TYPE numeric(14, 2);
ALTER TABLE cierres_dia ALTER COLUMN total_turnos SET DEFAULT '0';
ALTER TABLE cierres_dia ALTER COLUMN total_gastos SET DATA TYPE numeric(14, 2);
ALTER TABLE cierres_dia ALTER COLUMN total_gastos SET DEFAULT '0';

ALTER TABLE cortes_semanales ALTER COLUMN total_calculado SET DATA TYPE numeric(14, 2);
ALTER TABLE cortes_semanales ALTER COLUMN total_real SET DATA TYPE numeric(14, 2);
ALTER TABLE cortes_semanales ALTER COLUMN efectivo_real SET DATA TYPE numeric(14, 2);
ALTER TABLE cortes_semanales ALTER COLUMN transferencias_reales SET DATA TYPE numeric(14, 2);
ALTER TABLE cortes_semanales ALTER COLUMN diferencia SET DATA TYPE numeric(14, 2);

ALTER TABLE lineas_gastronomicas ALTER COLUMN precio_promedio SET DATA TYPE numeric(14, 2);
ALTER TABLE lineas_gastronomicas ALTER COLUMN precio_promedio SET DEFAULT '0';

ALTER TABLE items_linea ALTER COLUMN precio_venta SET DATA TYPE numeric(14, 2);
ALTER TABLE items_linea ALTER COLUMN precio_venta SET DEFAULT '0';
ALTER TABLE items_linea ALTER COLUMN precio_costo SET DATA TYPE numeric(14, 2);
ALTER TABLE items_linea ALTER COLUMN precio_costo SET DEFAULT '0';
ALTER TABLE items_linea ALTER COLUMN unidades_control SET DATA TYPE numeric(12, 3);
ALTER TABLE items_linea ALTER COLUMN unidades_control SET DEFAULT 1;

ALTER TABLE cierres_linea ALTER COLUMN inicial SET DATA TYPE numeric(12, 3);
ALTER TABLE cierres_linea ALTER COLUMN sobrantes SET DATA TYPE numeric(12, 3);
ALTER TABLE cierres_linea ALTER COLUMN mermas SET DATA TYPE numeric(12, 3);
ALTER TABLE cierres_linea ALTER COLUMN consumidas SET DATA TYPE numeric(12, 3);

ALTER TABLE ventas_items ALTER COLUMN cantidad SET DATA TYPE numeric(12, 3);
ALTER TABLE ventas_items ALTER COLUMN precio_unitario SET DATA TYPE numeric(14, 2);
ALTER TABLE ventas_items ALTER COLUMN costo_unitario SET DATA TYPE numeric(14, 2);
ALTER TABLE ventas_items ALTER COLUMN costo_unitario SET DEFAULT '0';

-- ── Doble envío e idempotencia ─────────────────────────────────────────
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS clave_idempotencia text;
CREATE UNIQUE INDEX IF NOT EXISTS turnos_tenant_clave_uq ON turnos USING btree (tenant_id, clave_idempotencia);

-- Solicitudes pendientes repetidas: se conserva la más antigua, el resto se descarta.
UPDATE solicitudes_modulo s SET estado = 'descartada'
WHERE s.estado = 'pendiente'
	AND EXISTS (
		SELECT 1 FROM solicitudes_modulo o
		WHERE o.tenant_id = s.tenant_id AND o.modulo = s.modulo
			AND o.estado = 'pendiente' AND o.id < s.id
	);
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_modulo_pendiente_uq ON solicitudes_modulo
	USING btree (tenant_id, modulo) WHERE solicitudes_modulo.estado = 'pendiente';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM cierres_dia GROUP BY tenant_id, (fecha)::date HAVING count(*) > 1
	) THEN
		RAISE WARNING 'cierres_dia tiene días con más de un cierre: se omite cierres_dia_tenant_dia_uq. Revisa los datos y vuelve a crearlo.';
	ELSE
		CREATE UNIQUE INDEX IF NOT EXISTS cierres_dia_tenant_dia_uq ON cierres_dia USING btree (tenant_id, ((fecha)::date));
	END IF;

	IF EXISTS (
		SELECT 1 FROM productos GROUP BY tenant_id, lower(nombre) HAVING count(*) > 1
	) THEN
		RAISE WARNING 'productos tiene nombres repetidos en un mismo restaurante: se omite productos_tenant_nombre_uq. Unifica los insumos duplicados y vuelve a crearlo.';
	ELSE
		CREATE UNIQUE INDEX IF NOT EXISTS productos_tenant_nombre_uq ON productos USING btree (tenant_id, lower(nombre));
	END IF;
END $$;

-- Comprobantes de pago usados (antifraude Nequi). Se llena con el historial.
CREATE TABLE IF NOT EXISTS referencias_pago (
	tenant_id integer NOT NULL REFERENCES tenants(id),
	referencia text NOT NULL,
	turno_id integer REFERENCES turnos(id),
	created_at timestamp DEFAULT now(),
	CONSTRAINT referencias_pago_tenant_id_referencia_pk PRIMARY KEY (tenant_id, referencia)
);
-- Misma regla que extractRefs(): tokens de 4+ caracteres con al menos un dígito.
INSERT INTO referencias_pago (tenant_id, referencia, turno_id)
SELECT DISTINCT ON (t.tenant_id, r.ref) t.tenant_id, r.ref, t.turno_id
FROM transacciones_turno t
CROSS JOIN LATERAL regexp_split_to_table(lower(t.referencias), '[,;\s]+') AS r(ref)
WHERE t.referencias IS NOT NULL AND length(r.ref) >= 4 AND r.ref ~ '\d'
ORDER BY t.tenant_id, r.ref, t.id
ON CONFLICT DO NOTHING;

-- ── Índices ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS turnos_tenant_id_idx ON turnos USING btree (tenant_id, id);
CREATE INDEX IF NOT EXISTS gastos_turno_idx ON gastos USING btree (turno_id);
CREATE INDEX IF NOT EXISTS transacciones_turno_turno_idx ON transacciones_turno USING btree (turno_id);
CREATE INDEX IF NOT EXISTS pizza_ruedas_turno_idx ON pizza_ruedas USING btree (turno_id);
CREATE INDEX IF NOT EXISTS pizza_sobras_turno_idx ON pizza_sobras USING btree (turno_id);
CREATE INDEX IF NOT EXISTS pizza_ventas_turno_idx ON pizza_ventas USING btree (turno_id);
CREATE INDEX IF NOT EXISTS movimientos_inventario_producto_idx ON movimientos_inventario USING btree (producto_id);
CREATE INDEX IF NOT EXISTS bebidas_tenant_idx ON bebidas USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS movimientos_bebidas_tenant_fecha_idx ON movimientos_bebidas USING btree (tenant_id, fecha);

-- ── CHECKs de movimientos_contables (producción ya los tiene) ──────────
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_contables_tipo_check') THEN
		ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_tipo_check
			CHECK (tipo IN ('devolucion', 'descuento', 'otro_ingreso', 'gasto'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_contables_monto_check') THEN
		ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_monto_check CHECK (monto > 0);
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_contables_estado_check') THEN
		ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_estado_check
			CHECK (estado IN ('confirmado', 'anulado'));
	END IF;
END $$;
