import { db } from '$lib/server/db';
import { bebidas } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const list = await db.select().from(bebidas).orderBy(bebidas.nombre);
    return { bebidas: list };
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });
        
        const formData = await request.formData();
        const nombre = formData.get('nombre')?.toString();
        const precio = formData.get('precio')?.toString();
        const stockActual = Number(formData.get('stockActual') || 0);

        if (!nombre || !precio) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            await db.insert(bebidas).values({
                nombre,
                precio,
                stockActual
            });
            return { success: true, message: 'Bebida creada exitosamente.' };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al crear bebida' });
        }
    },
    update: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const nombre = formData.get('nombre')?.toString();
        const precio = formData.get('precio')?.toString();
        const stockActual = Number(formData.get('stockActual') || 0);

        if (!id || !nombre || !precio) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            await db.update(bebidas).set({
                nombre,
                precio,
                stockActual
            }).where(eq(bebidas.id, id));
            return { success: true, message: 'Bebida actualizada exitosamente.' };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al actualizar bebida' });
        }
    },
    delete: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const id = Number(formData.get('id'));

        if (!id) return fail(400, { error: 'ID requerido' });

        try {
            await db.delete(bebidas).where(eq(bebidas.id, id));
            return { success: true, message: 'Bebida eliminada correctamente.' };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al eliminar bebida. Podría tener ventas asociadas.' });
        }
    }
};
