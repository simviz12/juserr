import { db } from '$lib/server/db';
import { turnos, gastos, cortesSemanales } from '$lib/server/schema';
import { and, gte, lt, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { businessDayKey, currentRange, isValidDateKey } from '$lib/features/finance/domain/period';
import { toNumber } from '$lib/features/finance/domain/metrics';

/**
 * Efectivo esperado en el rango. `turnos.monto` es el efectivo contado en caja
 * DESPUÉS de pagar los gastos del turno, por eso no se restan otra vez.
 */
async function esperado(desde: string, hasta: string) {
	const start = currentRange('diario', desde).start;
	const end = currentRange('diario', hasta).end;
	const [ts, gs] = await Promise.all([
		db.select({ monto: turnos.monto, transferencias: turnos.transferencias }).from(turnos).where(and(gte(turnos.fecha, start), lt(turnos.fecha, end))),
		db.select({ monto: gastos.monto }).from(gastos).where(and(gte(gastos.fecha, start), lt(gastos.fecha, end)))
	]);
	return {
		start,
		end,
		turnos: ts.length,
		efectivo: ts.reduce((a, t) => a + toNumber(t.monto), 0),
		transferencias: ts.reduce((a, t) => a + toNumber(t.transferencias), 0),
		gastos: gs.reduce((a, g) => a + toNumber(g.monto), 0)
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const semana = currentRange('semanal');
	const dRaw = url.searchParams.get('desde');
	const hRaw = url.searchParams.get('hasta');
	let desde = isValidDateKey(dRaw) ? dRaw : businessDayKey(semana.start);
	let hasta = isValidDateKey(hRaw) ? hRaw : businessDayKey(new Date());
	if (desde > hasta) [desde, hasta] = [hasta, desde];

	const [preview, cortes] = await Promise.all([
		esperado(desde, hasta),
		db.select().from(cortesSemanales).orderBy(desc(cortesSemanales.fechaCorte)).limit(30)
	]);

	return {
		desde,
		hasta,
		preview: { turnos: preview.turnos, efectivo: preview.efectivo, transferencias: preview.transferencias, gastos: preview.gastos },
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

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const desde = formData.get('rangoInicio')?.toString() ?? '';
		const hasta = formData.get('rangoFin')?.toString() ?? '';
		const totalReal = parseFloat(formData.get('totalReal')?.toString() ?? '');

		if (!isValidDateKey(desde) || !isValidDateKey(hasta)) return fail(400, { error: 'Selecciona un rango de fechas válido.' });
		if (desde > hasta) return fail(400, { error: 'La fecha inicial no puede ser posterior a la final.' });
		if (!Number.isFinite(totalReal) || totalReal < 0) return fail(400, { error: 'Escribe el efectivo contado (puede ser 0).' });

		try {
			const r = await esperado(desde, hasta);
			const diferencia = totalReal - r.efectivo;
			await db.insert(cortesSemanales).values({
				rangoInicio: r.start,
				rangoFin: r.end,
				totalCalculado: r.efectivo.toString(),
				totalReal: totalReal.toString(),
				efectivoReal: totalReal.toString(),
				transferenciasReales: r.transferencias.toString(),
				diferencia: diferencia.toString()
			});
			const cop = (n: number) => '$' + Math.abs(n).toLocaleString('es-CO');
			return {
				success: true,
				message:
					Math.abs(diferencia) < 1
						? `Corte guardado: el efectivo cuadra exacto (${cop(totalReal)}).`
						: `Corte guardado con ${diferencia > 0 ? 'sobrante' : 'faltante'} de ${cop(diferencia)} (esperado ${cop(r.efectivo)}, contado ${cop(totalReal)}).`
			};
		} catch (err) {
			console.error('Error corte semanal:', err);
			return fail(500, { error: 'Error al guardar el corte.' });
		}
	}
};
