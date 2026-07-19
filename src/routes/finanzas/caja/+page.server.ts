import { db } from '$lib/server/db';
import { turnos, gastos, cierresDia } from '$lib/server/schema';
import { sql, and, gte, lt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const fechaStr = formData.get('fecha')?.toString();

        if (!fechaStr) {
            return fail(400, { error: 'Debe seleccionar una fecha.' });
        }

        const dateObj = new Date(fechaStr + 'T00:00:00');
        if (isNaN(dateObj.getTime())) {
            return fail(400, { error: 'Fecha inválida.' });
        }

        const start = new Date(dateObj);
        const end = new Date(dateObj);
        end.setDate(end.getDate() + 1);

        try {
            return await db.transaction(async (tx) => {
                // 1. Obtener suma de turnos en ese rango de fecha
                const [sumaTurnos] = await tx.select({
                    total: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))`
                })
                .from(turnos)
                .where(and(gte(turnos.fecha, start), lt(turnos.fecha, end)));

                const totalTurnos = Number(sumaTurnos?.total || 0);

                // 2. Obtener suma de gastos en ese rango de fecha
                const [sumaGastos] = await tx.select({
                    total: sql<number>`SUM(${gastos.monto})`
                })
                .from(gastos)
                .where(and(gte(gastos.fecha, start), lt(gastos.fecha, end)));

                const totalGastos = Number(sumaGastos?.total || 0);

                // 3. Efectivo Total de Caja del Día = Total en Turnos
                // Nota: Los turnos ya reportan el efectivo final que hay en caja después de sacar gastos.
                // Si la regla de negocio es: Efectivo Total = suma de las cajas finales de cada turno.
                const totalEfectivo = totalTurnos;

                if (totalTurnos === 0 && totalGastos === 0) {
                    throw new Error('NO_MOVIMIENTOS');
                }

                // 4. Guardar Cierre Diario
                await tx.insert(cierresDia).values({
                    fecha: dateObj,
                    totalEfectivo: totalEfectivo.toString(),
                    totalTurnos: totalTurnos.toString(),
                    totalGastos: totalGastos.toString()
                });

                return { success: true, message: `Cierre del día ${fechaStr} guardado con éxito. Total consolidado: $${totalEfectivo}` };
            });
        } catch (err: any) {
            console.error(err);
            if (err.message === 'NO_MOVIMIENTOS') {
                return fail(400, { error: 'No hay movimientos (turnos ni gastos) registrados en esta fecha.' });
            }
            return fail(500, { error: 'Error al procesar el cierre de caja diario.' });
        }
    }
};
