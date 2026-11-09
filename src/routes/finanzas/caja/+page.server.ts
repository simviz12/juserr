import { db } from '$lib/server/db';
import { turnos, gastos, cierresDia } from '$lib/server/schema';
import { and, gte, lt, desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { businessDayKey, currentRange, isValidDateKey } from '$lib/features/finance/domain/period';
import { toNumber } from '$lib/features/finance/domain/metrics';

/** Fecha con la que se guarda el cierre: mediodía de Colombia del día de negocio (estable entre servidores). */
const cierreDate = (dayKey: string) => new Date(dayKey + 'T12:00:00-05:00');

async function resumenDelDia(dayKey: string) {
	const { start, end } = currentRange('diario', dayKey);
	const [ts, gs, existentes] = await Promise.all([
		db.select({ monto: turnos.monto, transferencias: turnos.transferencias }).from(turnos).where(and(gte(turnos.fecha, start), lt(turnos.fecha, end))),
		db.select({ monto: gastos.monto }).from(gastos).where(and(gte(gastos.fecha, start), lt(gastos.fecha, end))),
		// Compatibilidad: cierres antiguos se guardaban a medianoche (hora servidor)
		db.select({ id: cierresDia.id, fecha: cierresDia.fecha }).from(cierresDia).where(and(gte(cierresDia.fecha, new Date(start.getTime() - 86_400_000)), lt(cierresDia.fecha, end)))
	]);
	const efectivo = ts.reduce((a, t) => a + toNumber(t.monto), 0);
	const transferencias = ts.reduce((a, t) => a + toNumber(t.transferencias), 0);
	const totalGastos = gs.reduce((a, x) => a + toNumber(x.monto), 0);
	// La fecha UTC del registro coincide con el día cerrado (nuevos a mediodía Colombia, antiguos a medianoche)
	const yaCerrado = existentes.some((c) => c.fecha?.toISOString().slice(0, 10) === dayKey);
	return { dayKey, turnos: ts.length, efectivo, transferencias, gastos: totalGastos, yaCerrado };
}

export const load: PageServerLoad = async ({ url }) => {
	const f = url.searchParams.get('fecha');
	const dayKey = isValidDateKey(f) ? f : businessDayKey(new Date());

	const [preview, ultimosCierres] = await Promise.all([
		resumenDelDia(dayKey),
		db.select().from(cierresDia).orderBy(desc(cierresDia.fecha)).limit(30)
	]);

	return {
		preview,
		ultimosCierres: ultimosCierres.map((c) => ({
			id: c.id,
			fecha: c.fecha ? c.fecha.toISOString() : null,
			efectivo: toNumber(c.totalEfectivo),
			transferencias: toNumber(c.totalTransferencias),
			gastos: toNumber(c.totalGastos)
		}))
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const dayKey = formData.get('fecha')?.toString() ?? '';
		if (!isValidDateKey(dayKey)) return fail(400, { error: 'Selecciona una fecha válida.' });
		if (dayKey > businessDayKey(new Date())) return fail(400, { error: 'No puedes cerrar un día que aún no ha ocurrido.' });

		const r = await resumenDelDia(dayKey);
		if (r.yaCerrado) return fail(409, { error: `El día ${dayKey} ya tiene un cierre de caja registrado.` });
		if (r.turnos === 0 && r.gastos === 0) {
			return fail(400, { error: 'No hay turnos ni gastos registrados en esa fecha.' });
		}

		try {
			await db.insert(cierresDia).values({
				fecha: cierreDate(dayKey),
				totalEfectivo: r.efectivo.toString(),
				totalTransferencias: r.transferencias.toString(),
				totalTurnos: r.efectivo.toString(),
				totalGastos: r.gastos.toString()
			});
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Error al guardar el cierre de caja.' });
		}

		const cop = (n: number) => '$' + n.toLocaleString('es-CO');
		return {
			success: true,
			message: `Caja del ${dayKey} cerrada: efectivo ${cop(r.efectivo)} · Nequi ${cop(r.transferencias)} · total ${cop(r.efectivo + r.transferencias)}.`
		};
	}
};
