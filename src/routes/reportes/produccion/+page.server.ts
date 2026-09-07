import { db } from '$lib/server/db';
import { turnos } from '$lib/server/schema';
import { sql, and, gte, lte } from 'drizzle-orm';
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

    // Obtener producción diaria (Masas consumidas = Masas Iniciales - Masas Sobrantes)
    const produccionBruta = await db.select({
        fecha: sql<string>`DATE(${turnos.fecha})`,
        porcionesVendidas: sql<number>`SUM(${turnos.porcionesVendidasCalculado})`
    })
    .from(turnos)
    .where(and(gte(turnos.fecha, start), lte(turnos.fecha, end)))
    .groupBy(sql`DATE(${turnos.fecha})`)
    .orderBy(sql`DATE(${turnos.fecha})`);

    // Formatear resultados
    const produccion = produccionBruta.map(p => ({
        fecha: p.fecha,
        masasConsumidas: Number(p.porcionesVendidas || 0) / 8,
        porcionesVendidas: Number(p.porcionesVendidas || 0)
    }));

    // El máximo para calcular el porcentaje de las barras CSS
    const maxProduccion = produccion.length > 0 ? Math.max(...produccion.map(p => p.masasConsumidas)) : 0;

    return {
        produccion,
        maxProduccion,
        inicio: inicioParam,
        fin: finParam
    };
};
