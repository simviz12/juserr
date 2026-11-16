import { db } from '$lib/server/db';
import { productos } from '$lib/server/schema';
import { asc, inArray } from 'drizzle-orm';
import { delTenant } from '$lib/server/tenancy';
import { MASA_NAMES, MASA_NOMBRE } from '../domain/products';

export type Producto = typeof productos.$inferSelect;

/**
 * Insumo "Masa" del restaurante (el cierre de turno lo necesita). Si no existe
 * se crea. Seguro ante peticiones simultáneas: el índice único
 * (tenant_id, lower(nombre)) impide crear dos y ON CONFLICT lo ignora.
 */
export async function asegurarMasa(tid: number): Promise<Producto> {
	const buscar = () =>
		db
			.select()
			.from(productos)
			.where(delTenant(productos, tid, inArray(productos.nombre, MASA_NAMES)))
			.orderBy(asc(productos.id))
			.limit(1);
	const [existente] = await buscar();
	if (existente) return existente;
	await db
		.insert(productos)
		.values({
			tenantId: tid,
			nombre: MASA_NOMBRE,
			unidadMedida: 'unidad',
			stockActual: 0,
			precio: '0'
		})
		.onConflictDoNothing();
	const [creada] = await buscar();
	return creada;
}
