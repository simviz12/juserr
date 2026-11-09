import { db } from '$lib/server/db';
import { rubrosConfig } from '$lib/server/schema';
import { BRAND } from '$lib/config/brand';

export type BusinessConfig = typeof rubrosConfig.$inferSelect;

const DEFAULTS: Omit<BusinessConfig, 'id' | 'createdAt'> = {
	nombreNegocio: BRAND.name,
	rubroPrincipal: 'mixto',
	habilitarPizzas: true,
	habilitarChuzos: true,
	habilitarHamburguesas: true,
	habilitarLasanas: true,
	habilitarCarnes: true
};

/** Configuración del negocio (fila única). Nunca falla: si no existe, devuelve valores por defecto. */
export async function getBusinessConfig(): Promise<BusinessConfig> {
	try {
		const [row] = await db.select().from(rubrosConfig).limit(1);
		if (row) return row;
	} catch (e) {
		console.error('No se pudo leer rubros_config:', e);
	}
	return { id: 0, createdAt: null, ...DEFAULTS };
}
