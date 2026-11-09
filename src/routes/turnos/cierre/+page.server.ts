import { db } from '$lib/server/db';
import { turnos, gastos, productos, pizzaSabores, pizzaSobras, pizzaRuedas, pizzaVentas, transaccionesTurno } from '$lib/server/schema';

import type { Actions, PageServerLoad } from './$types';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { closeShiftAction } from '$lib/features/shifts/server/close-shift.action';
import { getBusinessConfig } from '$lib/features/business/server/config';
import { getLineasControl } from '$lib/features/shifts/server/lines';

const PRECIO_PORCION_DEFAULT = 7000;

export const load: PageServerLoad = async () => {
    // 1. Obtener producto "Masa" (o "Masas"), último turno, lista de sabores y turnos recientes en paralelo
    // 1. Obtener producto "Masa", producto "Pizza (Porciones)", último turno, lista de sabores y turnos recientes en paralelo
    const [masaRows, pizzaRows, ultimosTurnoRows, sabores, ultimosTurnosRaw] = await Promise.all([
        db.select().from(productos).where(inArray(productos.nombre, ['Masa', 'Masas'])).limit(1),
        db.select().from(productos).where(sql`${productos.nombre} ILIKE 'Pizza%'`),
        db.select({
            id: turnos.id,
            porcionesSobrantes: turnos.porcionesSobrantes
        }).from(turnos).orderBy(desc(turnos.id)).limit(1),
        db.select().from(pizzaSabores).where(eq(pizzaSabores.activo, true)),
        db.select({
            id: turnos.id,
            fecha: turnos.fecha,
            monto: turnos.monto,
            transferencias: turnos.transferencias,
            descripcion: turnos.descripcion,
            masasIniciales: turnos.masasIniciales,
            masasSobrantes: turnos.masasSobrantes,
            porcionesVendidas: turnos.porcionesVendidasCalculado,
            porcionesMermadas: turnos.porcionesMermadas,
            porcionesSobrantes: turnos.porcionesSobrantes,
        }).from(turnos).orderBy(desc(turnos.id)).limit(20)
    ]);

    let masaProduct = masaRows[0];
    if (!masaProduct) {
        const [fallback] = await db.select().from(productos).where(eq(productos.nombre, 'Masas'));
        if (fallback) {
            masaProduct = fallback;
        } else {
            const [nuevo] = await db.insert(productos).values({
                nombre: 'Masa',
                unidadMedida: 'unidad',
                stockActual: 0,
                precio: '0'
            }).returning();
            masaProduct = nuevo;
        }
    }

    const pizzaProduct = pizzaRows[0];
    const ultimoTurno = ultimosTurnoRows[0];
    const ultimoTurnoId = ultimoTurno?.id;
    // Las porciones que quedaron en vitrina provienen del stock actual de Bodega (si fue ajustado) o del último turno
    const porcionesAyer = pizzaProduct ? Number(pizzaProduct.stockActual || 0) : (ultimoTurno?.porcionesSobrantes || 0);
    const masasActuales = masaProduct.stockActual || 0;

    const turnoIds = ultimosTurnosRaw.map(t => t.id);

    // Consultar sobras de ayer, transacciones y gastos en 1 solo viaje por lote
    const [sobrasAyer, todasTransacciones, todosGastos] = await Promise.all([
        ultimoTurnoId
            ? db.select({
                saborId: pizzaSobras.saborId,
                cantidad: pizzaSobras.cantidad
            }).from(pizzaSobras).where(eq(pizzaSobras.turnoId, ultimoTurnoId))
            : Promise.resolve([]),
        turnoIds.length > 0
            ? db.select().from(transaccionesTurno).where(inArray(transaccionesTurno.turnoId, turnoIds))
            : Promise.resolve([]),
        turnoIds.length > 0
            ? db.select().from(gastos).where(inArray(gastos.turnoId, turnoIds))
            : Promise.resolve([])
    ]);

    // Mapear transacciones y gastos a sus respectivos turnos en memoria (O(N) instantáneo)
    const transaccionesPorTurno: Record<number, (typeof todasTransacciones[number])[]> = {};
    for (const tr of todasTransacciones) {
        if (!transaccionesPorTurno[tr.turnoId]) transaccionesPorTurno[tr.turnoId] = [];
        transaccionesPorTurno[tr.turnoId].push(tr);
    }

    const gastosPorTurno: Record<number, (typeof todosGastos[number])[]> = {};
    for (const g of todosGastos) {
        if (g.turnoId) {
            if (!gastosPorTurno[g.turnoId]) gastosPorTurno[g.turnoId] = [];
            gastosPorTurno[g.turnoId].push(g);
        }
    }

    const ultimosTurnos = ultimosTurnosRaw.map((t) => {
        const transacciones = transaccionesPorTurno[t.id] || [];
        const gastosTurno = gastosPorTurno[t.id] || [];
        const totalGastosTurno = gastosTurno.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
        return {
            ...t,
            transacciones,
            gastos: gastosTurno,
            totalGastos: totalGastosTurno,
            totalIngresado: (parseFloat(t.monto) || 0) + (parseFloat(t.transferencias || '0') || 0)
        };
    });

    const rubroConfig = await getBusinessConfig();
    const lineas = await getLineasControl(rubroConfig);

    // Precio por porción: promedio de los sabores activos con precio; si no hay, 7.000 COP.
    const preciosSabores = sabores.map((s) => Number(s.precioPorcion ?? 0)).filter((p) => p > 0);
    const precioPorcion = preciosSabores.length
        ? Math.round(preciosSabores.reduce((a, b) => a + b, 0) / preciosSabores.length)
        : PRECIO_PORCION_DEFAULT;

    return {
        inventario: { masasActuales, porcionesAyer, precioPorcion, precioEsPromedio: preciosSabores.length > 0 },
        sabores,
        sobrasAyer,
        historialTurnos: ultimosTurnos.map((t) => ({ ...t, fecha: t.fecha ? t.fecha.toISOString() : null })),
        rubroConfig,
        lineas
    };
};

export const actions: Actions = {
    default: closeShiftAction
};
