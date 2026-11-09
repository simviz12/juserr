import { db } from '$lib/server/db';
import {
	turnos,
	gastos,
	productos,
	pizzaSabores,
	pizzaSobras,
	pizzaRuedas,
	pizzaVentas,
	transaccionesTurno,
	cierresLinea,
	ventasItems
} from '$lib/server/schema';
import { getLineasControl } from './lines';
import { cerrarLinea } from '../domain/line-close';

import { fail, type RequestEvent } from '@sveltejs/kit';
import { desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { parseFraction } from '$lib/utils/fractions';
import { getBusinessConfig } from '$lib/features/business/server/config';
import {
	extractRefs,
	nonNegFloat,
	nonNegInt,
	parseGastos,
	porcionesVendidas,
	ventasPorSabor
} from '../domain/close-shift';

const MASA_NAMES = ['Masa', 'Masas'];
const cop = (n: number) => n.toLocaleString('es-CO');

export async function closeShiftAction({ request, locals }: RequestEvent) {
	if (!locals.user) return fail(401, { error: 'No autorizado' });

	const formData = await request.formData();

	// ── Dinero declarado ────────────────────────────────────────────────
	const monto = parseFloat(formData.get('monto')?.toString() || '0');
	const nequi = parseFloat(formData.get('nequi')?.toString() || '0');
	if (!Number.isFinite(monto) || monto < 0) return fail(400, { error: 'El monto de efectivo es inválido.' });
	if (!Number.isFinite(nequi) || nequi < 0) return fail(400, { error: 'El valor de Nequi es inválido.' });

	const descripcion = formData.get('descripcion')?.toString().slice(0, 500) || '';
	const refNequi = formData.get('ref_nequi')?.toString().slice(0, 500) || '';

	// ── Antifraude: comprobantes Nequi repetidos ───────────────────────
	const refs = extractRefs(refNequi);
	if (refs.length > 0) {
		const previas = await db
			.select({ referencias: transaccionesTurno.referencias })
			.from(transaccionesTurno)
			.where(isNotNull(transaccionesTurno.referencias))
			.orderBy(desc(transaccionesTurno.id))
			.limit(2000);
		const usadas = new Set(previas.flatMap((p) => extractRefs(p.referencias)));
		const repetidas = refs.filter((r) => usadas.has(r));
		if (repetidas.length > 0) {
			return fail(409, {
				error: `El comprobante ${repetidas.map((r) => r.toUpperCase()).join(', ')} ya fue registrado en un turno anterior. Verifica el pantallazo del cliente.`
			});
		}
	}

	const gastosParsed = parseGastos(
		formData.getAll('gasto_descripcion').map(String),
		formData.getAll('gasto_monto').map(String)
	);

	// ── Inventario de pizzas (solo si la línea está activa) ────────────
	const config = await getBusinessConfig();
	const pizzasActivas = config.habilitarPizzas ?? true;

	let inventario = {
		masasIniciales: 0,
		masasSobrantes: 0,
		porcionesAyer: 0,
		porcionesSobrantes: 0,
		porcionesMermadas: 0,
		vendidas: 0
	};
	let porSabor: { saborId: number; ruedas: number; sobras: number; vendidas: number }[] = [];

	if (pizzasActivas) {
		// ANTIFRAUDE: masas iniciales y porciones de ayer se leen de la BD, nunca
		// del formulario (antes iban en campos ocultos manipulables).
		const [masaRows, pizzaRows, ultimoRows, sabores] = await Promise.all([
			db.select().from(productos).where(inArray(productos.nombre, MASA_NAMES)).limit(1),
			db.select().from(productos).where(sql`${productos.nombre} ILIKE 'Pizza%'`).limit(1),
			db.select().from(turnos).orderBy(desc(turnos.id)).limit(1),
			db.select().from(pizzaSabores).where(eq(pizzaSabores.activo, true))
		]);
		const ultimoTurno = ultimoRows[0];
		const masasIniciales = Number(masaRows[0]?.stockActual ?? 0);
		const porcionesAyer = pizzaRows[0] ? Number(pizzaRows[0].stockActual ?? 0) : (ultimoTurno?.porcionesSobrantes ?? 0);

		const parsed = parseFraction(formData.get('masas_sobrantes')?.toString() || '0');
		const masasSobrantes = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
		if (masasSobrantes > masasIniciales) {
			return fail(400, {
				error: `Las masas sobrantes (${masasSobrantes}) no pueden superar las disponibles en bodega (${masasIniciales}).`
			});
		}
		const porcionesSobrantes = nonNegInt(formData.get('porciones_sobrantes'));
		const porcionesMermadas = nonNegInt(formData.get('porciones_mermadas'));
		inventario = {
			masasIniciales,
			masasSobrantes,
			porcionesAyer,
			porcionesSobrantes,
			porcionesMermadas,
			vendidas: porcionesVendidas({ masasIniciales, masasSobrantes, porcionesAyer, porcionesSobrantes, porcionesMermadas })
		};

		const sobrasAyer = ultimoTurno
			? await db
					.select({ saborId: pizzaSobras.saborId, cantidad: pizzaSobras.cantidad })
					.from(pizzaSobras)
					.where(eq(pizzaSobras.turnoId, ultimoTurno.id))
			: [];

		porSabor = sabores.map((s) => {
			const ruedas = nonNegInt(formData.get(`ruedas_${s.id}`));
			const sobras = nonNegFloat(formData.get(`sobras_${s.id}`));
			const quemadas = nonNegFloat(formData.get(`quemadas_${s.id}`));
			const ayer = sobrasAyer.find((x) => x.saborId === s.id)?.cantidad ?? 0;
			return { saborId: s.id, ruedas, sobras, vendidas: ventasPorSabor(ayer, ruedas, sobras, quemadas) };
		});
	}

	// ── Otras líneas: conciliación por inventario del insumo de control ─
	// El inicial SIEMPRE sale de bodega (servidor); el cajero solo declara lo que sobra.
	const lineas = await getLineasControl(config);
	const cierres: {
		lineaId: number;
		productoId: number;
		nombre: string;
		inicial: number;
		sobrantes: number;
		mermas: number;
		resultado: ReturnType<typeof cerrarLinea>;
		desglose: { itemId: number; cantidad: number; precio: number; costo: number }[];
	}[] = [];
	for (const l of lineas) {
		if (!l.producto) continue;
		const rawSob = formData.get(`linea_${l.id}_sobrantes`)?.toString() ?? '';
		if (rawSob.trim() === '') {
			return fail(400, { error: `Cuenta los ${l.etiqueta} sobrantes de ${l.nombre} (puede ser 0).` });
		}
		const sob = parseFraction(rawSob);
		const sobrantes = Number.isFinite(sob) && sob > 0 ? sob : 0;
		const mer = parseFraction(formData.get(`linea_${l.id}_mermas`)?.toString() || '0');
		const mermas = Number.isFinite(mer) && mer > 0 ? mer : 0;
		const inicial = l.producto.stock;
		if (sobrantes + mermas > inicial + 1e-9) {
			return fail(400, {
				error: `${l.nombre}: sobrantes + mermas (${sobrantes + mermas}) no pueden superar lo que había en bodega (${inicial}). Registra primero la compra en Bodega.`
			});
		}
		const desglose = l.platos
			.map((p) => ({ itemId: p.id, cantidad: nonNegInt(formData.get(`item_${p.id}`)), precio: p.precio, costo: p.costo }))
			.filter((d) => d.cantidad > 0);
		cierres.push({
			lineaId: l.id,
			productoId: l.producto.id,
			nombre: l.nombre,
			inicial,
			sobrantes,
			mermas,
			resultado: cerrarLinea(inicial, sobrantes, mermas, l.platos, desglose),
			desglose
		});
	}

	let turnoId: number | null = null;
	try {
		const [nuevo] = await db
			.insert(turnos)
			.values({
				monto: monto.toString(),
				transferencias: nequi.toString(),
				descripcion,
				masasIniciales: inventario.masasIniciales,
				masasSobrantes: inventario.masasSobrantes,
				porcionesAyer: inventario.porcionesAyer,
				porcionesSobrantes: inventario.porcionesSobrantes,
				porcionesMermadas: inventario.porcionesMermadas,
				porcionesVendidasCalculado: inventario.vendidas
			})
			.returning({ id: turnos.id });
		const id = nuevo.id;
		turnoId = id;

		const ruedasRows = porSabor.filter((r) => r.ruedas > 0);
		const sobrasRows = porSabor.filter((r) => r.sobras > 0);
		const ventasRows = porSabor.filter((r) => r.vendidas > 0);

		// Batch transaccional de Neon: todo o nada.
		await db.batch([
			db.update(turnos).set({ descripcion }).where(eq(turnos.id, id)),
			...(pizzasActivas
				? [
						db.update(productos).set({ stockActual: inventario.masasSobrantes }).where(inArray(productos.nombre, MASA_NAMES)),
						db.update(productos).set({ stockActual: inventario.porcionesSobrantes }).where(sql`${productos.nombre} ILIKE 'Pizza%'`)
					]
				: []),
			...(nequi > 0
				? [db.insert(transaccionesTurno).values({ turnoId: id, plataforma: 'nequi', monto: nequi.toString(), referencias: refNequi || null })]
				: []),
			...(gastosParsed.length
				? [db.insert(gastos).values(gastosParsed.map((g) => ({ turnoId: id, descripcion: g.descripcion, monto: g.monto.toString() })))]
				: []),
			...(ruedasRows.length
				? [db.insert(pizzaRuedas).values(ruedasRows.map((r) => ({ saborId: r.saborId, turnoId: id, cantidad: r.ruedas })))]
				: []),
			...(sobrasRows.length
				? [db.insert(pizzaSobras).values(sobrasRows.map((r) => ({ saborId: r.saborId, turnoId: id, cantidad: r.sobras })))]
				: []),
			...(ventasRows.length
				? [db.insert(pizzaVentas).values(ventasRows.map((r) => ({ saborId: r.saborId, turnoId: id, cantidadVendida: r.vendidas })))]
				: []),
			// Líneas por inventario: stock queda en lo contado, se guarda la conciliación y el desglose
			...cierres.flatMap((c) => [
				db.update(productos).set({ stockActual: c.sobrantes }).where(eq(productos.id, c.productoId)),
				db.insert(cierresLinea).values({
					turnoId: id,
					lineaId: c.lineaId,
					productoId: c.productoId,
					inicial: c.inicial,
					sobrantes: c.sobrantes,
					mermas: c.mermas,
					consumidas: c.resultado.consumidas,
					ventaEsperada: c.resultado.ventaEsperada.toString(),
					desgloseCompleto: c.resultado.desgloseCompleto
				}),
				...(c.desglose.length
					? [
							db.insert(ventasItems).values(
								c.desglose.map((d) => ({
									turnoId: id,
									itemId: d.itemId,
									lineaId: c.lineaId,
									cantidad: d.cantidad,
									precioUnitario: d.precio.toString(),
									costoUnitario: d.costo.toString()
								}))
							)
						]
					: [])
			])
		]);

		const otras = cierres.reduce((a, c) => a + c.resultado.ventaEsperada, 0);
		return {
			success: true,
			turnoId: id,
			message:
				`Turno #${id} cerrado. Declarado: $${cop(monto + nequi)} (efectivo $${cop(monto)} · Nequi $${cop(nequi)}).` +
				(cierres.length ? ` Otras líneas: $${cop(otras)} esperados (${cierres.map((c) => `${c.nombre}: ${c.resultado.consumidas}`).join(', ')}).` : '')
		};
	} catch (err) {
		console.error(err);
		// Compensación: no dejar un turno huérfano si falló el batch.
		if (turnoId !== null) {
			await db.delete(turnos).where(eq(turnos.id, turnoId)).catch(() => {});
		}
		return fail(500, { error: 'Error interno al registrar el cierre de turno.' });
	}
}
