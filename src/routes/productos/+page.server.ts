import { db } from '$lib/server/db';
import { productos, categorias } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const products = await db.select({
        id: productos.id,
        nombre: productos.nombre,
        categoriaId: productos.categoriaId,
        categoriaNombre: categorias.nombre,
        unidadMedida: productos.unidadMedida,
        precio: productos.precio,
        stockActual: productos.stockActual,
        stockMinimo: productos.stockMinimo
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .orderBy(productos.id);

    const cats = await db.select().from(categorias);

    return {
        products,
        categorias: cats
    };
};

export const actions: Actions = {
    create: async ({ request }) => {
        const formData = await request.formData();
        const nombre = formData.get('nombre')?.toString();
        const categoriaId = Number(formData.get('categoriaId'));
        const unidadMedida = formData.get('unidadMedida')?.toString();
        const precio = formData.get('precio')?.toString() || '0';
        const stockMinimo = parseFloat(formData.get('stockMinimo')?.toString() || '5');

        if (!nombre || !categoriaId || !unidadMedida) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            await db.insert(productos).values({
                nombre,
                categoriaId,
                unidadMedida,
                precio,
                stockMinimo
            });
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al crear producto' });
        }
    },
    update: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const nombre = formData.get('nombre')?.toString();
        const categoriaId = Number(formData.get('categoriaId'));
        const unidadMedida = formData.get('unidadMedida')?.toString();
        const precio = formData.get('precio')?.toString() || '0';
        const stockMinimo = parseFloat(formData.get('stockMinimo')?.toString() || '5');

        if (!id || !nombre || !categoriaId || !unidadMedida) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            await db.update(productos).set({
                nombre,
                categoriaId,
                unidadMedida,
                precio,
                stockMinimo
            }).where(eq(productos.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al actualizar producto' });
        }
    },
    delete: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));

        if (!id) return fail(400, { error: 'ID requerido' });

        try {
            await db.delete(productos).where(eq(productos.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al eliminar producto. Puede tener movimientos asociados.' });
        }
    }
};
