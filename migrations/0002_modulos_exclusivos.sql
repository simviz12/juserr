-- ═══════════════════════════════════════════════════════════════════════
-- 0002 · Módulos EXCLUSIVOS (funciones hechas a pedido de un restaurante).
--
-- Un módulo con exclusivo_tenant_id solo puede pertenecer a ese restaurante:
--   * no es público ni es Core (CHECK);
--   * la base de datos rechaza activárselo a cualquier otro (trigger),
--     aunque se intente por error desde la consola o un script.
-- Aditiva e idempotente.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE modulos_catalogo ADD COLUMN IF NOT EXISTS exclusivo_tenant_id integer REFERENCES tenants(id);

ALTER TABLE modulos_catalogo DROP CONSTRAINT IF EXISTS modulos_catalogo_exclusivo_check;
ALTER TABLE modulos_catalogo ADD CONSTRAINT modulos_catalogo_exclusivo_check
	CHECK (exclusivo_tenant_id IS NULL OR (publico = false AND es_core = false));

CREATE OR REPLACE FUNCTION verificar_modulo_exclusivo() RETURNS trigger AS $$
DECLARE
	dueno integer;
BEGIN
	SELECT exclusivo_tenant_id INTO dueno FROM modulos_catalogo WHERE codigo = NEW.modulo;
	IF dueno IS NOT NULL AND dueno <> NEW.tenant_id THEN
		RAISE EXCEPTION 'El módulo "%" es exclusivo de otro restaurante', NEW.modulo
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS suscripciones_modulo_exclusivo ON suscripciones_modulo;
CREATE TRIGGER suscripciones_modulo_exclusivo
	BEFORE INSERT OR UPDATE ON suscripciones_modulo
	FOR EACH ROW EXECUTE FUNCTION verificar_modulo_exclusivo();
