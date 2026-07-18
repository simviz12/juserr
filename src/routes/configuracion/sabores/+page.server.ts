import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pizzaSabores, pizzaVentas, pizzaRuedas, pizzaSobras } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    if (event.locals.user?.rol !== 'jefe') {
        throw redirect(302, '/');
    }
    const sabores = await db.select().from(pizzaSabores).orderBy(pizzaSabores.id);
    return { sabores };
};

export const actions: Actions = {
    create: async ({ request }) => {
        const formData = await request.formData();
        const nombre = formData.get('nombre')?.toString();
        const precioPorcion = formData.get('precioPorcion')?.toString();
        
        if (!nombre || !precioPorcion) {
            return fail(400, { error: 'Nombre y precio por porción son obligatorios' });
        }

        await db.insert(pizzaSabores).values({
            nombre,
            precioPorcion,
            activo: true
        });

        return { success: true, message: 'Sabor agregado correctamente' };
    },
    update: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const nombre = formData.get('nombre')?.toString();
        const precioPorcion = formData.get('precioPorcion')?.toString();

        if (!id || !nombre || !precioPorcion) {
            return fail(400, { error: 'Todos los campos son obligatorios' });
        }

        await db.update(pizzaSabores)
            .set({ nombre, precioPorcion })
            .where(eq(pizzaSabores.id, id));

        return { success: true, message: 'Sabor actualizado correctamente' };
    },
    delete: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        if (!id) return fail(400, { error: 'ID inválido' });

        try {
            await db.delete(pizzaSabores).where(eq(pizzaSabores.id, id));
            return { success: true, message: 'Sabor eliminado correctamente' };
        } catch (e: any) {
            // Handle foreign key constraint violations
            return fail(400, { error: 'No se puede eliminar porque tiene ventas o registros asociados. Mejor desactívalo.' });
        }
    },
    toggle: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const activo = formData.get('activo') === 'true';

        if (!id) return fail(400, { error: 'ID inválido' });

        await db.update(pizzaSabores).set({ activo: !activo }).where(eq(pizzaSabores.id, id));
        return { success: true };
    }
};
