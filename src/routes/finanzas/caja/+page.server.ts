import { db } from '$lib/server/db';
import { turnos, gastos, cierresDia } from '$lib/server/schema';
import { sql, and, gte, lt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getRange } from '$lib/utils/date';

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

        const { start, end } = getRange('diario', fechaStr);

        try {
            return await db.transaction(async (tx) => {
                // 1. Obtener suma de turnos en ese rango de fecha (efectivo y transferencias)
                const [sumaTurnos] = await tx.select({
                    efectivo: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))`,
                    transferencias: sql<number>`SUM(CAST(${turnos.transferencias} AS NUMERIC))`
                })
                .from(turnos)
                .where(and(gte(turnos.fecha, start), lt(turnos.fecha, end)));

                const totalTurnos = Number(sumaTurnos?.efectivo || 0);
                const totalTransferencias = Number(sumaTurnos?.transferencias || 0);

                // 2. Obtener suma de gastos en ese rango de fecha
                const [sumaGastos] = await tx.select({
                    total: sql<number>`SUM(${gastos.monto})`
                })
                .from(gastos)
                .where(and(gte(gastos.fecha, start), lt(gastos.fecha, end)));

                const totalGastos = Number(sumaGastos?.total || 0);

                if (totalTurnos === 0 && totalGastos === 0 && totalTransferencias === 0) {
                    throw new Error('NO_MOVIMIENTOS');
                }

                // 4. Guardar Cierre Diario
                await tx.insert(cierresDia).values({
                    fecha: dateObj,
                    totalEfectivo: totalTurnos.toString(),
                    totalTransferencias: totalTransferencias.toString(),
                    totalTurnos: totalTurnos.toString(),
                    totalGastos: totalGastos.toString()
                });

                const granTotal = totalTurnos + totalTransferencias;
                return { success: true, message: `Cierre del día ${fechaStr} guardado. Físico: $${totalTurnos} | Nequi: $${totalTransferencias} | Total Consolidado: $${granTotal}` };
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
