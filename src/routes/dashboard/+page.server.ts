import { db } from '$lib/server/db';
import { turnos, gastos, productos, pizzaVentas, pizzaSabores } from '$lib/server/schema';
import { sql, gte, lt, and, desc, eq } from 'drizzle-orm';
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

    // Ejecutar todas las consultas en paralelo para mejorar radicalmente el tiempo de carga
    const [
        turnosResult, 
        gastosResult, 
        inventarioBajoResult, 
        masVendidosResult
    ] = await Promise.all([
        db.select({ 
            efectivo: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))`,
            transferencias: sql<number>`SUM(CAST(${turnos.transferencias} AS NUMERIC))`
        })
        .from(turnos)
        .where(and(gte(turnos.fecha, hoy), lt(turnos.fecha, manana))),

        db.select({ total: sql<number>`SUM(CAST(${gastos.monto} AS NUMERIC))` })
        .from(gastos)
        .where(and(gte(gastos.fecha, hoy), lt(gastos.fecha, manana))),

        db.select()
        .from(productos)
        .where(lt(productos.stockActual, 5))
        .orderBy(productos.stockActual)
        .limit(5),

        db.select({
            sabor: pizzaSabores.nombre,
            cantidad: sql<number>`SUM(${pizzaVentas.cantidadVendida})`
        })
        .from(pizzaVentas)
        .leftJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
        .where(and(gte(pizzaVentas.fecha, hoy), lt(pizzaVentas.fecha, manana)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaVentas.cantidadVendida})`))
        .limit(4)
    ]);

    const turnosHoy = turnosResult[0];
    const totalEfectivo = Number(turnosHoy?.efectivo || 0);
    const totalTransferencias = Number(turnosHoy?.transferencias || 0);

    const gastosData = gastosResult[0];
    const totalGastos = Number(gastosData?.total || 0);

    // Las "Ventas Totales" declaradas son el Efectivo final + Transferencias + Gastos que salieron de caja
    const totalVentas = totalEfectivo + totalTransferencias + totalGastos;

    const inventarioBajo = inventarioBajoResult;
    const masVendidos = masVendidosResult;

    return {
        rangoActual: rango,
        fechaSeleccionada: fechaStr || '',
        ventasHoy: totalVentas,
        gastosHoy: totalGastos,
        cajaEsperada: totalEfectivo,
        transferenciasHoy: totalTransferencias,
        inventarioBajo,
        masVendidos
    };
};
