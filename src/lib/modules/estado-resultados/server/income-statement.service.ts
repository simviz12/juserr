/**
 * Caso de uso "Estado de Resultados": lee los movimientos del rango
 * (infraestructura) y delega la cascada contable en el dominio puro.
 *
 * De dónde sale cada cifra:
 * - Ingresos operacionales → turnos cerrados (efectivo + transferencias).
 * - Devoluciones / descuentos / otros ingresos → movimientos_contables.
 * - Costo de ventas → compras de insumos de Bodega (movimientos_inventario
 *   tipo 'entrada') + gastos de categoría "insumos".
 * - Gastos operacionales, otros egresos e impuestos → gastos de caja del turno
 *   + movimientos_contables tipo 'gasto', agrupados por categoría.
 *
 * Solo entran registros confirmados: un turno existe únicamente cuando se cerró
 * (no hay borradores) y los movimientos manuales anulados se excluyen.
 */
import { db } from '$lib/server/db';
import {
	gastos,
	movimientosContables,
	movimientosInventario,
	productos,
	turnos
} from '$lib/server/schema';
import { and, eq, gt, gte, lt } from 'drizzle-orm';
import { delTenant } from '$lib/server/tenancy';
import { currentRange, type DateRange } from '$lib/features/finance/domain/period';
import { toCents } from '$lib/features/finance/domain/money';
import {
	buildStatement,
	compararStatements,
	resolverCategoria,
	type Movimiento,
	type MovimientoGasto,
	type Statement,
	type StatementInput,
	type Variacion
} from '../domain/income-statement';
import { comparisonRange, type Comparacion, type KeyRange } from '../domain/statement-period';

export const ESTADO_CONFIRMADO = 'confirmado';
export const ESTADO_ANULADO = 'anulado';

/** Jornadas completas: 04:00 del día inicial → 04:00 del día siguiente al final (hora Colombia). */
export function toInstantRange(r: KeyRange): DateRange {
	return { start: currentRange('diario', r.inicio).start, end: currentRange('diario', r.fin).end };
}

/** Instante con el que se guarda un movimiento manual: mediodía (Colombia) de su día de negocio. */
export function fechaDeMovimiento(dayKey: string): Date {
	return new Date(dayKey + 'T12:00:00-05:00');
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const pesos = (cents: number) => '$' + Math.round(cents / 100).toLocaleString('es-CO');

async function fetchStatementInput(tid: number, range: DateRange): Promise<StatementInput> {
	const [turnosRows, gastosRows, comprasRows, manuales] = await Promise.all([
		db
			.select({
				id: turnos.id,
				fecha: turnos.fecha,
				monto: turnos.monto,
				transferencias: turnos.transferencias
			})
			.from(turnos)
			.where(delTenant(turnos, tid, gte(turnos.fecha, range.start), lt(turnos.fecha, range.end))),
		db
			.select({
				id: gastos.id,
				turnoId: gastos.turnoId,
				fecha: gastos.fecha,
				descripcion: gastos.descripcion,
				monto: gastos.monto,
				categoria: gastos.categoria
			})
			.from(gastos)
			.where(delTenant(gastos, tid, gte(gastos.fecha, range.start), lt(gastos.fecha, range.end))),
		db
			.select({
				id: movimientosInventario.id,
				fecha: movimientosInventario.fecha,
				cantidad: movimientosInventario.cantidad,
				costoTotal: movimientosInventario.costoTotal,
				producto: productos.nombre,
				unidad: productos.unidadMedida
			})
			.from(movimientosInventario)
			.innerJoin(
				productos,
				and(eq(movimientosInventario.productoId, productos.id), eq(productos.tenantId, tid))
			)
			.where(
				delTenant(
					movimientosInventario,
					tid,
					eq(movimientosInventario.tipo, 'entrada'),
					gt(movimientosInventario.costoTotal, '0'),
					gte(movimientosInventario.fecha, range.start),
					lt(movimientosInventario.fecha, range.end)
				)
			),
		db
			.select({
				id: movimientosContables.id,
				tipo: movimientosContables.tipo,
				categoria: movimientosContables.categoria,
				descripcion: movimientosContables.descripcion,
				monto: movimientosContables.monto,
				fecha: movimientosContables.fecha
			})
			.from(movimientosContables)
			.where(
				delTenant(
					movimientosContables,
					tid,
					eq(movimientosContables.estado, ESTADO_CONFIRMADO),
					gte(movimientosContables.fecha, range.start),
					lt(movimientosContables.fecha, range.end)
				)
			)
	]);

	const ventas: Movimiento[] = turnosRows
		.map((t) => {
			const efectivo = toCents(t.monto);
			const transferencias = toCents(t.transferencias);
			return {
				id: `turno-${t.id}`,
				origen: 'turno' as const,
				refId: t.id,
				fecha: iso(t.fecha),
				concepto: `Cierre de turno #${t.id}`,
				detalle: `Efectivo ${pesos(efectivo)} · Transferencias ${pesos(transferencias)}`,
				cents: efectivo + transferencias
			};
		})
		.filter((m) => m.cents !== 0);

	const compras: Movimiento[] = comprasRows.map((c) => ({
		id: `compra-${c.id}`,
		origen: 'compra',
		refId: c.id,
		fecha: iso(c.fecha),
		concepto: c.producto,
		detalle: `${c.cantidad.toLocaleString('es-CO')} ${c.unidad}`,
		cents: toCents(c.costoTotal)
	}));

	const gastosCaja: MovimientoGasto[] = gastosRows.map((g) => ({
		id: `gasto-${g.id}`,
		origen: 'gasto',
		refId: g.id,
		fecha: iso(g.fecha),
		concepto: g.descripcion,
		detalle: g.turnoId ? `Pagado con la caja del turno #${g.turnoId}` : 'Gasto de caja',
		cents: toCents(g.monto),
		categoria: resolverCategoria(g.categoria, g.descripcion),
		automatica: !g.categoria
	}));

	const ajuste = (m: (typeof manuales)[number]): Movimiento => ({
		id: `ajuste-${m.id}`,
		origen: 'ajuste',
		refId: m.id,
		fecha: iso(m.fecha),
		concepto: m.descripcion,
		detalle: 'Registro manual',
		cents: toCents(m.monto)
	});
	const deTipo = (tipo: string) => manuales.filter((m) => m.tipo === tipo).map(ajuste);

	const gastosManuales: MovimientoGasto[] = manuales
		.filter((m) => m.tipo === 'gasto')
		.map((m) => ({
			...ajuste(m),
			categoria: resolverCategoria(m.categoria, m.descripcion),
			automatica: false
		}));

	return {
		ventas,
		devoluciones: deTipo('devolucion'),
		descuentos: deTipo('descuento'),
		compras,
		gastos: [...gastosCaja, ...gastosManuales],
		otrosIngresos: deTipo('otro_ingreso')
	};
}

export interface IncomeStatementReport {
	rango: KeyRange;
	statement: Statement;
	/** Código de categoría de cada gasto del desglose (id de movimiento → categoría). */
	categorias: Record<string, { codigo: string; automatica: boolean }>;
	comparativo: {
		modo: Exclude<Comparacion, 'ninguna'>;
		rango: KeyRange;
		totales: Statement['totales'];
		margenes: Statement['margenes'];
		variaciones: Record<string, Variacion>;
	} | null;
}

export async function getIncomeStatement(
	tid: number,
	rango: KeyRange,
	modo: Comparacion
): Promise<IncomeStatementReport> {
	const rangoComparado = comparisonRange(rango, modo);

	const [actual, anterior] = await Promise.all([
		fetchStatementInput(tid, toInstantRange(rango)),
		rangoComparado ? fetchStatementInput(tid, toInstantRange(rangoComparado)) : null
	]);

	const statement = buildStatement(actual);
	const previo = anterior ? buildStatement(anterior) : null;

	return {
		rango,
		statement,
		categorias: Object.fromEntries(
			actual.gastos.map((g) => [g.id, { codigo: g.categoria, automatica: g.automatica }])
		),
		comparativo:
			previo && rangoComparado && modo !== 'ninguna'
				? {
						modo,
						rango: rangoComparado,
						totales: previo.totales,
						margenes: previo.margenes,
						variaciones: compararStatements(statement, previo)
					}
				: null
	};
}
