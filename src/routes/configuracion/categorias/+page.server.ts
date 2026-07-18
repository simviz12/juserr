import { db } from '$lib/server/db';
import { categorias } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const cats = await db.select().from(categorias).orderBy(categorias.id);
    return { categorias: cats };
};

export const actions: Actions = {
    create: async ({ request }) => {
        const formData = await request.formData();
        const nombre = formData.get('nombre')?.toString();

        if (!nombre) {
            return fail(400, { error: 'El nombre es requerido' });
        }

        try {
            await db.insert(categorias).values({ nombre });
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al crear la categoría' });
        }
    },
    update: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const nombre = formData.get('nombre')?.toString();

        if (!id || !nombre) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            await db.update(categorias).set({ nombre }).where(eq(categorias.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al actualizar la categoría' });
        }
    },
    delete: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));

        if (!id) return fail(400, { error: 'ID requerido' });

        try {
            await db.delete(categorias).where(eq(categorias.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'No se puede eliminar la categoría porque hay productos que la usan.' });
        }
    }
};
