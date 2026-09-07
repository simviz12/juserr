import { db } from '$lib/server/db';
import { turnos, gastos, cierresDia } from '$lib/server/schema';
import { sql, and, gte, lt, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRange } from '$lib/utils/date';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.rol !== 'jefe') {
        throw redirect(302, '/');
    }

    const ultimosCierres = await db.select()
        .from(cierresDia)
        .orderBy(desc(cierresDia.fecha))
        .limit(15);

    return {
        ultimosCierres
    };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user || locals.user.rol !== 'jefe') return fail(401, { error: 'No autorizado' });

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
            // 1. Obtener suma de turnos en ese rango de fecha
            const [sumaTurnos] = await db.select({
                efectivo: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))`,
                transferencias: sql<number>`SUM(CAST(${turnos.transferencias} AS NUMERIC))`
            })
            .from(turnos)
            .where(and(gte(turnos.fecha, start), lt(turnos.fecha, end)));

            const totalTurnos = Number(sumaTurnos?.efectivo || 0);
            const totalTransferencias = Number(sumaTurnos?.transferencias || 0);

            // 2. Obtener suma de gastos
            const [sumaGastos] = await db.select({
                total: sql<number>`SUM(${gastos.monto})`
            })
            .from(gastos)
            .where(and(gte(gastos.fecha, start), lt(gastos.fecha, end)));

            const totalGastos = Number(sumaGastos?.total || 0);

            if (totalTurnos === 0 && totalGastos === 0 && totalTransferencias === 0) {
                throw new Error('NO_MOVIMIENTOS');
            }

            // 3. Guardar Cierre Diario
            await db.insert(cierresDia).values({
                fecha: dateObj,
                totalEfectivo: totalTurnos.toString(),
                totalTransferencias: totalTransferencias.toString(),
                totalTurnos: totalTurnos.toString(),
                totalGastos: totalGastos.toString()
            });

            const granTotal = totalTurnos + totalTransferencias;
            return { success: true, message: `Cierre del día ${fechaStr} guardado. Físico: $${totalTurnos.toLocaleString('es-CO')} | Nequi: $${totalTransferencias.toLocaleString('es-CO')} | Total Consolidado: $${granTotal.toLocaleString('es-CO')}` };
        } catch (err: any) {
            console.error(err);
            if (err.message === 'NO_MOVIMIENTOS') {
                return fail(400, { error: 'No hay movimientos (turnos ni gastos) registrados en esta fecha.' });
            }
            return fail(500, { error: 'Error al procesar el cierre de caja diario.' });
        }
    }
};
