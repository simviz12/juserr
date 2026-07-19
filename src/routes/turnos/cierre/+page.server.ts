import { db } from '$lib/server/db';
import { turnos, gastos, pizzaSabores, pizzaVentas, bebidas, movimientosBebidas } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTodayRange } from '$lib/utils/date';
import { and, gte, lt, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    const { start, end } = getTodayRange();

    // 1. Calcular total de pizzas vendidas hoy
    const ventasPizzas = await db.select({
        saborId: pizzaVentas.saborId,
        totalVendidas: sql<number>`SUM(${pizzaVentas.cantidad})`
    })
    .from(pizzaVentas)
    .where(
        and(
            gte(pizzaVentas.fecha, start),
            lt(pizzaVentas.fecha, end)
        )
    )
    .groupBy(pizzaVentas.saborId);

    const todosLosSabores = await db.select().from(pizzaSabores);
    let totalPizzas = 0;
    let dineroPizzas = 0;
    
    ventasPizzas.forEach(venta => {
        const sabor = todosLosSabores.find(s => s.id === venta.saborId);
        if (sabor) {
            totalPizzas += Number(venta.totalVendidas);
            dineroPizzas += Number(venta.totalVendidas) * parseFloat(sabor.precioPorcion || '0');
        }
    });

    // 2. Calcular total de bebidas vendidas hoy
    const ventasBebidas = await db.select({
        bebidaId: movimientosBebidas.bebidaId,
        totalVendidas: sql<number>`SUM(${movimientosBebidas.cantidad})`
    })
    .from(movimientosBebidas)
    .where(
        and(
            eq(movimientosBebidas.tipo, 'venta'),
            gte(movimientosBebidas.fecha, start),
            lt(movimientosBebidas.fecha, end)
        )
    )
    .groupBy(movimientosBebidas.bebidaId);

    const todasLasBebidas = await db.select().from(bebidas);
    let totalBebidas = 0;
    let dineroBebidas = 0;

    ventasBebidas.forEach(venta => {
        const bebida = todasLasBebidas.find(b => b.id === venta.bebidaId);
        if (bebida) {
            totalBebidas += Number(venta.totalVendidas);
            dineroBebidas += Number(venta.totalVendidas) * parseFloat(bebida.precioVenta || '0');
        }
    });

    return { 
        ventas: {
            totalPizzas,
            dineroPizzas,
            totalBebidas,
            dineroBebidas,
            granTotal: dineroPizzas + dineroBebidas
        } 
    };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const montoStr = formData.get('monto')?.toString();
        const transferenciasStr = formData.get('transferencias')?.toString();
        const descripcionTurno = formData.get('descripcion')?.toString() || '';
        
        const monto = parseFloat(montoStr || '0');
        const transferencias = parseFloat(transferenciasStr || '0');

        if (isNaN(monto) || monto < 0 || isNaN(transferencias) || transferencias < 0) {
            return fail(400, { error: 'Valores de caja o transferencias inválidos.' });
        }

        // Recuperar los gastos dinámicos
        const descripciones = formData.getAll('gasto_descripcion') as string[];
        const montos = formData.getAll('gasto_monto') as string[];

        const gastosParsed = [];
        for (let i = 0; i < descripciones.length; i++) {
            const desc = descripciones[i].trim();
            const val = parseFloat(montos[i]);
            if (desc && !isNaN(val) && val > 0) {
                gastosParsed.push({ descripcion: desc, monto: val.toString() });
            }
        }

        try {
            return await db.transaction(async (tx) => {
                // 1. Crear el turno
                const [nuevoTurno] = await tx.insert(turnos).values({
                    monto: monto.toString(),
                    transferencias: transferencias.toString(),
                    descripcion: descripcionTurno,
                }).returning({ id: turnos.id });

                // 2. Si hay gastos, insertarlos amarrados al turno
                if (gastosParsed.length > 0) {
                    const insertData = gastosParsed.map(g => ({
                        turnoId: nuevoTurno.id,
                        descripcion: g.descripcion,
                        monto: g.monto
                    }));
                    await tx.insert(gastos).values(insertData);
                }

                return { success: true, message: 'Turno y gastos registrados correctamente.' };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al registrar el cierre de turno.' });
        }
    }
};
