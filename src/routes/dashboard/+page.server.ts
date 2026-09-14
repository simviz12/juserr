import { db } from '$lib/server/db';
import { turnos, gastos, productos, movimientosInventario, pizzaVentas, pizzaSabores, pizzaSobras } from '$lib/server/schema';
import { sql, gte, lt, lte, and, eq, desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { getRange } from '$lib/utils/date';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user || locals.user.rol !== 'jefe') {
        throw redirect(302, '/');
    }

    const rangoStr = url.searchParams.get('rango') || 'diario';
    const rango = ['diario', 'semanal', 'mensual', 'anual'].includes(rangoStr) ? rangoStr as 'diario' | 'semanal' | 'mensual' | 'anual' : 'diario';
    const fechaStr = url.searchParams.get('fecha') || undefined;
    
    const { start: fechaInicio, end: fechaFin } = getRange(rango, fechaStr);

    const [masaItem] = await db.select().from(productos).where(eq(productos.nombre, 'Masas'));
    const stockMasasReal = masaItem?.stockActual || 0;

    const [
        turnosResult, 
        gastosResult, 
        inventarioBajoResult,
        comprasResult,
        saboresVendidosResult,
        saboresDesperdicioResult
    ] = await Promise.all([
        db.select({ 
            efectivo: sql<number>`COALESCE(SUM(CAST(${turnos.monto} AS NUMERIC)), 0)`,
            transferencias: sql<number>`COALESCE(SUM(CAST(${turnos.transferencias} AS NUMERIC)), 0)`,
            totalPorciones: sql<number>`COALESCE(SUM(${turnos.porcionesVendidasCalculado}), 0)`,
            totalMermas: sql<number>`COALESCE(SUM(${turnos.porcionesMermadas}), 0)`,
            turnosContados: sql<number>`COUNT(${turnos.id})`
        })
        .from(turnos)
        .where(and(gte(turnos.fecha, fechaInicio), lt(turnos.fecha, fechaFin))),

        db.select({ 
            total: sql<number>`COALESCE(SUM(CAST(${gastos.monto} AS NUMERIC)), 0)` 
        })
        .from(gastos)
        .where(and(gte(gastos.fecha, fechaInicio), lt(gastos.fecha, fechaFin))),

        db.select()
        .from(productos)
        .where(lte(productos.stockActual, productos.stockMinimo))
        .orderBy(productos.stockActual)
        .limit(6),

        db.select({ totalComprado: sql<number>`COALESCE(SUM(${movimientosInventario.cantidad}), 0)` })
        .from(movimientosInventario)
        .innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
        .where(and(
            eq(productos.nombre, 'Masas'),
            eq(movimientosInventario.tipo, 'entrada'),
            gte(movimientosInventario.fecha, fechaInicio), 
            lt(movimientosInventario.fecha, fechaFin)
        )),

        db.select({
            nombre: pizzaSabores.nombre,
            vendidas: sql<number>`COALESCE(SUM(${pizzaVentas.cantidadVendida}), 0)`
        })
        .from(pizzaVentas)
        .innerJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
        .where(and(gte(pizzaVentas.fecha, fechaInicio), lt(pizzaVentas.fecha, fechaFin)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaVentas.cantidadVendida})`))
        .limit(6),

        db.select({
            nombre: pizzaSabores.nombre,
            desperdicio: sql<number>`COALESCE(SUM(${pizzaSobras.cantidad}), 0)`
        })
        .from(pizzaSobras)
        .innerJoin(pizzaSabores, eq(pizzaSobras.saborId, pizzaSabores.id))
        .where(and(gte(pizzaSobras.fecha, fechaInicio), lt(pizzaSobras.fecha, fechaFin)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaSobras.cantidad})`))
        .limit(6)
    ]);

    const turnosData = turnosResult[0];
    const totalEfectivo = Number(turnosData?.efectivo || 0);
    const totalTransferencias = Number(turnosData?.transferencias || 0);
    const totalPorcionesVendidas = Number(turnosData?.totalPorciones || 0);
    const totalMermasTurnos = Number(turnosData?.totalMermas || 0);
    const cantidadTurnos = Number(turnosData?.turnosContados || 0);

    const gastosData = gastosResult[0];
    const totalGastos = Number(gastosData?.total || 0);

    const comprasData = comprasResult[0];
    const masasCompradas = Number(comprasData?.totalComprado || 0);

    // Ventas Brutas Totales = Efectivo + Nequi (Transferencias)
    // El dinero libre/neto = Ventas Brutas - Gastos
    const ventasBrutas = totalEfectivo + totalTransferencias;
    const utilidadNeta = Math.max(0, ventasBrutas - totalGastos);

    const inventarioBajo = inventarioBajoResult;

    // Formatear sabores vendidos asegurando números limpios
    const saboresVendidos = saboresVendidosResult.map(s => ({
        nombre: s.nombre,
        vendidas: Number(s.vendidas) || 0
    }));

    // Formatear sobras
    const saboresDesperdicio = saboresDesperdicioResult.map(s => ({
        nombre: s.nombre,
        desperdicio: Number(s.desperdicio) || 0
    }));

    return {
        rangoActual: rango,
        fechaSeleccionada: fechaStr || '',
        fechaInicio: fechaInicio.toISOString(),
        fechaFin: fechaFin.toISOString(),
        ventasBrutas,
        utilidadNeta,
        gastosPeriodo: totalGastos,
        totalEfectivo,
        totalTransferencias,
        inventarioBajo,
        totalPorcionesVendidas,
        totalMermas: totalMermasTurnos,
        cantidadTurnos,
        masasCompradas,
        stockMasasActual: stockMasasReal,
        saboresVendidos,
        saboresDesperdicio
    };
};
