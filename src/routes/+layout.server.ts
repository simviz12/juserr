import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { productos } from '$lib/server/schema';
import { lte } from 'drizzle-orm';
import { getBusinessConfig } from '$lib/features/business/server/config';
import { delTenant } from '$lib/server/tenancy';
import { log } from '$lib/server/log';

export interface Alerta {
	id: string;
	tipo: 'insumo' | 'bebida' | 'aviso';
	titulo: string;
	detalle: string;
	nivel: 'urgente' | 'aviso';
}

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.tenant) {
		return { user: null, alertas: [] as Alerta[], negocio: null, plan: null };
	}
	const tid = locals.tenant.id;

	const alertas: Alerta[] = [];
	const [config, insumosBajos] = await Promise.all([
		getBusinessConfig(tid),
		db
			.select()
			.from(productos)
			.where(delTenant(productos, tid, lte(productos.stockActual, productos.stockMinimo)))
			.limit(10)
			.catch((e) => {
				log.warn('no se pudieron cargar las alertas del layout', { tenantId: tid, err: e });
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
		// Solo lo que la interfaz necesita (nunca el hash de la contraseña).
		user: { id: locals.user.id, nombre: locals.user.nombre, rol: locals.user.rol },
		alertas,
		negocio: {
			nombre: config.nombreNegocio,
			codigo: locals.tenant.codigo,
			rubro: config.rubroPrincipal,
			pizzas: config.habilitarPizzas ?? true
		},
		// Plan y módulos: el menú usa la MISMA regla que el servidor (evaluarAcceso).
		plan: locals.entitlements
	};
};
