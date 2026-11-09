import { db } from '$lib/server/db';
import { lineasGastronomicas, itemsLinea, productos } from '$lib/server/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { CONTROL_POR_DEFECTO, type PlatoLinea } from '../domain/line-close';
import { LINE_TOGGLES } from '$lib/features/business/domain/lines';
import type { BusinessConfig } from '$lib/features/business/server/config';

export interface LineaControl {
	id: number;
	codigo: string;
	nombre: string;
	producto: { id: number; nombre: string; unidad: string; stock: number } | null;
	etiqueta: string;
	platos: (PlatoLinea & { nombre: string })[];
}

/** Códigos de línea (distintos de pizza) activos según la configuración del negocio. */
export function lineasActivas(config: BusinessConfig): string[] {
	return LINE_TOGGLES.filter((t) => t.codigo !== 'pizza' && Boolean(config[t.field] ?? true)).map((t) => t.codigo);
}

/**
 * Garantiza que cada línea activa tenga un insumo de control en bodega.
 * Si existe un producto con el nombre sugerido lo reutiliza; si no, lo crea.
 */
export async function ensureControlProducts(codigos: string[]): Promise<void> {
	if (codigos.length === 0) return;
	const lineas = await db.select().from(lineasGastronomicas).where(inArray(lineasGastronomicas.codigo, codigos));
	for (const l of lineas) {
		if (l.productoControlId) continue;
		const def = CONTROL_POR_DEFECTO[l.codigo];
		if (!def) continue;
		let [p] = await db
			.select({ id: productos.id })
			.from(productos)
			.where(sql`lower(${productos.nombre}) = lower(${def.nombre})`)
			.limit(1);
		if (!p) {
			[p] = await db
				.insert(productos)
				.values({ nombre: def.nombre, unidadMedida: def.unidad, stockActual: 0, stockMinimo: 10, precio: '0' })
				.returning({ id: productos.id });
		}
		await db.update(lineasGastronomicas).set({ productoControlId: p.id }).where(eq(lineasGastronomicas.id, l.id));
	}
}

/** Líneas activas (sin pizza) con su insumo de control, stock actual y platos activos. */
export async function getLineasControl(config: BusinessConfig): Promise<LineaControl[]> {
	const codigos = lineasActivas(config);
	if (codigos.length === 0) return [];
	await ensureControlProducts(codigos);

	const lineas = await db
		.select({
			id: lineasGastronomicas.id,
			codigo: lineasGastronomicas.codigo,
			nombre: lineasGastronomicas.nombre,
			productoId: productos.id,
			productoNombre: productos.nombre,
			unidad: productos.unidadMedida,
			stock: productos.stockActual
		})
		.from(lineasGastronomicas)
		.leftJoin(productos, eq(lineasGastronomicas.productoControlId, productos.id))
		.where(inArray(lineasGastronomicas.codigo, codigos))
		.orderBy(asc(lineasGastronomicas.id));

	const platos = await db
		.select()
		.from(itemsLinea)
		.where(and(inArray(itemsLinea.lineaId, lineas.map((l) => l.id)), eq(itemsLinea.activo, true)))
		.orderBy(asc(itemsLinea.nombre));

	return lineas.map((l) => ({
		id: l.id,
		codigo: l.codigo,
		nombre: l.nombre,
		producto: l.productoId ? { id: l.productoId, nombre: l.productoNombre ?? '', unidad: l.unidad ?? 'unidad', stock: Number(l.stock ?? 0) } : null,
		etiqueta: CONTROL_POR_DEFECTO[l.codigo]?.etiqueta ?? 'unidades',
		platos: platos
			.filter((p) => p.lineaId === l.id)
			.map((p) => ({
				id: p.id,
				nombre: p.nombre,
				precio: Number(p.precioVenta ?? 0),
				costo: Number(p.precioCosto ?? 0),
				unidades: Number(p.unidadesControl ?? 1) || 1
			}))
	}));
}
