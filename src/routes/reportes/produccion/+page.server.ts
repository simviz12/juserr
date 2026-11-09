import { db } from '$lib/server/db';
import { turnos } from '$lib/server/schema';
import { and, gte, lt, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { businessDayKey, currentRange, isValidDateKey } from '$lib/features/finance/domain/period';

export const load: PageServerLoad = async ({ url }) => {
	const mes = currentRange('mensual');
	const iRaw = url.searchParams.get('inicio');
	const fRaw = url.searchParams.get('fin');
	let inicio = isValidDateKey(iRaw) ? iRaw : businessDayKey(mes.start);
	let fin = isValidDateKey(fRaw) ? fRaw : businessDayKey(new Date());
	if (inicio > fin) [inicio, fin] = [fin, inicio];

	const rows = await db
		.select({
			fecha: turnos.fecha,
			masasIniciales: turnos.masasIniciales,
			masasSobrantes: turnos.masasSobrantes,
			vendidas: turnos.porcionesVendidasCalculado,
			mermas: turnos.porcionesMermadas
		})
		.from(turnos)
		.where(and(gte(turnos.fecha, currentRange('diario', inicio).start), lt(turnos.fecha, currentRange('diario', fin).end)))
		.orderBy(asc(turnos.fecha));

	const dias = new Map<string, { fecha: string; masas: number; vendidas: number; mermas: number; turnos: number }>();
	for (const r of rows) {
		if (!r.fecha) continue;
		const k = businessDayKey(r.fecha);
		const d = dias.get(k) ?? { fecha: k, masas: 0, vendidas: 0, mermas: 0, turnos: 0 };
		d.masas += Math.max(0, (r.masasIniciales ?? 0) - (r.masasSobrantes ?? 0)); // masas REALMENTE usadas
		d.vendidas += r.vendidas ?? 0;
		d.mermas += r.mermas ?? 0;
		d.turnos += 1;
		dias.set(k, d);
	}
	const produccion = [...dias.values()];
	const tot = produccion.reduce((a, d) => ({ masas: a.masas + d.masas, vendidas: a.vendidas + d.vendidas, mermas: a.mermas + d.mermas }), { masas: 0, vendidas: 0, mermas: 0 });

	return { inicio, fin, produccion, totales: tot };
};
