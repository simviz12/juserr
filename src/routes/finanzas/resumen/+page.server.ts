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

    // 1. Obtener todos los turnos cerrados en el rango directamente (sin requerir cierre manual duplicado)
    const turnosRango = await db.select({
        id: turnos.id,
        fecha: turnos.fecha,
        monto: turnos.monto,
        transferencias: turnos.transferencias,
        descripcion: turnos.descripcion
    })
    .from(turnos)
    .where(and(gte(turnos.fecha, start), lte(turnos.fecha, end)))
    .orderBy(desc(turnos.fecha));

    // 2. Obtener gastos en el rango
    const gastosRango = await db.select()
        .from(gastos)
        .where(and(gte(gastos.fecha, start), lte(gastos.fecha, end)))
        .orderBy(desc(gastos.fecha));

    // 3. Obtener desglose por medios de pago en ese rango
    const pagosDesglose = await db.select({
        plataforma: transaccionesTurno.plataforma,
        total: sql<number>`COALESCE(SUM(CAST(${transaccionesTurno.monto} AS NUMERIC)), 0)`
    })
    .from(transaccionesTurno)
    .where(and(gte(transaccionesTurno.fecha, start), lte(transaccionesTurno.fecha, end)))
    .groupBy(transaccionesTurno.plataforma);

    // 4. Agrupar turnos y gastos por fecha calendario (Día)
    const diasMap: Record<string, {
        fecha: string;
        efectivo: number;
        transferencias: number;
        gastos: number;
        turnosCount: number;
    }> = {};

    turnosRango.forEach(t => {
        const fechaStr = t.fecha ? new Date(t.fecha).toISOString().split('T')[0] : '';
        if (!fechaStr) return;

        if (!diasMap[fechaStr]) {
            diasMap[fechaStr] = {
                fecha: fechaStr,
                efectivo: 0,
                transferencias: 0,
                gastos: 0,
                turnosCount: 0
            };
        }
        diasMap[fechaStr].efectivo += parseFloat(t.monto) || 0;
        diasMap[fechaStr].transferencias += parseFloat(t.transferencias || '0') || 0;
        diasMap[fechaStr].turnosCount += 1;
    });

    gastosRango.forEach(g => {
        const fechaStr = g.fecha ? new Date(g.fecha).toISOString().split('T')[0] : '';
        if (!fechaStr) return;

        if (!diasMap[fechaStr]) {
            diasMap[fechaStr] = {
                fecha: fechaStr,
                efectivo: 0,
                transferencias: 0,
                gastos: 0,
                turnosCount: 0
            };
        }
        diasMap[fechaStr].gastos += parseFloat(g.monto) || 0;
    });

    const historialDias = Object.values(diasMap)
        .map(d => {
            const ventasBrutas = d.efectivo + d.transferencias;
            const utilidadNeta = Math.max(0, ventasBrutas - d.gastos);
            return {
                id: d.fecha,
                fecha: d.fecha,
                efectivo: d.efectivo,
                transferencias: d.transferencias,
                gastos: d.gastos,
                ventasBrutas,
                utilidadNeta
            };
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

    // 5. Agrupación por semanas
    const agruparPorSemana = (dias: typeof historialDias) => {
        const semanas: Record<string, any> = {};

        dias.forEach(d => {
            const fecha = new Date(d.fecha + 'T00:00:00');
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

            semanas[lunesStr].ventasBrutas += d.ventasBrutas;
            semanas[lunesStr].utilidadNeta += d.utilidadNeta;
            semanas[lunesStr].transferencias += d.transferencias;
            semanas[lunesStr].gastos += d.gastos;
            semanas[lunesStr].diasContados += 1;
        });

        return Object.values(semanas).sort((a: any, b: any) => b.lunes.localeCompare(a.lunes));
    };

    const semanas = agruparPorSemana(historialDias);

    // 6. Gran Total acumulado del período
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
        listaGastos: gastosRango.slice(0, 10),
        inicio: inicioParam,
        fin: finParam
    };
};

