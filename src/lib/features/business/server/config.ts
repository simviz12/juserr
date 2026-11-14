import { db } from '$lib/server/db';
import { rubrosConfig } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { BRAND } from '$lib/config/brand';

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
 * Configuración del restaurante (una fila por tenant). Nunca falla: si no
 * existe o la BD no responde, devuelve valores por defecto.
 */
export async function getBusinessConfig(tenantId: number): Promise<BusinessConfig> {
	try {
		const [row] = await db
			.select()
			.from(rubrosConfig)
			.where(eq(rubrosConfig.tenantId, tenantId))
			.limit(1);
		if (row) return row;
	} catch (e) {
		console.error('No se pudo leer rubros_config:', e);
	}
	return { id: 0, createdAt: null, tenantId, ...DEFAULTS };
}
