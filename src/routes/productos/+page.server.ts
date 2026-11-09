import { db } from '$lib/server/db';
import { productos, categorias, movimientosInventario } from '$lib/server/schema';
import { asc, count, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const UNIDADES = ['unidad', 'fraccion', 'kilo', 'libra', 'litro', 'pechuga', 'bulto', 'paquete'] as const;

export const load: PageServerLoad = async () => {
	const [products, cats] = await Promise.all([
		db
			.select({
				id: productos.id,
				nombre: productos.nombre,
				categoriaId: productos.categoriaId,
				categoriaNombre: categorias.nombre,
				unidadMedida: productos.unidadMedida,
				precio: productos.precio,
				precioCosto: productos.precioCosto,
				stockActual: productos.stockActual,
				stockMinimo: productos.stockMinimo
			})
			.from(productos)
			.leftJoin(categorias, eq(productos.categoriaId, categorias.id))
			.orderBy(asc(productos.nombre)),
		db.select().from(categorias).orderBy(asc(categorias.nombre))
	]);
	return { products, categorias: cats, unidades: [...UNIDADES] };
};

function parse(fd: FormData) {
	const nombre = fd.get('nombre')?.toString().trim().slice(0, 80) ?? '';
	const categoriaIdRaw = Number(fd.get('categoriaId'));
	const unidadMedida = fd.get('unidadMedida')?.toString() ?? '';
	const precio = parseFloat(fd.get('precio')?.toString() || '0');
	const stockMinimo = parseFloat(fd.get('stockMinimo')?.toString() || '0');
	if (!nombre) return { error: 'El nombre es obligatorio.' } as const;
	if (!(UNIDADES as readonly string[]).includes(unidadMedida)) return { error: 'Unidad de medida inválida.' } as const;
	if (!Number.isFinite(precio) || precio < 0) return { error: 'Precio de venta inválido.' } as const;
	if (!Number.isFinite(stockMinimo) || stockMinimo < 0) return { error: 'Stock mínimo inválido.' } as const;
	return {
		nombre,
		categoriaId: Number.isFinite(categoriaIdRaw) && categoriaIdRaw > 0 ? categoriaIdRaw : null,
		unidadMedida,
		precio: precio.toString(),
		stockMinimo
	} as const;
}

async function nombreDuplicado(nombre: string, exceptId?: number) {
	const rows = await db.select({ id: productos.id }).from(productos).where(sql`lower(${productos.nombre}) = lower(${nombre})`);
	return rows.some((r) => r.id !== exceptId);
}

export const actions: Actions = {
	create: async ({ request }) => {
		const p = parse(await request.formData());
		if ('error' in p) return fail(400, { error: p.error });
		if (await nombreDuplicado(p.nombre)) return fail(409, { error: `Ya existe un producto llamado "${p.nombre}".` });
		await db.insert(productos).values({ ...p, stockActual: 0 });
		return { success: true, message: `"${p.nombre}" creado. Registra su primera compra en Bodega.` };
	},
	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const p = parse(fd);
		if (!id) return fail(400, { error: 'Producto inválido.' });
		if ('error' in p) return fail(400, { error: p.error });
		if (await nombreDuplicado(p.nombre, id)) return fail(409, { error: `Ya existe un producto llamado "${p.nombre}".` });
		await db.update(productos).set(p).where(eq(productos.id, id));
		return { success: true, message: `"${p.nombre}" actualizado.` };
	},
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Producto inválido.' });
		const [p] = await db.select({ nombre: productos.nombre }).from(productos).where(eq(productos.id, id));
		if (!p) return fail(404, { error: 'El producto no existe.' });
		if (['masa', 'masas'].includes(p.nombre.toLowerCase())) {
			return fail(400, { error: '"Masa" es necesaria para el cierre de turno y no se puede eliminar.' });
		}
		const [{ n }] = await db.select({ n: count() }).from(movimientosInventario).where(eq(movimientosInventario.productoId, id));
		if (n > 0) return fail(409, { error: `"${p.nombre}" tiene ${n} movimientos en bodega; no se puede eliminar para no perder el historial.` });
		await db.delete(productos).where(eq(productos.id, id));
		return { success: true, message: `"${p.nombre}" eliminado.` };
	}
};
