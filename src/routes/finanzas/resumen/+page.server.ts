import { db } from '$lib/server/db';
import { cierresDia } from '$lib/server/schema';
import { sql, and, gte, lte } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
    // Protección estricta: Solo Jefe
    if (!locals.user || locals.user.rol !== 'jefe') {
        throw redirect(302, '/inventory'); // Redirigir a un lugar seguro si no es jefe
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const inicioParam = url.searchParams.get('inicio') || firstDay.toISOString().split('T')[0];
    const finParam = url.searchParams.get('fin') || lastDay.toISOString().split('T')[0];

    const start = new Date(inicioParam + 'T00:00:00');
    const end = new Date(finParam + 'T23:59:59');

    // Extraemos todos los cierres diarios en ese rango
    const cierres = await db.select()
        .from(cierresDia)
        .where(and(gte(cierresDia.fecha, start), lte(cierresDia.fecha, end)))
        .orderBy(cierresDia.fecha);

    // Agrupación lógica por "semanas" del año (simplificado agrupando por inicio de semana)
    // Para simplificar la visualización sin librerías de fechas complejas, mostraremos el consolidado total
    // y la lista de días (o podríamos agrupar manualmente por semana).
    // Agruparemos por "Semana del [Lunes]"

    const agruparPorSemana = (cierresArray: any[]) => {
        const semanas: Record<string, any> = {};

        cierresArray.forEach(cierre => {
            const fecha = new Date(cierre.fecha);
            // Obtener el Lunes de esa semana
            const diaSemana = fecha.getDay(); // 0 es Domingo
            const diff = fecha.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); 
            const lunes = new Date(fecha.setDate(diff));
            const lunesStr = lunes.toISOString().split('T')[0];

            if (!semanas[lunesStr]) {
                semanas[lunesStr] = {
                    lunes: lunesStr,
                    ventasBrutas: 0,
                    utilidadNeta: 0,
                    gastos: 0
                };
            }

            const neta = Number(cierre.totalEfectivo);
            const gastos = Number(cierre.totalGastos);
            const brutas = neta + gastos; // Regla de negocio definida

            semanas[lunesStr].ventasBrutas += brutas;
            semanas[lunesStr].utilidadNeta += neta;
            semanas[lunesStr].gastos += gastos;
        });

        return Object.values(semanas).sort((a: any, b: any) => a.lunes.localeCompare(b.lunes));
    };

    const semanas = agruparPorSemana(cierres);

    // Gran Total
    const granTotal = semanas.reduce((acc, curr: any) => {
        acc.ventasBrutas += curr.ventasBrutas;
        acc.utilidadNeta += curr.utilidadNeta;
        acc.gastos += curr.gastos;
        return acc;
    }, { ventasBrutas: 0, utilidadNeta: 0, gastos: 0 });

    return {
        semanas,
        granTotal,
        inicio: inicioParam,
        fin: finParam
    };
};
