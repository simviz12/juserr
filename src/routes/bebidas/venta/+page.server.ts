import { db } from '$lib/server/db';
import { bebidas, movimientosBebidas } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getTodayRange } from '$lib/utils/date';
import { and, gte, lt, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    const { start, end } = getTodayRange();
    
    // Cargamos todas las bebidas
    const list = await db.select().from(bebidas).orderBy(bebidas.nombre);
    
    // Cargamos las ventas de hoy
    const ventasHoy = await db.select({
        bebidaId: movimientosBebidas.bebidaId,
        totalVendidas: sql<number>`SUM(${movimientosBebidas.cantidad})`
    })
    .from(movimientosBebidas)
    .where(
        and(
            eq(movimientosBebidas.tipo, 'venta'),
            gte(movimientosBebidas.fecha, start),
            lt(movimientosBebidas.fecha, end)
        )
    )
    .groupBy(movimientosBebidas.bebidaId);

    const bebidasConVentas = list.map(bebida => {
        const vendidas = Number(ventasHoy.find(v => v.bebidaId === bebida.id)?.totalVendidas || 0);
        return {
            ...bebida,
            vendidas
        };
    });

    return { bebidas: bebidasConVentas };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const operaciones: { bebidaId: number, nuevas: number, actuales: number }[] = [];

        // Leer todas las bebidas enviadas
        const keys = Array.from(formData.keys());
        const bebidaIds = new Set(keys.map(k => k.split('_')[1]).filter(id => id));

        for (const idStr of bebidaIds) {
            const bebidaId = Number(idStr);
            const nuevas = parseInt(formData.get(`nuevas_${bebidaId}`)?.toString() || '0');
            const actualesStr = formData.get(`actuales_${bebidaId}`)?.toString();
            
            if (nuevas === 0 && !actualesStr) continue;

            const actuales = actualesStr ? parseInt(actualesStr) : -1;
            operaciones.push({ bebidaId, nuevas, actuales });
        }

        if (operaciones.length === 0) {
            return fail(400, { error: 'No se registró ningún movimiento.' });
        }

        try {
            let mensajeResultado = 'Auditoría registrada: \n';

            for (const op of operaciones) {
                const [bebida] = await db.select().from(bebidas).where(eq(bebidas.id, op.bebidaId));
                if (!bebida) continue;

                let stockPrevio = bebida.stockActual || 0;

                // 1. Ingreso de mercancía (nuevas)
                if (op.nuevas > 0) {
                    await db.insert(movimientosBebidas).values({
                        bebidaId: op.bebidaId,
                        usuarioId: locals.user.id,
                        tipo: 'entrada',
                        cantidad: op.nuevas
                    });
                    stockPrevio += op.nuevas;
                    mensajeResultado += `+${op.nuevas} ingresadas (${bebida.nombre}). `;
                }

                // 2. Conteo físico y venta
                if (op.actuales >= 0) {
                    const ventas = stockPrevio - op.actuales;

                    if (ventas > 0) {
                        await db.insert(movimientosBebidas).values({
                            bebidaId: op.bebidaId,
                            usuarioId: locals.user.id,
                            tipo: 'venta',
                            cantidad: ventas
                        });
                        mensajeResultado += `${ventas} vendidas (${bebida.nombre}). `;
                    } else if (ventas < 0) {
                        return fail(400, { error: `Error en ${bebida.nombre}: Físicamente cuentas ${op.actuales} pero el sistema con las nuevas registraba un máximo de ${stockPrevio}.` });
                    }

                    // Actualizar el stock actual a lo que dictó el empleado
                    await db.update(bebidas)
                        .set({ stockActual: op.actuales })
                        .where(eq(bebidas.id, op.bebidaId));
                } else if (op.nuevas > 0) {
                    // Si solo ingresó nuevas, actualizar el stock sumándolas
                    await db.update(bebidas)
                        .set({ stockActual: stockPrevio })
                        .where(eq(bebidas.id, op.bebidaId));
                }
            }

            return { success: true, message: mensajeResultado };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al procesar la auditoría de bebidas.' });
        }
    }
};
