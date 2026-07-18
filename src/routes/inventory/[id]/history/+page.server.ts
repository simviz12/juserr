import { db } from '$lib/server/db';
import { productos, movimientosInventario, usuarios } from '$lib/server/schema';
import { eq, desc, and } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const productoId = Number(params.id);

    if (!productoId) {
        throw error(404, 'Producto no encontrado');
    }

    const [producto] = await db.select()
        .from(productos)
        .where(eq(productos.id, productoId));

    if (!producto) {
        throw error(404, 'Producto no encontrado');
    }

    const movimientos = await db.select({
        id: movimientosInventario.id,
        tipo: movimientosInventario.tipo,
        cantidad: movimientosInventario.cantidad,
        fecha: movimientosInventario.fecha,
        usuarioNombre: usuarios.nombre
    })
    .from(movimientosInventario)
    .leftJoin(usuarios, eq(movimientosInventario.usuarioId, usuarios.id))
    .where(eq(movimientosInventario.productoId, productoId))
    .orderBy(desc(movimientosInventario.fecha));

    return { 
        producto,
        movimientos 
    };
};

export const actions: Actions = {
    delete: async ({ request, locals, params }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });
        
        const formData = await request.formData();
        const movId = Number(formData.get('movId'));
        const productoId = Number(params.id);

        if (!movId) return fail(400, { error: 'ID de movimiento requerido' });

        try {
            return await db.transaction(async (tx) => {
                // 1. Obtener movimiento
                const [mov] = await tx.select().from(movimientosInventario).where(eq(movimientosInventario.id, movId));
                if (!mov) return fail(404, { error: 'Movimiento no encontrado' });

                // 2. Obtener producto actual
                const [prod] = await tx.select().from(productos).where(eq(productos.id, productoId));
                if (!prod) return fail(404, { error: 'Producto no encontrado' });

                // 3. Recalcular stock
                let nuevoStock = prod.stockActual || 0;
                if (mov.tipo === 'entrada') {
                    nuevoStock -= mov.cantidad;
                } else if (mov.tipo === 'salida') {
                    nuevoStock += mov.cantidad;
                }

                if (nuevoStock < 0) {
                    return fail(400, { error: 'No se puede eliminar: el stock resultaría en negativo.' });
                }

                // 4. Actualizar stock y eliminar
                await tx.update(productos).set({ stockActual: nuevoStock }).where(eq(productos.id, productoId));
                await tx.delete(movimientosInventario).where(eq(movimientosInventario.id, movId));

                return { success: true, message: 'Movimiento eliminado correctamente.' };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al eliminar el movimiento.' });
        }
    },
    update: async ({ request, locals, params }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });
        
        const formData = await request.formData();
        const movId = Number(formData.get('movId'));
        const nuevaCantidad = parseFloat(formData.get('cantidad')?.toString() || '0');
        const productoId = Number(params.id);

        if (!movId || isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
            return fail(400, { error: 'Datos inválidos' });
        }

        try {
            return await db.transaction(async (tx) => {
                const [mov] = await tx.select().from(movimientosInventario).where(eq(movimientosInventario.id, movId));
                if (!mov) return fail(404, { error: 'Movimiento no encontrado' });

                const [prod] = await tx.select().from(productos).where(eq(productos.id, productoId));
                if (!prod) return fail(404, { error: 'Producto no encontrado' });

                const diferencia = nuevaCantidad - mov.cantidad;
                let nuevoStock = prod.stockActual || 0;

                if (mov.tipo === 'entrada') {
                    nuevoStock += diferencia;
                } else if (mov.tipo === 'salida') {
                    // Si edita una salida de 5 a 8, la diferencia es 3, entonces hay que sacar 3 más (restar).
                    nuevoStock -= diferencia;
                }

                if (nuevoStock < 0) {
                    return fail(400, { error: 'No se puede actualizar: el stock resultaría en negativo.' });
                }

                await tx.update(productos).set({ stockActual: nuevoStock }).where(eq(productos.id, productoId));
                await tx.update(movimientosInventario).set({ cantidad: nuevaCantidad }).where(eq(movimientosInventario.id, movId));

                return { success: true, message: 'Movimiento actualizado correctamente.' };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al actualizar el movimiento.' });
        }
    }
};
