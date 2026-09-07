import { db } from '$lib/server/db';
import { cierresDia, transaccionesTurno, gastos } from '$lib/server/schema';
import { sql, and, gte, lte, desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
    if (!locals.user || locals.user.rol !== 'jefe') {
        throw redirect(302, '/');
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const inicioParam = url.searchParams.get('inicio') || firstDay.toISOString().split('T')[0];
    const finParam = url.searchParams.get('fin') || lastDay.toISOString().split('T')[0];

    const start = new Date(inicioParam + 'T00:00:00');
    const end = new Date(finParam + 'T23:59:59');

    // 1. Obtener cierres de día en el rango
    const cierres = await db.select()
        .from(cierresDia)
        .where(and(gte(cierresDia.fecha, start), lte(cierresDia.fecha, end)))
        .orderBy(desc(cierresDia.fecha));

    // 2. Obtener desglose por medios de pago en ese rango
    const pagosDesglose = await db.select({
        plataforma: transaccionesTurno.plataforma,
        total: sql<number>`SUM(CAST(${transaccionesTurno.monto} AS NUMERIC))`
    })
    .from(transaccionesTurno)
    .where(and(gte(transaccionesTurno.fecha, start), lte(transaccionesTurno.fecha, end)))
    .groupBy(transaccionesTurno.plataforma);

    // 3. Obtener gastos con descripción en el rango
    const listaGastos = await db.select({
        id: gastos.id,
        descripcion: gastos.descripcion,
        monto: gastos.monto,
        fecha: gastos.fecha
    })
    .from(gastos)
    .where(and(gte(gastos.fecha, start), lte(gastos.fecha, end)))
    .orderBy(desc(gastos.fecha))
    .limit(10);

    // 4. Agrupación por semanas
    const agruparPorSemana = (cierresArray: any[]) => {
        const semanas: Record<string, any> = {};

        cierresArray.forEach(cierre => {
            const fecha = new Date(cierre.fecha);
            const diaSemana = fecha.getDay();
            const diff = fecha.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
            const lunes = new Date(fecha.setDate(diff));
            const lunesStr = lunes.toISOString().split('T')[0];

            if (!semanas[lunesStr]) {
                semanas[lunesStr] = {
                    lunes: lunesStr,
                    ventasBrutas: 0,
                    utilidadNeta: 0,
                    gastos: 0,
                    transferencias: 0,
                    diasContados: 0
                };
            }

            const neta = Number(cierre.totalEfectivo || 0);
            const trans = Number(cierre.totalTransferencias || 0);
            const gst = Number(cierre.totalGastos || 0);
            const brutas = neta + trans + gst;

            semanas[lunesStr].ventasBrutas += brutas;
            semanas[lunesStr].utilidadNeta += neta;
            semanas[lunesStr].transferencias += trans;
            semanas[lunesStr].gastos += gst;
            semanas[lunesStr].diasContados += 1;
        });

        return Object.values(semanas).sort((a: any, b: any) => a.lunes.localeCompare(b.lunes));
    };

    const semanas = agruparPorSemana(cierres);

    // 5. Historial diario detallado
    const historialDias = cierres.map(c => {
        const ef = Number(c.totalEfectivo || 0);
        const tr = Number(c.totalTransferencias || 0);
        const gt = Number(c.totalGastos || 0);
        const brutas = ef + tr + gt;
        return {
            id: c.id,
            fecha: c.fecha ? new Date(c.fecha).toISOString().split('T')[0] : '',
            fechaRaw: c.fecha,
            efectivo: ef,
            transferencias: tr,
            gastos: gt,
            ventasBrutas: brutas,
            utilidadNeta: ef + tr
        };
    });

    // 6. Gran Total
    const granTotal = historialDias.reduce((acc, curr) => {
        acc.ventasBrutas += curr.ventasBrutas;
        acc.utilidadNeta += curr.utilidadNeta;
        acc.efectivo += curr.efectivo;
        acc.transferencias += curr.transferencias;
        acc.gastos += curr.gastos;
        return acc;
    }, { ventasBrutas: 0, utilidadNeta: 0, efectivo: 0, transferencias: 0, gastos: 0 });

    const promedioDiario = historialDias.length > 0 ? granTotal.ventasBrutas / historialDias.length : 0;

    return {
        semanas,
        historialDias,
        granTotal,
        promedioDiario,
        pagosDesglose,
        listaGastos,
        inicio: inicioParam,
        fin: finParam
    };
};

