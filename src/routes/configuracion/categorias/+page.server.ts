import { db } from '$lib/server/db';
import { categorias, productos } from '$lib/server/schema';
import { asc, count, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ id: categorias.id, nombre: categorias.nombre, productos: count(productos.id) })
		.from(categorias)
		.leftJoin(productos, eq(productos.categoriaId, categorias.id))
		.groupBy(categorias.id, categorias.nombre)
		.orderBy(asc(categorias.nombre));
	return { categorias: rows };
};

const nombreDe = (fd: FormData) => fd.get('nombre')?.toString().trim().slice(0, 60) ?? '';

async function existe(nombre: string, exceptId?: number) {
	const rows = await db.select({ id: categorias.id }).from(categorias).where(sql`lower(${categorias.nombre}) = lower(${nombre})`);
	return rows.some((r) => r.id !== exceptId);
}

export const actions: Actions = {
	create: async ({ request }) => {
		const nombre = nombreDe(await request.formData());
		if (!nombre) return fail(400, { error: 'El nombre es obligatorio.' });
		if (await existe(nombre)) return fail(409, { error: `Ya existe la categoría "${nombre}".` });
		await db.insert(categorias).values({ nombre });
		return { success: true, message: `Categoría "${nombre}" creada.` };
	},
	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const nombre = nombreDe(fd);
		if (!id || !nombre) return fail(400, { error: 'Faltan datos.' });
		if (await existe(nombre, id)) return fail(409, { error: `Ya existe la categoría "${nombre}".` });
		await db.update(categorias).set({ nombre }).where(eq(categorias.id, id));
		return { success: true, message: 'Categoría actualizada.' };
	},
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Categoría inválida.' });
		const [{ n }] = await db.select({ n: count() }).from(productos).where(eq(productos.categoriaId, id));
		if (n > 0) return fail(409, { error: `No se puede eliminar: ${n} producto(s) usan esta categoría. Muévelos primero.` });
		await db.delete(categorias).where(eq(categorias.id, id));
		return { success: true, message: 'Categoría eliminada.' };
	}
};
