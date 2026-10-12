import { db } from '$lib/server/db';
import { bebidas, movimientosBebidas } from '$lib/server/schema';
import { eq, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const list = await db.select().from(bebidas).orderBy(bebidas.nombre);
    
    const historialBebidas = await db.select({
        id: movimientosBebidas.id,
        bebidaNombre: bebidas.nombre,
        tipo: movimientosBebidas.tipo,
        cantidad: movimientosBebidas.cantidad,
        fecha: movimientosBebidas.fecha
    })
    .from(movimientosBebidas)
    .innerJoin(bebidas, eq(movimientosBebidas.bebidaId, bebidas.id))
    .orderBy(desc(movimientosBebidas.fecha))
    .limit(50);

    return { 
        bebidas: list,
        historialBebidas
    };
};

export const actions: Actions = {
    registrarEntrada: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const bebidaId = Number(formData.get('bebidaId'));
        const cantidad = Number(formData.get('cantidad') || 0);

        if (!bebidaId || cantidad <= 0) {
            return fail(400, { error: 'Selecciona una bebida y una cantidad válida mayor a 0.' });
        }

        try {
            const [b] = await db.select().from(bebidas).where(eq(bebidas.id, bebidaId));
            if (!b) return fail(404, { error: 'Bebida no encontrada' });

            const nuevoStock = (b.stockActual || 0) + cantidad;

            await db.update(bebidas)
                .set({ stockActual: nuevoStock })
                .where(eq(bebidas.id, bebidaId));

            await db.insert(movimientosBebidas).values({
                bebidaId,
                usuarioId: locals.user.id,
                tipo: 'entrada',
                cantidad,
                fecha: new Date()
            });

            return { success: true, message: `Se ingresaron +${cantidad} unidades de ${b.nombre}. Stock actual: ${nuevoStock}.` };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al registrar entrada de bebida' });
        }
    },
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
