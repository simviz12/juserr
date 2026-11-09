import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { productos } from '$lib/server/schema';
import { lte } from 'drizzle-orm';
import { getBusinessConfig } from '$lib/features/business/server/config';

export interface Alerta {
	id: string;
	tipo: 'insumo' | 'bebida' | 'aviso';
	titulo: string;
	detalle: string;
	nivel: 'urgente' | 'aviso';
}

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, alertas: [] as Alerta[], negocio: null };

	const alertas: Alerta[] = [];
	const [config, insumosBajos] = await Promise.all([
		getBusinessConfig(),
		db
			.select()
			.from(productos)
			.where(lte(productos.stockActual, productos.stockMinimo))
			.limit(10)
			.catch((e) => {
				console.error('Error cargando alertas de layout:', e);
				return [];
			})
	]);

	for (const item of insumosBajos) {
		const stock = item.stockActual || 0;
		alertas.push({
			id: `insumo-${item.id}`,
			tipo: 'insumo',
			titulo: item.nombre,
			detalle:
				stock <= 0
					? `Agotado (0 ${item.unidadMedida})`
					: `Quedan ${stock} ${item.unidadMedida} · mínimo ${item.stockMinimo}`,
			nivel: stock <= 0 ? 'urgente' : 'aviso'
		});
	}

	return {
		user: locals.user,
		alertas,
		negocio: {
			nombre: config.nombreNegocio,
			rubro: config.rubroPrincipal,
			pizzas: config.habilitarPizzas ?? true
		}
	};
};
