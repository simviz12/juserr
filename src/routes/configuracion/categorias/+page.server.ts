import { db } from '$lib/server/db';
import { categorias, productos } from '$lib/server/schema';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { delTenant, tenantDe } from '$lib/server/tenancy';

export const load: PageServerLoad = async ({ locals }) => {
	const tid = tenantDe(locals);
	const rows = await db
		.select({ id: categorias.id, nombre: categorias.nombre, productos: count(productos.id) })
		.from(categorias)
		.leftJoin(productos, and(eq(productos.categoriaId, categorias.id), eq(productos.tenantId, tid)))
		.where(delTenant(categorias, tid))
		.groupBy(categorias.id, categorias.nombre)
		.orderBy(asc(categorias.nombre));
	return { categorias: rows };
};

const nombreDe = (fd: FormData) => fd.get('nombre')?.toString().trim().slice(0, 60) ?? '';

async function existe(tid: number, nombre: string, exceptId?: number) {
	const rows = await db
		.select({ id: categorias.id })
		.from(categorias)
		.where(delTenant(categorias, tid, sql`lower(${categorias.nombre}) = lower(${nombre})`));
	return rows.some((r) => r.id !== exceptId);
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const nombre = nombreDe(await request.formData());
		if (!nombre) return fail(400, { error: 'El nombre es obligatorio.' });
		if (await existe(tid, nombre))
			return fail(409, { error: `Ya existe la categoría "${nombre}".` });
		await db.insert(categorias).values({ tenantId: tid, nombre });
		return { success: true, message: `Categoría "${nombre}" creada.` };
	},
	update: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const nombre = nombreDe(fd);
		if (!id || !nombre) return fail(400, { error: 'Faltan datos.' });
		if (await existe(tid, nombre, id))
			return fail(409, { error: `Ya existe la categoría "${nombre}".` });
		const actualizadas = await db
			.update(categorias)
			.set({ nombre })
			.where(delTenant(categorias, tid, eq(categorias.id, id)))
			.returning({ id: categorias.id });
		if (actualizadas.length === 0) return fail(404, { error: 'La categoría no existe.' });
		return { success: true, message: 'Categoría actualizada.' };
	},
	delete: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Categoría inválida.' });
		const [{ n }] = await db
			.select({ n: count() })
			.from(productos)
			.where(delTenant(productos, tid, eq(productos.categoriaId, id)));
		if (n > 0)
			return fail(409, {
				error: `No se puede eliminar: ${n} producto(s) usan esta categoría. Muévelos primero.`
			});
		const borradas = await db
			.delete(categorias)
			.where(delTenant(categorias, tid, eq(categorias.id, id)))
			.returning({ id: categorias.id });
		if (borradas.length === 0) return fail(404, { error: 'La categoría no existe.' });
		return { success: true, message: 'Categoría eliminada.' };
	}
};
