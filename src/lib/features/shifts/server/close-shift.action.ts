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
	ventasItems,
	referenciasPago
} from '$lib/server/schema';
import { getLineasControl } from './lines';
import { cerrarLinea } from '../domain/line-close';

import { fail, type RequestEvent } from '@sveltejs/kit';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { delTenant, tenantDe } from '$lib/server/tenancy';
import { log } from '$lib/server/log';
import { esViolacionUnica } from '$lib/server/pg-errors';
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
import { MASA_NAMES, PIZZA_PORCIONES_PATRON } from '../domain/products';

/** Tope por campo de dinero: $10.000 millones (protege de ceros de más). */
const MONTO_MAXIMO = 10_000_000_000;
const CLAVE_VALIDA = /^[A-Za-z0-9-]{8,64}$/;
const cop = (n: number) => n.toLocaleString('es-CO');

function yaRegistrado(turnoId: number) {
	return {
		success: true,
		turnoId,
		message: `El turno #${turnoId} ya estaba registrado (envío repetido). No se duplicó nada.`
	};
}

async function turnoConClave(tid: number, clave: string) {
	const [previo] = await db
		.select({ id: turnos.id })
		.from(turnos)
		.where(delTenant(turnos, tid, eq(turnos.claveIdempotencia, clave)));
	return previo?.id ?? null;
}

export async function closeShiftAction({ request, locals }: RequestEvent) {
	if (!locals.user) return fail(401, { error: 'No autorizado' });
	const tid = tenantDe(locals);

	const formData = await request.formData();

	// ── Dinero declarado ────────────────────────────────────────────────
	const monto = parseFloat(formData.get('monto')?.toString() || '0');
	const nequi = parseFloat(formData.get('nequi')?.toString() || '0');
	if (!Number.isFinite(monto) || monto < 0 || monto > MONTO_MAXIMO)
		return fail(400, { error: 'El monto de efectivo es inválido.' });
	if (!Number.isFinite(nequi) || nequi < 0 || nequi > MONTO_MAXIMO)
		return fail(400, { error: 'El valor de Nequi es inválido.' });

	// ── Idempotencia ────────────────────────────────────────────────────
	// El formulario trae una clave única por cierre. Si llega dos veces (doble
	// clic, reintento de red), el segundo envío no crea otro turno.
	const claveRaw = formData.get('clave')?.toString() ?? '';
	const clave = CLAVE_VALIDA.test(claveRaw) ? claveRaw : null;
	if (clave) {
		const previo = await turnoConClave(tid, clave);
		if (previo !== null) return yaRegistrado(previo);
	}

	const descripcion = formData.get('descripcion')?.toString().slice(0, 500) || '';
	const refNequi = formData.get('ref_nequi')?.toString().slice(0, 500) || '';

	// ── Antifraude: comprobantes Nequi repetidos ───────────────────────
	// Consulta indexada sobre TODO el historial (antes: solo los últimos 2000 turnos).
	// La clave primaria de referencias_pago cubre además dos cierres simultáneos.
	const refs = extractRefs(refNequi);
	if (refs.length > 0) {
		const repetidas = await db
			.select({ referencia: referenciasPago.referencia })
			.from(referenciasPago)
			.where(delTenant(referenciasPago, tid, inArray(referenciasPago.referencia, refs)));
		if (repetidas.length > 0) {
			return fail(409, {
				error: `El comprobante ${repetidas.map((r) => r.referencia.toUpperCase()).join(', ')} ya fue registrado en un turno anterior. Verifica el pantallazo del cliente.`
			});
		}
	}

	const gastosParsed = parseGastos(
		formData.getAll('gasto_descripcion').map(String),
		formData.getAll('gasto_monto').map(String)
	);
	if (gastosParsed.some((g) => g.monto > MONTO_MAXIMO))
		return fail(400, { error: 'Hay un gasto con un valor inválido.' });

	// ── Inventario de pizzas (solo si la línea está activa) ────────────
	const config = await getBusinessConfig(tid, { estricto: true });
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
	let masaId: number | null = null;
	let porcionesId: number | null = null;

	if (pizzasActivas) {
		// ANTIFRAUDE: masas iniciales y porciones de ayer se leen de la BD, nunca
		// del formulario (antes iban en campos ocultos manipulables).
		// Se elige UN producto de masa y UN producto de porciones (el más antiguo)
		// y luego se actualiza por id: antes el UPDATE por nombre (ILIKE 'Pizza%')
		// sobrescribía el stock de todos los productos que empezaran por "Pizza".
		const [masaRows, pizzaRows, ultimoRows, sabores] = await Promise.all([
			db
				.select()
				.from(productos)
				.where(delTenant(productos, tid, inArray(productos.nombre, MASA_NAMES)))
				.orderBy(asc(productos.id))
				.limit(1),
			db
				.select()
				.from(productos)
				.where(delTenant(productos, tid, sql`${productos.nombre} ILIKE ${PIZZA_PORCIONES_PATRON}`))
				.orderBy(asc(productos.id))
				.limit(1),
			db.select().from(turnos).where(delTenant(turnos, tid)).orderBy(desc(turnos.id)).limit(1),
			db
				.select()
				.from(pizzaSabores)
				.where(delTenant(pizzaSabores, tid, eq(pizzaSabores.activo, true)))
		]);
		const ultimoTurno = ultimoRows[0];
		masaId = masaRows[0]?.id ?? null;
		porcionesId = pizzaRows[0]?.id ?? null;
		const masasIniciales = Number(masaRows[0]?.stockActual ?? 0);
		const porcionesAyer = pizzaRows[0]
			? Number(pizzaRows[0].stockActual ?? 0)
			: (ultimoTurno?.porcionesSobrantes ?? 0);

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
			vendidas: porcionesVendidas({
				masasIniciales,
				masasSobrantes,
				porcionesAyer,
				porcionesSobrantes,
				porcionesMermadas
			})
		};

		const sobrasAyer = ultimoTurno
			? await db
					.select({ saborId: pizzaSobras.saborId, cantidad: pizzaSobras.cantidad })
					.from(pizzaSobras)
					.where(delTenant(pizzaSobras, tid, eq(pizzaSobras.turnoId, ultimoTurno.id)))
			: [];

		porSabor = sabores.map((s) => {
			const ruedas = nonNegInt(formData.get(`ruedas_${s.id}`));
			const sobras = nonNegFloat(formData.get(`sobras_${s.id}`));
			const quemadas = nonNegFloat(formData.get(`quemadas_${s.id}`));
			const ayer = sobrasAyer.find((x) => x.saborId === s.id)?.cantidad ?? 0;
			return {
				saborId: s.id,
				ruedas,
				sobras,
				vendidas: ventasPorSabor(ayer, ruedas, sobras, quemadas)
			};
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
			return fail(400, {
				error: `Cuenta los ${l.etiqueta} sobrantes de ${l.nombre} (puede ser 0).`
			});
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
			.map((p) => ({
				itemId: p.id,
				cantidad: nonNegInt(formData.get(`item_${p.id}`)),
				precio: p.precio,
				costo: p.costo
			}))
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

	try {
		// Se reserva el id del turno antes de escribir: así el turno y TODO lo que
		// depende de él (inventario, pagos, gastos, ventas) van en un solo lote
		// transaccional. Si algo falla, no queda nada a medias.
		const reservado = await db.execute<{ id: number }>(
			sql`SELECT nextval(pg_get_serial_sequence('turnos', 'id'))::int AS id`
		);
		const id = Number(reservado.rows[0].id);

		const ruedasRows = porSabor.filter((r) => r.ruedas > 0);
		const sobrasRows = porSabor.filter((r) => r.sobras > 0);
		const ventasRows = porSabor.filter((r) => r.vendidas > 0);

		await db.batch([
			db.insert(turnos).values({
				id,
				tenantId: tid,
				monto: monto.toString(),
				transferencias: nequi.toString(),
				descripcion,
				masasIniciales: inventario.masasIniciales,
				masasSobrantes: inventario.masasSobrantes,
				porcionesAyer: inventario.porcionesAyer,
				porcionesSobrantes: inventario.porcionesSobrantes,
				porcionesMermadas: inventario.porcionesMermadas,
				porcionesVendidasCalculado: inventario.vendidas,
				claveIdempotencia: clave
			}),
			// Comprobantes: la clave primaria rechaza uno ya usado aunque dos cierres
			// lleguen a la vez (el lote entero se revierte).
			...(refs.length
				? [
						db
							.insert(referenciasPago)
							.values(refs.map((referencia) => ({ tenantId: tid, referencia, turnoId: id })))
					]
				: []),
			// Masas: se DESCUENTA lo usado (no se fija un valor absoluto), así una
			// compra registrada en Bodega mientras se cerraba el turno no se pierde.
			...(pizzasActivas && masaId !== null
				? [
						db
							.update(productos)
							.set({
								stockActual: sql`greatest(${productos.stockActual} - ${inventario.masasIniciales - inventario.masasSobrantes}, 0)`
							})
							.where(delTenant(productos, tid, eq(productos.id, masaId)))
					]
				: []),
			// Porciones en vitrina: es un conteo físico, queda en lo contado.
			...(pizzasActivas && porcionesId !== null
				? [
						db
							.update(productos)
							.set({ stockActual: inventario.porcionesSobrantes })
							.where(delTenant(productos, tid, eq(productos.id, porcionesId)))
					]
				: []),
			...(nequi > 0
				? [
						db.insert(transaccionesTurno).values({
							tenantId: tid,
							turnoId: id,
							plataforma: 'nequi',
							monto: nequi.toString(),
							referencias: refNequi || null
						})
					]
				: []),
			...(gastosParsed.length
				? [
						db.insert(gastos).values(
							gastosParsed.map((g) => ({
								tenantId: tid,
								turnoId: id,
								descripcion: g.descripcion,
								monto: g.monto.toString()
							}))
						)
					]
				: []),
			...(ruedasRows.length
				? [
						db.insert(pizzaRuedas).values(
							ruedasRows.map((r) => ({
								tenantId: tid,
								saborId: r.saborId,
								turnoId: id,
								cantidad: r.ruedas
							}))
						)
					]
				: []),
			...(sobrasRows.length
				? [
						db.insert(pizzaSobras).values(
							sobrasRows.map((r) => ({
								tenantId: tid,
								saborId: r.saborId,
								turnoId: id,
								cantidad: r.sobras
							}))
						)
					]
				: []),
			...(ventasRows.length
				? [
						db.insert(pizzaVentas).values(
							ventasRows.map((r) => ({
								tenantId: tid,
								saborId: r.saborId,
								turnoId: id,
								cantidadVendida: r.vendidas
							}))
						)
					]
				: []),
			// Líneas por inventario: se descuenta lo consumido + mermas (delta, no
			// valor absoluto), se guarda la conciliación y el desglose.
			...cierres.flatMap((c) => [
				db
					.update(productos)
					.set({
						stockActual: sql`greatest(${productos.stockActual} - ${c.inicial - c.sobrantes}, 0)`
					})
					.where(delTenant(productos, tid, eq(productos.id, c.productoId))),
				db.insert(cierresLinea).values({
					tenantId: tid,
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
									tenantId: tid,
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
				(cierres.length
					? ` Otras líneas: $${cop(otras)} esperados (${cierres.map((c) => `${c.nombre}: ${c.resultado.consumidas}`).join(', ')}).`
					: '')
		};
	} catch (err) {
		if (clave && esViolacionUnica(err, 'turnos_tenant_clave_uq')) {
			const previo = await turnoConClave(tid, clave);
			if (previo !== null) return yaRegistrado(previo);
		}
		if (esViolacionUnica(err, 'referencias_pago_tenant_id_referencia_pk')) {
			return fail(409, {
				error:
					'Uno de los comprobantes Nequi se acaba de registrar en otro turno. Verifica el pantallazo del cliente.'
			});
		}
		log.error('error al registrar el cierre de turno', { tenantId: tid, err });
		return fail(500, {
			error: 'Error interno al registrar el cierre de turno. No se guardó nada; intenta de nuevo.'
		});
	}
}
