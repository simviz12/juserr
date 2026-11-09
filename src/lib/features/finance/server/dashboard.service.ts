/**
 * Caso de uso "Dashboard financiero": orquesta consultas (infraestructura) y
 * delega todo cálculo en el dominio puro (../domain).
 */
import { db } from '$lib/server/db';
import {
	turnos,
	gastos,
	productos,
	movimientosInventario,
	pizzaVentas,
	pizzaSabores,
	cierresLinea,
	lineasGastronomicas,
	ventasItems,
	itemsLinea
} from '$lib/server/schema';
import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import {
	buildBuckets,
	businessDayKey,
	currentRange,
	previousRange,
	seriesWindow,
	type DateRange,
	type RangeType
} from '../domain/period';
import {
	buildCashflow,
	delta,
	foodCostStatus,
	inRange,
	summarize,
	toNumber,
	type ExpenseRecord,
	type PurchaseRecord,
	type ShiftRecord
} from '../domain/metrics';

const MASA_NAMES = ['Masa', 'Masas'];

async function fetchShifts(range: DateRange): Promise<ShiftRecord[]> {
	const rows = await db
		.select({
			id: turnos.id,
			fecha: turnos.fecha,
			descripcion: turnos.descripcion,
			monto: turnos.monto,
			transferencias: turnos.transferencias,
			porciones: turnos.porcionesVendidasCalculado,
			mermas: turnos.porcionesMermadas
		})
		.from(turnos)
		.where(and(gte(turnos.fecha, range.start), lt(turnos.fecha, range.end)))
		.orderBy(desc(turnos.fecha));

	return rows.map((r) => ({
		id: r.id,
		fecha: r.fecha,
		descripcion: r.descripcion,
		efectivo: toNumber(r.monto),
		transferencias: toNumber(r.transferencias),
		porciones: toNumber(r.porciones),
		mermas: toNumber(r.mermas)
	}));
}

async function fetchExpenses(range: DateRange): Promise<(ExpenseRecord & { turnoId: number | null })[]> {
	const rows = await db
		.select({ fecha: gastos.fecha, monto: gastos.monto, turnoId: gastos.turnoId })
		.from(gastos)
		.where(and(gte(gastos.fecha, range.start), lt(gastos.fecha, range.end)));
	return rows.map((r) => ({ fecha: r.fecha, monto: toNumber(r.monto), turnoId: r.turnoId }));
}

async function fetchPurchases(range: DateRange): Promise<PurchaseRecord[]> {
	const rows = await db
		.select({ fecha: movimientosInventario.fecha, costo: movimientosInventario.costoTotal })
		.from(movimientosInventario)
		.where(
			and(
				eq(movimientosInventario.tipo, 'entrada'),
				gte(movimientosInventario.fecha, range.start),
				lt(movimientosInventario.fecha, range.end)
			)
		);
	return rows.map((r) => ({ fecha: r.fecha, costo: toNumber(r.costo) }));
}

export async function getFinanceDashboard(type: RangeType, dateKey?: string) {
	const current = currentRange(type, dateKey);
	const previous = previousRange(type, current);
	const window = seriesWindow(type, current);

	// Una sola ventana que cubre período actual, anterior y gráfico.
	const span: DateRange = {
		start: new Date(Math.min(previous.start.getTime(), window.start.getTime())),
		end: current.end
	};

	const [shifts, expenses, purchases, masa, lowStock, topSabores] = await Promise.all([
		fetchShifts(span),
		fetchExpenses(span),
		fetchPurchases(span),
		db
			.select({ stock: productos.stockActual })
			.from(productos)
			.where(inArray(productos.nombre, MASA_NAMES))
			.limit(1),
		db
			.select({
				id: productos.id,
				nombre: productos.nombre,
				stockActual: productos.stockActual,
				stockMinimo: productos.stockMinimo,
				unidadMedida: productos.unidadMedida
			})
			.from(productos)
			.where(lte(productos.stockActual, productos.stockMinimo))
			.orderBy(productos.stockActual)
			.limit(6),
		db
			.select({
				nombre: pizzaSabores.nombre,
				precio: pizzaSabores.precioPorcion,
				vendidas: sql<number>`COALESCE(SUM(${pizzaVentas.cantidadVendida}), 0)`
			})
			.from(pizzaVentas)
			.innerJoin(pizzaSabores, eq(pizzaVentas.saborId, pizzaSabores.id))
			.where(and(gte(pizzaVentas.fecha, current.start), lt(pizzaVentas.fecha, current.end)))
			.groupBy(pizzaSabores.nombre, pizzaSabores.precioPorcion)
			.orderBy(desc(sql`SUM(${pizzaVentas.cantidadVendida})`))
	]);

	// Otras líneas (control por inventario) y platos vendidos (desglose del cierre)
	const [lineasRows, platosRows] = await Promise.all([
		db
			.select({
				nombre: lineasGastronomicas.nombre,
				venta: sql<string>`COALESCE(SUM(${cierresLinea.ventaEsperada}), 0)`,
				unidades: sql<number>`COALESCE(SUM(${cierresLinea.consumidas}), 0)`
			})
			.from(cierresLinea)
			.innerJoin(lineasGastronomicas, eq(cierresLinea.lineaId, lineasGastronomicas.id))
			.where(and(gte(cierresLinea.fecha, current.start), lt(cierresLinea.fecha, current.end)))
			.groupBy(lineasGastronomicas.nombre),
		db
			.select({
				nombre: itemsLinea.nombre,
				vendidas: sql<number>`COALESCE(SUM(${ventasItems.cantidad}), 0)`,
				ingresos: sql<string>`COALESCE(SUM(${ventasItems.cantidad} * ${ventasItems.precioUnitario}), 0)`
			})
			.from(ventasItems)
			.innerJoin(itemsLinea, eq(ventasItems.itemId, itemsLinea.id))
			.where(and(gte(ventasItems.fecha, current.start), lt(ventasItems.fecha, current.end)))
			.groupBy(itemsLinea.nombre)
	]);

	const pick = <T extends { fecha: Date | string | null }>(rows: T[], r: DateRange) =>
		rows.filter((x) => inRange(x.fecha, r.start, r.end));

	const curShifts = pick(shifts, current);
	const curExpenses = pick(expenses, current);
	const now = summarize(curShifts, curExpenses, pick(purchases, current));
	const before = summarize(pick(shifts, previous), pick(expenses, previous), pick(purchases, previous));

	// Gastos por turno para la tabla de transacciones.
	const gastosPorTurno = new Map<number, number>();
	for (const e of curExpenses) {
		if (e.turnoId) gastosPorTurno.set(e.turnoId, (gastosPorTurno.get(e.turnoId) ?? 0) + e.monto);
	}

	return {
		range: {
			type,
			dateKey: dateKey ?? '',
			start: current.start.toISOString(),
			end: current.end.toISOString(),
			previousStart: previous.start.toISOString(),
			/** true si el período actual está en curso y se compara contra el mismo tramo del anterior */
			partial: Date.now() < current.end.getTime() && Date.now() > current.start.getTime()
		},
		summary: now,
		previous: before,
		deltas: {
			ventas: delta(now.ventasBrutas, before.ventasBrutas),
			utilidad: delta(now.utilidadNeta, before.utilidadNeta),
			gastos: delta(now.gastos, before.gastos),
			foodCost: delta(now.foodCost ?? 0, before.foodCost ?? 0),
			porciones: delta(now.porciones, before.porciones),
			ticket: delta(now.ticketPorTurno ?? 0, before.ticketPorTurno ?? 0)
		},
		foodCostStatus: foodCostStatus(now.foodCost),
		cashflow: buildCashflow(type, buildBuckets(type, window), pick(shifts, window), pick(expenses, window), businessDayKey(new Date())),
		transactions: curShifts.map((s) => ({
			...s,
			fecha: s.fecha ? new Date(s.fecha).toISOString() : null,
			gastos: gastosPorTurno.get(s.id) ?? 0,
			total: s.efectivo + s.transferencias
		})),
		stockMasa: toNumber(masa[0]?.stock),
		lowStock,
		// Ranking unificado: sabores de pizza + platos de las demás líneas
		topSabores: [
			...topSabores.map((s) => {
				const vendidas = toNumber(s.vendidas);
				return { nombre: s.nombre, vendidas, ingresos: vendidas * toNumber(s.precio) };
			}),
			...platosRows.map((p) => ({ nombre: p.nombre, vendidas: toNumber(p.vendidas), ingresos: toNumber(p.ingresos) }))
		]
			.sort((a, b) => b.ingresos - a.ingresos || b.vendidas - a.vendidas)
			.slice(0, 8),
		ventasPorLinea: buildVentasPorLinea(topSabores, lineasRows)
	};
}

/** Venta estimada por línea según inventario (pizza por sabores, otras por cierre de línea). */
function buildVentasPorLinea(
	sabores: { vendidas: number | string; precio: string | null }[],
	lineas: { nombre: string; venta: string; unidades: number | string }[]
) {
	const pizza = sabores.reduce(
		(a, s) => ({ venta: a.venta + toNumber(s.vendidas) * toNumber(s.precio), unidades: a.unidades + toNumber(s.vendidas) }),
		{ venta: 0, unidades: 0 }
	);
	const rows = [
		...(pizza.unidades > 0 ? [{ nombre: 'Pizzas', venta: pizza.venta, unidades: pizza.unidades }] : []),
		...lineas.map((l) => ({ nombre: l.nombre, venta: toNumber(l.venta), unidades: toNumber(l.unidades) }))
	].filter((r) => r.venta > 0 || r.unidades > 0);
	const total = rows.reduce((a, r) => a + r.venta, 0);
	return rows.map((r) => ({ ...r, participacion: total > 0 ? r.venta / total : 0 })).sort((a, b) => b.venta - a.venta);
}

export type FinanceDashboard = Awaited<ReturnType<typeof getFinanceDashboard>>;
export type TransactionRow = FinanceDashboard['transactions'][number];
