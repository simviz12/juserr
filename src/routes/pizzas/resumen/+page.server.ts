import { db } from '$lib/server/db';
import { pizzaSabores, pizzaRuedas, pizzaVentas, pizzaSobras } from '$lib/server/schema';
import { eq, sql, and, gte, lt } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

function getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export const load: PageServerLoad = async () => {
    const { start, end } = getTodayRange();

    const ruedasHoy = await db.select({
        saborId: pizzaRuedas.saborId,
        totalRuedas: sql<number>`COUNT(${pizzaRuedas.id})`,
        totalPorciones: sql<number>`SUM(${pizzaRuedas.cantidad})`
    })
    .from(pizzaRuedas)
    .where(and(gte(pizzaRuedas.fecha, start), lt(pizzaRuedas.fecha, end)))
    .groupBy(pizzaRuedas.saborId);

    const ventasHoy = await db.select({
        saborId: pizzaVentas.saborId,
        totalVendidas: sql<number>`SUM(${pizzaVentas.cantidadVendida})`
    })
    .from(pizzaVentas)
    .where(and(gte(pizzaVentas.fecha, start), lt(pizzaVentas.fecha, end)))
    .groupBy(pizzaVentas.saborId);

    const sobrasHoy = await db.select({
        saborId: pizzaSobras.saborId,
        totalSobras: sql<number>`SUM(${pizzaSobras.cantidad})`
    })
    .from(pizzaSobras)
    .where(and(gte(pizzaSobras.fecha, start), lt(pizzaSobras.fecha, end)))
    .groupBy(pizzaSobras.saborId);

    const saboresIds = [...new Set([
        ...ruedasHoy.map(r => r.saborId),
        ...ventasHoy.map(v => v.saborId),
        ...sobrasHoy.map(s => s.saborId)
    ])];

    if (saboresIds.length === 0) {
        return { resumen: [] };
    }

    const sabores = await db.select().from(pizzaSabores).where(sql`${pizzaSabores.id} IN ${saboresIds}`);

    const resumen = sabores.map(sabor => {
        const horneadas = ruedasHoy.find(r => r.saborId === sabor.id);
        const vendidas = ventasHoy.find(v => v.saborId === sabor.id);
        const sobras = sobrasHoy.find(s => s.saborId === sabor.id);

        return {
            ...sabor,
            ruedasHechas: Number(horneadas?.totalRuedas || 0),
            porcionesHechas: Number(horneadas?.totalPorciones || 0),
            porcionesVendidas: Number(vendidas?.totalVendidas || 0),
            porcionesSobrantes: Number(sobras?.totalSobras || 0)
        };
    });

    return { resumen };
};
