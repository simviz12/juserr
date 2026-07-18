import { db } from '$lib/server/db';
import { pizzaSabores, pizzaVentas } from '$lib/server/schema';
import { sql, and, gte, lte, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    // Valores por defecto: desde el primero del mes actual hasta el último
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const inicioParam = url.searchParams.get('inicio') || firstDay.toISOString().split('T')[0];
    const finParam = url.searchParams.get('fin') || lastDay.toISOString().split('T')[0];

    const start = new Date(inicioParam + 'T00:00:00');
    const end = new Date(finParam + 'T23:59:59');

    // Obtener ranking
    const ventas = await db.select({
        saborId: pizzaSabores.id,
        nombre: pizzaSabores.nombre,
        totalVendido: sql<number>`SUM(${pizzaVentas.cantidadVendida})`
    })
    .from(pizzaVentas)
    .innerJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
    .where(and(gte(pizzaVentas.fecha, start), lte(pizzaVentas.fecha, end)))
    .groupBy(pizzaSabores.id, pizzaSabores.nombre)
    .orderBy(sql`SUM(${pizzaVentas.cantidadVendida}) DESC`);

    // Formatear resultados
    const ranking = ventas.map(v => ({
        id: v.saborId,
        nombre: v.nombre,
        cantidad: Number(v.totalVendido || 0)
    }));

    // El máximo para calcular el porcentaje de las barras CSS
    const maxVentas = ranking.length > 0 ? Math.max(...ranking.map(r => r.cantidad)) : 0;

    return {
        ranking,
        maxVentas,
        inicio: inicioParam,
        fin: finParam
    };
};
