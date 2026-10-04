import { db } from '$lib/server/db';
import { turnos, gastos, productos, pizzaSabores, pizzaSobras, pizzaRuedas, pizzaVentas, transaccionesTurno } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq, desc, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    // 1. Obtener producto "Masa" (o "Masas"), último turno, lista de sabores y turnos recientes en paralelo
    const [masaRows, ultimosTurnoRows, sabores, ultimosTurnosRaw] = await Promise.all([
        db.select().from(productos).where(eq(productos.nombre, 'Masa')),
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

    const ultimoTurno = ultimosTurnoRows[0];
    const ultimoTurnoId = ultimoTurno?.id;
    const porcionesAyer = ultimoTurno?.porcionesSobrantes || 0;
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

    return { 
        inventario: { masasActuales, porcionesAyer, precioPorcion: 7000 },
        sabores,
        sobrasAyer,
        historialTurnos: ultimosTurnos
    };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();

        // ── Datos básicos ────────────────────────────────────────────────────
        const monto = parseFloat(formData.get('monto')?.toString() || '0');
        const descripcionTurno = formData.get('descripcion')?.toString() || '';

        // ── Desglose de plataformas de pago ───────────────────────────────
        const nequi     = parseFloat(formData.get('nequi')?.toString()     || '0');
        const refNequi     = formData.get('ref_nequi')?.toString()     || '';

        const totalTransferencias = nequi;
        const totalDeclarado = monto + totalTransferencias;

        // ── Validaciones ──────────────────────────────────────────────────
        if (isNaN(monto) || monto < 0) {
            return fail(400, { error: 'El monto de efectivo es inválido.' });
        }
        if (isNaN(nequi) || nequi < 0) {
            return fail(400, { error: 'El valor de Nequi es inválido.' });
        }

        // ── Inventario ────────────────────────────────────────────────────
        const masasSobrantes   = parseFloat(formData.get('masas_sobrantes')?.toString()   || '0');
        const porcionesSobrantes = parseInt(formData.get('porciones_sobrantes')?.toString() || '0');
        const porcionesMermadas  = parseInt(formData.get('porciones_mermadas')?.toString()  || '0');
        const masasIniciales     = parseFloat(formData.get('masas_iniciales')?.toString()   || '0');
        const porcionesAyer      = parseInt(formData.get('porciones_ayer')?.toString()      || '0');

        const masasUsadas = Math.max(0, masasIniciales - masasSobrantes);
        const porcionesVendidasCalculado = Math.max(0, (masasUsadas * 8 + porcionesAyer) - porcionesSobrantes - porcionesMermadas);

        // ── Gastos dinámicos ──────────────────────────────────────────────
        const gastosDescripciones = formData.getAll('gasto_descripcion') as string[];
        const gastosMontosRaw     = formData.getAll('gasto_monto') as string[];
        const gastosParsed: { descripcion: string; monto: string }[] = [];

        for (let i = 0; i < gastosDescripciones.length; i++) {
            const desc = gastosDescripciones[i].trim();
            const val  = parseFloat(gastosMontosRaw[i]);
            if (desc && !isNaN(val) && val > 0) {
                gastosParsed.push({ descripcion: desc, monto: val.toString() });
            }
        }

        // ── Sabores de pizza ──────────────────────────────────────────────
        const sabores = await db.select().from(pizzaSabores).where(eq(pizzaSabores.activo, true));
        // Obtener sobras del ÚLTIMO turno cerrado
        const [ultimoTurno] = await db.select().from(turnos).orderBy(desc(turnos.id)).limit(1);
        
        let porcionesAyerData: { saborId: number; cantidad: number }[] = [];
        let porcionesAyerSobrantes = 0;
        if (ultimoTurno) {
            porcionesAyerSobrantes = ultimoTurno.porcionesSobrantes || 0;
            porcionesAyerData = await db.select({
                saborId: pizzaSobras.saborId,
                cantidad: pizzaSobras.cantidad
            }).from(pizzaSobras).where(eq(pizzaSobras.turnoId, ultimoTurno.id));
        }

        try {
            

                // 1. Insertar turno con el total de transferencias calculado
                const [nuevoTurno] = await db.insert(turnos).values({
                    monto: monto.toString(),
                    transferencias: totalTransferencias.toString(),
                    descripcion: descripcionTurno,
                    masasIniciales,
                    masasSobrantes,
                    porcionesAyer,
                    porcionesSobrantes,
                    porcionesMermadas,
                    porcionesVendidasCalculado
                }).returning({ id: turnos.id });

                // 2. Insertar desglose de plataformas (solo las que tienen monto > 0)
                const plataformas = [
                    { plataforma: 'nequi',     monto: nequi,     refs: refNequi },
                ];
                for (const p of plataformas) {
                    if (p.monto > 0) {
                        await db.insert(transaccionesTurno).values({
                            turnoId: nuevoTurno.id,
                            plataforma: p.plataforma,
                            monto: p.monto.toString(),
                            referencias: p.refs || null,
                        });
                    }
                }

                // 3. Insertar gastos
                if (gastosParsed.length > 0) {
                    await db.insert(gastos).values(
                        gastosParsed.map(g => ({ turnoId: nuevoTurno.id, descripcion: g.descripcion, monto: g.monto }))
                    );
                }

                // 4. Actualizar stock de Masa
                await db.update(productos)
                    .set({ stockActual: masasSobrantes })
                    .where(eq(productos.nombre, 'Masa'));

                // 5. Guardar métricas de pizzas por sabor
                for (const sabor of sabores) {
                    const ruedas = parseInt(formData.get(`ruedas_${sabor.id}`)?.toString() || '0');
                    const sobras = parseFloat(formData.get(`sobras_${sabor.id}`)?.toString() || '0');
                    const quemadas = parseFloat(formData.get(`quemadas_${sabor.id}`)?.toString() || '0');
                    if (ruedas > 0) await db.insert(pizzaRuedas).values({ saborId: sabor.id, turnoId: nuevoTurno.id, cantidad: ruedas });
                    if (sobras > 0) await db.insert(pizzaSobras).values({ saborId: sabor.id, turnoId: nuevoTurno.id, cantidad: sobras });
                    const sobrasAyerCant = porcionesAyerData.find(s => s.saborId === sabor.id)?.cantidad ?? 0;
                    const vendidas = Math.max(0, (sobrasAyerCant + ruedas * 8) - sobras - quemadas);
                    if (vendidas > 0) await db.insert(pizzaVentas).values({ saborId: sabor.id, turnoId: nuevoTurno.id, cantidadVendida: vendidas });
                }

                return {
                    success: true,
                    message: `Turno cerrado. Total declarado: $${totalDeclarado.toLocaleString('es-CO')} (Efectivo: $${monto.toLocaleString('es-CO')} | Nequi: $${nequi.toLocaleString('es-CO')}).`
                };
            } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al registrar el cierre de turno.' });
        }
    }
};




