import { db } from '$lib/server/db';
import { pizzaSabores, pizzaRuedas, pizzaVentas } from '$lib/server/schema';
import { eq, sql, and, gte, lt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export const load: PageServerLoad = async () => {
    const { start, end } = getTodayRange();

    const sabores = await db.select().from(pizzaSabores).where(eq(pizzaSabores.activo, true)).orderBy(pizzaSabores.nombre);

    const ruedasHoy = await db.select({
        saborId: pizzaRuedas.saborId,
        totalHorneadas: sql<number>`SUM(${pizzaRuedas.cantidad})`
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

    const stockSabores = sabores.map(sabor => {
        const horneadas = Number(ruedasHoy.find(r => r.saborId === sabor.id)?.totalHorneadas || 0);
        const vendidas = Number(ventasHoy.find(v => v.saborId === sabor.id)?.totalVendidas || 0);
        const disponibles = horneadas - vendidas;

        return {
            ...sabor,
            horneadas,
            vendidas,
            disponibles: Math.max(0, disponibles)
        };
    });

    return { sabores: stockSabores };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const operaciones: {saborId: number, nuevasRuedas: number, actualesMostrador: number}[] = [];

        // Leer todos los sabores enviados
        const keys = Array.from(formData.keys());
        const saborIds = new Set(keys.map(k => k.split('_')[1]).filter(id => id));

        for (const idStr of saborIds) {
            const saborId = Number(idStr);
            const nuevasRuedas = parseFloat(formData.get(`nuevas_${saborId}`)?.toString() || '0');
            const actualesMostradorStr = formData.get(`actuales_${saborId}`)?.toString();
            
            // Si el usuario no llenó nada para este sabor, lo ignoramos
            if (nuevasRuedas === 0 && !actualesMostradorStr) continue;

            const actualesMostrador = actualesMostradorStr ? parseFloat(actualesMostradorStr) : -1;
            operaciones.push({ saborId, nuevasRuedas, actualesMostrador });
        }

        if (operaciones.length === 0) {
            return fail(400, { error: 'No se registró ningún movimiento.' });
        }

        const { start, end } = getTodayRange();

        try {
            let mensajeResultado = 'Auditoría registrada: \n';

            for (const op of operaciones) {
                // 1. Registrar nuevas porciones creadas
                if (op.nuevasRuedas !== 0) {
                    await db.insert(pizzaRuedas).values({
                        saborId: op.saborId,
                        cantidad: op.nuevasRuedas // Guardamos directamente las porciones
                    });
                    mensajeResultado += `+${op.nuevasRuedas} porciones de Sabor ID ${op.saborId}. `;
                }

                // 2. Si hay auditoría de mostrador, calcular ventas
                if (op.actualesMostrador >= 0) {
                    const [ruedas] = await db.select({ total: sql<number>`SUM(${pizzaRuedas.cantidad})` })
                        .from(pizzaRuedas)
                        .where(and(eq(pizzaRuedas.saborId, op.saborId), gte(pizzaRuedas.fecha, start), lt(pizzaRuedas.fecha, end)));
                    
                    const [ventas] = await db.select({ total: sql<number>`SUM(${pizzaVentas.cantidadVendida})` })
                        .from(pizzaVentas)
                        .where(and(eq(pizzaVentas.saborId, op.saborId), gte(pizzaVentas.fecha, start), lt(pizzaVentas.fecha, end)));

                    const horneadas = Number(ruedas?.total || 0);
                    const vendidasAnteriores = Number(ventas?.total || 0);
                    const disponibles = horneadas - vendidasAnteriores;

                    const vendidasAhora = disponibles - op.actualesMostrador;

                    if (vendidasAhora > 0) {
                        await db.insert(pizzaVentas).values({
                            saborId: op.saborId,
                            usuarioId: locals.user.id,
                            cantidadVendida: vendidasAhora
                        });
                        mensajeResultado += `Vendidas ${vendidasAhora} porciones de Sabor ID ${op.saborId}. `;
                    } else if (vendidasAhora < 0) {
                        return fail(400, { error: `Error en sabor ID ${op.saborId}: Hay ${op.actualesMostrador} físicas pero el sistema dice que el máximo disponible era ${disponibles}.` });
                    }
                }
            }

            return { success: true, message: mensajeResultado };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al procesar el Boleo.' });
        }
    }
};
