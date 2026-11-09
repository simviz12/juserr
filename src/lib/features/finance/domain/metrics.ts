/**
 * Lógica de negocio financiera pura. No conoce Drizzle, SvelteKit ni el DOM,
 * por lo que se prueba de forma aislada (tests/finance.metrics.test.ts).
 */
import { bucketKey, type RangeType, type SeriesBucket } from './period';

export interface ShiftRecord {
	id: number;
	fecha: Date | string | null;
	descripcion: string | null;
	efectivo: number;
	transferencias: number;
	porciones: number;
	mermas: number;
}

export interface ExpenseRecord {
	fecha: Date | string | null;
	monto: number;
}

export interface PurchaseRecord {
	fecha: Date | string | null;
	costo: number;
}

export interface PeriodSummary {
	efectivo: number;
	transferencias: number;
	ventasBrutas: number;
	gastos: number;
	/**
	 * Ventas − gastos de caja − compras de insumos (base caja).
	 * Puede ser negativa: una pérdida NO se debe ocultar como 0.
	 */
	utilidadNeta: number;
	/** utilidadNeta / ventasBrutas, null si no hubo ventas. */
	margen: number | null;
	compras: number;
	/** compras de insumos / ventas, null si no hubo ventas. */
	foodCost: number | null;
	porciones: number;
	mermas: number;
	/** mermas / (vendidas + mermas) */
	tasaMerma: number | null;
	turnos: number;
	ticketPorTurno: number | null;
}

export type Trend = 'up' | 'down' | 'flat';

export interface Delta {
	/** Cambio relativo (0.12 = +12 %). null si no hay base de comparación. */
	pct: number | null;
	trend: Trend;
}

export type FoodCostStatus = 'saludable' | 'vigilar' | 'riesgo' | 'sin-datos';

/** Rangos de referencia de la industria para comida rápida. */
export const FOOD_COST_TARGET = { ideal: 0.3, max: 0.35 } as const;

export function toNumber(value: unknown): number {
	const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
	return Number.isFinite(n) ? n : 0;
}

function safeRatio(num: number, den: number): number | null {
	return den > 0 ? num / den : null;
}

const sum = <T>(rows: readonly T[], pick: (r: T) => number) =>
	rows.reduce((acc, r) => acc + pick(r), 0);

export function summarize(
	shifts: readonly ShiftRecord[],
	expenses: readonly ExpenseRecord[],
	purchases: readonly PurchaseRecord[]
): PeriodSummary {
	const efectivo = sum(shifts, (s) => s.efectivo);
	const transferencias = sum(shifts, (s) => s.transferencias);
	const ventasBrutas = efectivo + transferencias;
	const gastos = sum(expenses, (e) => e.monto);
	const compras = sum(purchases, (p) => p.costo);
	const porciones = sum(shifts, (s) => s.porciones);
	const mermas = sum(shifts, (s) => s.mermas);
	const utilidadNeta = ventasBrutas - gastos - compras;

	return {
		efectivo,
		transferencias,
		ventasBrutas,
		gastos,
		utilidadNeta,
		margen: safeRatio(utilidadNeta, ventasBrutas),
		compras,
		foodCost: safeRatio(compras, ventasBrutas),
		porciones,
		mermas,
		tasaMerma: safeRatio(mermas, porciones + mermas),
		turnos: shifts.length,
		ticketPorTurno: safeRatio(ventasBrutas, shifts.length)
	};
}

/** Variación porcentual con banda muerta de ±0,5 % para "estable". */
export function delta(current: number, previous: number): Delta {
	if (previous === 0) {
		return { pct: null, trend: current > 0 ? 'up' : current < 0 ? 'down' : 'flat' };
	}
	const pct = (current - previous) / Math.abs(previous);
	return { pct, trend: Math.abs(pct) < 0.005 ? 'flat' : pct > 0 ? 'up' : 'down' };
}

export function foodCostStatus(ratio: number | null): FoodCostStatus {
	if (ratio === null) return 'sin-datos';
	if (ratio <= FOOD_COST_TARGET.ideal) return 'saludable';
	if (ratio <= FOOD_COST_TARGET.max) return 'vigilar';
	return 'riesgo';
}

export function inRange(fecha: Date | string | null, start: Date, end: Date): boolean {
	if (!fecha) return false;
	const t = new Date(fecha).getTime();
	return t >= start.getTime() && t < end.getTime();
}

export interface CashflowPoint extends SeriesBucket {
	efectivo: number;
	transferencias: number;
	gastos: number;
	neto: number;
	/** Bucket posterior a hoy: no hay datos todavía (no es lo mismo que $0). */
	future: boolean;
}

export function buildCashflow(
	type: RangeType,
	buckets: readonly SeriesBucket[],
	shifts: readonly ShiftRecord[],
	expenses: readonly ExpenseRecord[],
	/** Clave YYYY-MM-DD del día de negocio actual. */
	todayKey?: string
): CashflowPoint[] {
	const map = new Map<string, CashflowPoint>(
		buckets.map((b) => [
			b.key,
			{ ...b, efectivo: 0, transferencias: 0, gastos: 0, neto: 0, future: todayKey ? b.key > todayKey : false }
		])
	);
	for (const s of shifts) {
		if (!s.fecha) continue;
		const p = map.get(bucketKey(type, s.fecha));
		if (!p) continue;
		p.efectivo += s.efectivo;
		p.transferencias += s.transferencias;
	}
	for (const e of expenses) {
		if (!e.fecha) continue;
		const p = map.get(bucketKey(type, e.fecha));
		if (p) p.gastos += e.monto;
	}
	for (const p of map.values()) p.neto = p.efectivo + p.transferencias - p.gastos;
	// Nota: el neto diario del gráfico es flujo de caja del día (sin compras, que son semanales).
	return [...map.values()];
}
