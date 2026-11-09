import { db } from '$lib/server/db';
import { turnos, transaccionesTurno, gastos, movimientosInventario, productos } from '$lib/server/schema';
import { sql, and, gte, lt, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { businessDayKey, currentRange, isValidDateKey } from '$lib/features/finance/domain/period';
import { toNumber } from '$lib/features/finance/domain/metrics';
import { getBusinessConfig } from '$lib/features/business/server/config';

/** Lunes (YYYY-MM-DD) de la semana de una clave de día, sin depender de la zona del servidor. */
function mondayOf(dayKey: string): string {
	const d = new Date(dayKey + 'T12:00:00Z');
	const dow = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
	return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ url }) => {
	// Mes en curso según la jornada de negocio en Colombia (no la hora del servidor).
	const mes = currentRange('mensual');
	const inicioRaw = url.searchParams.get('inicio');
	const finRaw = url.searchParams.get('fin');
	let inicio = isValidDateKey(inicioRaw) ? inicioRaw : businessDayKey(mes.start);
	let fin = isValidDateKey(finRaw) ? finRaw : businessDayKey(new Date(mes.end.getTime() - 1));
	if (inicio > fin) [inicio, fin] = [fin, inicio];

	// Jornadas completas: 04:00 del día inicial → 04:00 del día siguiente al final
	const start = currentRange('diario', inicio).start;
	const end = currentRange('diario', fin).end;

	const [turnosRango, gastosRango, pagosDesglose, compras, config] = await Promise.all([
		db
			.select()
			.from(turnos)
			.where(and(gte(turnos.fecha, start), lt(turnos.fecha, end)))
			.orderBy(desc(turnos.fecha)),
		db
			.select()
			.from(gastos)
			.where(and(gte(gastos.fecha, start), lt(gastos.fecha, end)))
			.orderBy(desc(gastos.fecha)),
		db
			.select({
				plataforma: transaccionesTurno.plataforma,
				total: sql<string>`COALESCE(SUM(CAST(${transaccionesTurno.monto} AS NUMERIC)), 0)`
			})
			.from(transaccionesTurno)
			.where(and(gte(transaccionesTurno.fecha, start), lt(transaccionesTurno.fecha, end)))
			.groupBy(transaccionesTurno.plataforma),
		db
			.select({
				id: movimientosInventario.id,
				productoNombre: productos.nombre,
				unidadMedida: productos.unidadMedida,
				tipo: movimientosInventario.tipo,
				cantidad: movimientosInventario.cantidad,
				costoUnitario: movimientosInventario.costoUnitario,
				costoTotal: movimientosInventario.costoTotal,
				fecha: movimientosInventario.fecha
			})
			.from(movimientosInventario)
			.innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
			.where(and(gte(movimientosInventario.fecha, start), lt(movimientosInventario.fecha, end)))
			.orderBy(desc(movimientosInventario.fecha)),
		getBusinessConfig()
	]);

	// ── Agrupación por día de negocio ───────────────────────
	type Dia = { fecha: string; efectivo: number; transferencias: number; gastos: number; compras: number; turnos: number };
	const dias = new Map<string, Dia>();
	const dia = (k: string) => {
		let d = dias.get(k);
		if (!d) dias.set(k, (d = { fecha: k, efectivo: 0, transferencias: 0, gastos: 0, compras: 0, turnos: 0 }));
		return d;
	};
	for (const t of turnosRango) {
		if (!t.fecha) continue;
		const d = dia(businessDayKey(t.fecha));
		d.efectivo += toNumber(t.monto);
		d.transferencias += toNumber(t.transferencias);
		d.turnos += 1;
	}
	for (const g of gastosRango) if (g.fecha) dia(businessDayKey(g.fecha)).gastos += toNumber(g.monto);
	for (const c of compras) if (c.fecha && c.tipo === 'entrada') dia(businessDayKey(c.fecha)).compras += toNumber(c.costoTotal);

	const historialDias = [...dias.values()]
		.map((d) => {
			const ventasBrutas = d.efectivo + d.transferencias;
			return { ...d, id: d.fecha, ventasBrutas, utilidadNeta: ventasBrutas - d.gastos - d.compras };
		})
		.sort((a, b) => b.fecha.localeCompare(a.fecha));

	// ── Agrupación semanal (lunes a domingo) ────────────────
	const semanasMap = new Map<string, { lunes: string; ventasBrutas: number; gastos: number; compras: number; utilidadNeta: number; transferencias: number; diasContados: number }>();
	for (const d of historialDias) {
		const k = mondayOf(d.fecha);
		const s = semanasMap.get(k) ?? { lunes: k, ventasBrutas: 0, gastos: 0, compras: 0, utilidadNeta: 0, transferencias: 0, diasContados: 0 };
		s.ventasBrutas += d.ventasBrutas;
		s.gastos += d.gastos;
		s.compras += d.compras;
		s.utilidadNeta += d.utilidadNeta;
		s.transferencias += d.transferencias;
		s.diasContados += d.turnos > 0 ? 1 : 0;
		semanasMap.set(k, s);
	}
	const semanas = [...semanasMap.values()].sort((a, b) => b.lunes.localeCompare(a.lunes));

	const granTotal = historialDias.reduce(
		(a, d) => ({
			ventasBrutas: a.ventasBrutas + d.ventasBrutas,
			utilidadNeta: a.utilidadNeta + d.utilidadNeta,
			efectivo: a.efectivo + d.efectivo,
			transferencias: a.transferencias + d.transferencias,
			gastos: a.gastos + d.gastos,
			compras: a.compras + d.compras
		}),
		{ ventasBrutas: 0, utilidadNeta: 0, efectivo: 0, transferencias: 0, gastos: 0, compras: 0 }
	);
	const diasConVenta = historialDias.filter((d) => d.turnos > 0).length;

	return {
		negocio: config.nombreNegocio,
		inicio,
		fin,
		semanas,
		historialDias,
		granTotal,
		promedioDiario: diasConVenta ? granTotal.ventasBrutas / diasConVenta : 0,
		diasConVenta,
		pagosDesglose: pagosDesglose.map((p) => ({ plataforma: p.plataforma, total: toNumber(p.total) })),
		turnosDetallados: turnosRango.map((t) => ({
			id: t.id,
			fecha: t.fecha ? t.fecha.toISOString() : null,
			descripcion: t.descripcion,
			efectivo: toNumber(t.monto),
			transferencias: toNumber(t.transferencias),
			masasUsadas: Math.max(0, (t.masasIniciales ?? 0) - (t.masasSobrantes ?? 0)),
			porcionesAyer: t.porcionesAyer ?? 0,
			porcionesSobrantes: t.porcionesSobrantes ?? 0,
			porcionesMermadas: t.porcionesMermadas ?? 0,
			porcionesVendidas: t.porcionesVendidasCalculado ?? 0
		})),
		listaGastos: gastosRango.map((g) => ({ id: g.id, fecha: g.fecha ? g.fecha.toISOString() : null, descripcion: g.descripcion, monto: toNumber(g.monto) })),
		compras: compras.map((c) => ({ ...c, fecha: c.fecha ? c.fecha.toISOString() : null, costoTotal: toNumber(c.costoTotal), costoUnitario: toNumber(c.costoUnitario) }))
	};
};
