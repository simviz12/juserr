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
    const rango = ['diario', 'semanal', 'mensual'].includes(rangoStr) ? rangoStr as 'diario' | 'semanal' | 'mensual' : 'diario';
    const fechaStr = url.searchParams.get('fecha') || undefined;
    
    const { start: hoy, end: manana } = getRange(rango, fechaStr);

    const [
        turnosResult, 
        gastosResult, 
        inventarioBajoResult,
        comprasResult,
        saboresVendidos,
        saboresDesperdicio
    ] = await Promise.all([
        db.select({ 
            efectivo: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))`,
            transferencias: sql<number>`SUM(CAST(${turnos.transferencias} AS NUMERIC))`,
            totalPorciones: sql<number>`SUM(${turnos.porcionesVendidasCalculado})`
        })
        .from(turnos)
        .where(and(gte(turnos.fecha, hoy), lt(turnos.fecha, manana))),

        db.select({ total: sql<number>`SUM(CAST(${gastos.monto} AS NUMERIC))` })
        .from(gastos)
        .where(and(gte(gastos.fecha, hoy), lt(gastos.fecha, manana))),

        db.select()
        .from(productos)
        .where(lte(productos.stockActual, productos.stockMinimo))
        .orderBy(productos.stockActual)
        .limit(5),

        db.select({ totalComprado: sql<number>`SUM(${movimientosInventario.cantidad})` })
        .from(movimientosInventario)
        .innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
        .where(and(
            eq(productos.nombre, 'Masas'),
            eq(movimientosInventario.tipo, 'entrada'),
            gte(movimientosInventario.fecha, hoy), 
            lt(movimientosInventario.fecha, manana)
        )),

        db.select({
            nombre: pizzaSabores.nombre,
            vendidas: sql<number>`SUM(${pizzaVentas.cantidadVendida})`
        })
        .from(pizzaVentas)
        .innerJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
        .where(and(gte(pizzaVentas.fecha, hoy), lt(pizzaVentas.fecha, manana)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaVentas.cantidadVendida})`))
        .limit(3),

        db.select({
            nombre: pizzaSabores.nombre,
            desperdicio: sql<number>`SUM(${pizzaSobras.cantidad})`
        })
        .from(pizzaSobras)
        .innerJoin(pizzaSabores, eq(pizzaSobras.saborId, pizzaSabores.id))
        .where(and(gte(pizzaSobras.fecha, hoy), lt(pizzaSobras.fecha, manana)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaSobras.cantidad})`))
        .limit(3)
    ]);

    const turnosHoy = turnosResult[0];
    const totalEfectivo = Number(turnosHoy?.efectivo || 0);
    const totalTransferencias = Number(turnosHoy?.transferencias || 0);
    const totalPorcionesVendidas = Number(turnosHoy?.totalPorciones || 0);

    const gastosData = gastosResult[0];
    const totalGastos = Number(gastosData?.total || 0);

    const comprasData = comprasResult[0];
    const masasCompradas = Number(comprasData?.totalComprado || 0);

    // Las "Ventas Totales" declaradas son el Efectivo final + Transferencias + Gastos que salieron de caja
    const totalVentas = totalEfectivo + totalTransferencias + totalGastos;

    const inventarioBajo = inventarioBajoResult;

    return {
        rangoActual: rango,
        fechaSeleccionada: fechaStr || '',
        ventasHoy: totalVentas,
        gastosHoy: totalGastos,
        cajaEsperada: totalEfectivo,
        transferenciasHoy: totalTransferencias,
        inventarioBajo,
        totalPorcionesVendidas,
        masasCompradas,
        saboresVendidos,
        saboresDesperdicio
    };
};
