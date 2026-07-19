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
    
    const { start: hoy, end: manana } = getRange(rango);

    // Ventas (Turnos) de hoy
    const [turnosHoy] = await db.select({ total: sql<number>`SUM(CAST(${turnos.monto} AS NUMERIC))` })
        .from(turnos)
        .where(and(gte(turnos.fecha, hoy), lt(turnos.fecha, manana)));
    const totalVentas = Number(turnosHoy?.total || 0);

    // Gastos de hoy
    const [gastosData] = await db.select({ total: sql<number>`SUM(CAST(${gastos.monto} AS NUMERIC))` })
        .from(gastos)
        .where(and(gte(gastos.fecha, hoy), lt(gastos.fecha, manana)));
    const totalGastos = Number(gastosData?.total || 0);

    // Inventario Bajo (stockActual < 5)
    const inventarioBajo = await db.select()
        .from(productos)
        .where(lt(productos.stockActual, 5))
        .orderBy(productos.stockActual)
        .limit(5);

    // Productos más vendidos hoy (Pizzas)
    const masVendidos = await db.select({
            sabor: pizzaSabores.nombre,
            cantidad: sql<number>`SUM(${pizzaVentas.cantidadVendida})`
        })
        .from(pizzaVentas)
        .leftJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
        .where(and(gte(pizzaVentas.fecha, hoy), lt(pizzaVentas.fecha, manana)))
        .groupBy(pizzaSabores.nombre)
        .orderBy(desc(sql`SUM(${pizzaVentas.cantidadVendida})`))
        .limit(4);

    return {
        rangoActual: rango,
        ventasHoy: totalVentas,
        gastosHoy: totalGastos,
        cajaEsperada: totalVentas, // Los turnos ya restaron los gastos de mostrador
        inventarioBajo,
        masVendidos
    };
};
