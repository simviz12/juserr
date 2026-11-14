import { db } from '$lib/server/db';
import { productos, categorias, movimientosInventario } from '$lib/server/schema';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { delTenant, tenantDe } from '$lib/server/tenancy';

const UNIDADES = [
	'unidad',
	'fraccion',
	'kilo',
	'libra',
	'litro',
	'pechuga',
	'bulto',
	'paquete'
] as const;

export const load: PageServerLoad = async ({ locals }) => {
	const tid = tenantDe(locals);
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
			.leftJoin(
				categorias,
				and(eq(productos.categoriaId, categorias.id), eq(categorias.tenantId, tid))
			)
			.where(delTenant(productos, tid))
			.orderBy(asc(productos.nombre)),
		db.select().from(categorias).where(delTenant(categorias, tid)).orderBy(asc(categorias.nombre))
	]);
	return { products, categorias: cats, unidades: [...UNIDADES] };
};

async function parse(fd: FormData, tid: number) {
	const nombre = fd.get('nombre')?.toString().trim().slice(0, 80) ?? '';
	const categoriaIdRaw = Number(fd.get('categoriaId'));
	const unidadMedida = fd.get('unidadMedida')?.toString() ?? '';
	const precio = parseFloat(fd.get('precio')?.toString() || '0');
	const stockMinimo = parseFloat(fd.get('stockMinimo')?.toString() || '0');
	if (!nombre) return { error: 'El nombre es obligatorio.' } as const;
	if (!(UNIDADES as readonly string[]).includes(unidadMedida))
		return { error: 'Unidad de medida inválida.' } as const;
	if (!Number.isFinite(precio) || precio < 0)
		return { error: 'Precio de venta inválido.' } as const;
	if (!Number.isFinite(stockMinimo) || stockMinimo < 0)
		return { error: 'Stock mínimo inválido.' } as const;

	// La categoría tiene que ser de este mismo restaurante.
	let categoriaId: number | null = null;
	if (Number.isInteger(categoriaIdRaw) && categoriaIdRaw > 0) {
		const [cat] = await db
			.select({ id: categorias.id })
			.from(categorias)
			.where(delTenant(categorias, tid, eq(categorias.id, categoriaIdRaw)));
		if (!cat) return { error: 'La categoría no existe.' } as const;
		categoriaId = cat.id;
	}
	return { nombre, categoriaId, unidadMedida, precio: precio.toString(), stockMinimo } as const;
}

async function nombreDuplicado(tid: number, nombre: string, exceptId?: number) {
	const rows = await db
		.select({ id: productos.id })
		.from(productos)
		.where(delTenant(productos, tid, sql`lower(${productos.nombre}) = lower(${nombre})`));
	return rows.some((r) => r.id !== exceptId);
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const p = await parse(await request.formData(), tid);
		if ('error' in p) return fail(400, { error: p.error });
		if (await nombreDuplicado(tid, p.nombre))
			return fail(409, { error: `Ya existe un producto llamado "${p.nombre}".` });
		await db.insert(productos).values({ ...p, tenantId: tid, stockActual: 0 });
		return {
			success: true,
			message: `"${p.nombre}" creado. Registra su primera compra en Bodega.`
		};
	},
	update: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		if (!id) return fail(400, { error: 'Producto inválido.' });
		const p = await parse(fd, tid);
		if ('error' in p) return fail(400, { error: p.error });
		if (await nombreDuplicado(tid, p.nombre, id))
			return fail(409, { error: `Ya existe un producto llamado "${p.nombre}".` });
		const actualizados = await db
			.update(productos)
			.set(p)
			.where(delTenant(productos, tid, eq(productos.id, id)))
			.returning({ id: productos.id });
		if (actualizados.length === 0) return fail(404, { error: 'El producto no existe.' });
		return { success: true, message: `"${p.nombre}" actualizado.` };
	},
	delete: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Producto inválido.' });
		const [p] = await db
			.select({ nombre: productos.nombre })
			.from(productos)
			.where(delTenant(productos, tid, eq(productos.id, id)));
		if (!p) return fail(404, { error: 'El producto no existe.' });
		if (['masa', 'masas'].includes(p.nombre.toLowerCase())) {
			return fail(400, {
				error: '"Masa" es necesaria para el cierre de turno y no se puede eliminar.'
			});
		}
		const [{ n }] = await db
			.select({ n: count() })
			.from(movimientosInventario)
			.where(delTenant(movimientosInventario, tid, eq(movimientosInventario.productoId, id)));
		if (n > 0)
			return fail(409, {
				error: `"${p.nombre}" tiene ${n} movimientos en bodega; no se puede eliminar para no perder el historial.`
			});
		try {
			await db.delete(productos).where(delTenant(productos, tid, eq(productos.id, id)));
		} catch {
			return fail(409, {
				error: `"${p.nombre}" está en uso (línea gastronómica o cierres); no se puede eliminar.`
			});
		}
		return { success: true, message: `"${p.nombre}" eliminado.` };
	}
};
