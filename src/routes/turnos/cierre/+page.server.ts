import { db } from '$lib/server/db';
import { turnos, gastos, productos, pizzaSabores, pizzaSobras, pizzaRuedas, pizzaVentas, transaccionesTurno } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    // 1. Obtener o crear el producto "Masas"
    let [masaProduct] = await db.select().from(productos).where(eq(productos.nombre, 'Masas'));
    
    if (!masaProduct) {
        const [nuevo] = await db.insert(productos).values({
            nombre: 'Masas',
            unidadMedida: 'unidad',
            stockActual: 0,
            precio: '0'
        }).returning();
        masaProduct = nuevo;
    }

    // 2. Obtener las porciones que sobraron en el último turno
    const [ultimoTurno] = await db.select({
        id: turnos.id,
        porcionesSobrantes: turnos.porcionesSobrantes
    })
    .from(turnos)
    .orderBy(desc(turnos.id))
    .limit(1);

    const ultimoTurnoId = ultimoTurno?.id;
    const porcionesAyer = ultimoTurno?.porcionesSobrantes || 0;
    const masasActuales = masaProduct.stockActual || 0;

    const sabores = await db.select().from(pizzaSabores).where(eq(pizzaSabores.activo, true));

    let sobrasAyer: { saborId: number; cantidad: number }[] = [];
    if (ultimoTurnoId) {
        sobrasAyer = await db.select({
            saborId: pizzaSobras.saborId,
            cantidad: pizzaSobras.cantidad
        }).from(pizzaSobras).where(eq(pizzaSobras.turnoId, ultimoTurnoId));
    }

    return { 
        inventario: { masasActuales, porcionesAyer, precioPorcion: 7000 },
        sabores,
        sobrasAyer
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

                // 4. Actualizar stock de Masas
                await db.update(productos)
                    .set({ stockActual: masasSobrantes })
                    .where(eq(productos.nombre, 'Masas'));

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




