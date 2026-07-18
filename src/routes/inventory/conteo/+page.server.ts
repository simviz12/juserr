import { db } from '$lib/server/db';
import { productos, movimientosInventario } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const inv = await db.select().from(productos).orderBy(productos.nombre);
    return { inventory: inv };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const keys = Array.from(formData.keys());
        const productoIds = new Set(keys.map(k => k.split('_')[1]).filter(id => id));

        const operaciones = [];

        for (const idStr of productoIds) {
            const productoId = Number(idStr);
            const conteoStr = formData.get(`conteo_${productoId}`);
            
            if (conteoStr && conteoStr !== '') {
                operaciones.push({
                    productoId,
                    conteo: parseFloat(conteoStr)
                });
            }
        }

        if (operaciones.length === 0) {
            return fail(400, { error: 'No ingresaste ningún conteo.' });
        }

        try {
            return await db.transaction(async (tx) => {
                let modificados = 0;

                for (const op of operaciones) {
                    // Obtener stock actual
                    const [prod] = await tx.select({ stockActual: productos.stockActual }).from(productos).where(eq(productos.id, op.productoId));
                    if (!prod) continue;

                    const stockActual = prod.stockActual || 0;
                    const diferencia = op.conteo - stockActual;

                    // Solo registrar si hubo un cambio real
                    if (Math.abs(diferencia) > 0.001) {
                        const tipo = diferencia > 0 ? 'entrada' : 'salida';
                        
                        await tx.insert(movimientosInventario).values({
                            productoId: op.productoId,
                            usuarioId: locals.user.id,
                            tipo: tipo,
                            cantidad: Math.abs(diferencia)
                        });

                        await tx.update(productos)
                            .set({ stockActual: op.conteo })
                            .where(eq(productos.id, op.productoId));
                            
                        modificados++;
                    }
                }

                return { success: true, message: `Conteo físico completado. Se ajustaron saldos de ${modificados} productos.` };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al procesar el conteo físico.' });
        }
    }
};
