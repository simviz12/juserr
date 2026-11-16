import { db } from '$lib/server/db';
import { rubrosConfig } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { BRAND } from '$lib/config/brand';
import { log } from '$lib/server/log';

export type BusinessConfig = typeof rubrosConfig.$inferSelect;

const DEFAULTS: Omit<BusinessConfig, 'id' | 'createdAt' | 'tenantId'> = {
	nombreNegocio: BRAND.name,
	rubroPrincipal: 'mixto',
	habilitarPizzas: true,
	habilitarChuzos: true,
	habilitarHamburguesas: true,
	habilitarLasanas: true,
	habilitarCarnes: true
};

/**
 * Configuración del restaurante (una fila por tenant). Si no existe, devuelve
 * valores por defecto.
 *
 * Si la BD falla:
 *   - en lecturas (pantallas) se devuelven los valores por defecto para no
 *     tumbar la página;
 *   - con `estricto: true` (acciones que ESCRIBEN, como el cierre de turno) el
 *     error se propaga: decidir con valores inventados (todas las líneas
 *     activas) podría exigir o descontar insumos de líneas desactivadas.
 */
export async function getBusinessConfig(
	tenantId: number,
	opciones: { estricto?: boolean } = {}
): Promise<BusinessConfig> {
	try {
		const [row] = await db
			.select()
			.from(rubrosConfig)
			.where(eq(rubrosConfig.tenantId, tenantId))
			.limit(1);
		if (row) return row;
	} catch (e) {
		if (opciones.estricto) throw e;
		log.warn('no se pudo leer rubros_config; se usan valores por defecto', { tenantId, err: e });
	}
	return { id: 0, createdAt: null, tenantId, ...DEFAULTS };
}
