import { db } from '$lib/server/db';
import { cortesSemanales, gastos } from '$lib/server/schema';
import { and, gte, lt, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getFinanceDashboard } from '$lib/features/finance/server/dashboard.service';
import { businessDayKey, currentRange } from '$lib/features/finance/domain/period';
import { toNumber } from '$lib/features/finance/domain/metrics';
import { getBusinessConfig } from '$lib/features/business/server/config';

export const load: PageServerLoad = async ({ url }) => {
	const raw = url.searchParams.get('mes');
	const mes = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : businessDayKey(new Date()).slice(0, 7);
	const range = currentRange('mensual', `${mes}-01`);

	const [report, cortes, gastosMes, config] = await Promise.all([
		getFinanceDashboard('mensual', `${mes}-01`),
		db
			.select()
			.from(cortesSemanales)
			.where(and(gte(cortesSemanales.fechaCorte, range.start), lt(cortesSemanales.fechaCorte, range.end)))
			.orderBy(asc(cortesSemanales.fechaCorte)),
		db.select({ descripcion: gastos.descripcion, monto: gastos.monto }).from(gastos).where(and(gte(gastos.fecha, range.start), lt(gastos.fecha, range.end))),
		getBusinessConfig()
	]);

	// Gastos agrupados por concepto (normalizado) para ver en qué se va la plata
	const porConcepto = new Map<string, { concepto: string; total: number; veces: number }>();
	for (const g of gastosMes) {
		const key = g.descripcion.trim().toLowerCase();
		const e = porConcepto.get(key) ?? { concepto: g.descripcion.trim(), total: 0, veces: 0 };
		e.total += toNumber(g.monto);
		e.veces += 1;
		porConcepto.set(key, e);
	}

	const label = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

	return {
		mes,
		monthLabel: label.charAt(0).toUpperCase() + label.slice(1),
		negocio: config.nombreNegocio,
		report,
		gastosPorConcepto: [...porConcepto.values()].sort((a, b) => b.total - a.total),
		cortes: cortes.map((c) => ({
			id: c.id,
			fechaCorte: c.fechaCorte ? c.fechaCorte.toISOString() : null,
			desde: c.rangoInicio ? businessDayKey(c.rangoInicio) : null,
			hasta: c.rangoFin ? businessDayKey(new Date(c.rangoFin.getTime() - 1)) : null,
			esperado: toNumber(c.totalCalculado),
			real: toNumber(c.totalReal),
			diferencia: toNumber(c.diferencia)
		}))
	};
};
