/**
 * Reglas de calendario del negocio (puras, sin dependencias de BD ni UI).
 *
 * - Zona horaria: Colombia (UTC-5, sin horario de verano).
 * - El "día de negocio" arranca a las 04:00: un turno cerrado a la 1 a.m.
 *   pertenece a la jornada del día anterior.
 */
import { getRange } from '$lib/utils/date';

export type RangeType = 'diario' | 'semanal' | 'mensual' | 'anual';
export const RANGE_TYPES: readonly RangeType[] = ['diario', 'semanal', 'mensual', 'anual'];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const COLOMBIA_OFFSET_H = 5;
const BUSINESS_DAY_START_H = 4;

export interface DateRange {
	start: Date;
	end: Date;
}

export function parseRangeType(value: string | null): RangeType {
	return (RANGE_TYPES as readonly string[]).includes(value ?? '') ? (value as RangeType) : 'diario';
}

/** Clave YYYY-MM-DD del día de negocio al que pertenece un instante. */
export function businessDayKey(instant: Date | string): string {
	const t = new Date(instant).getTime();
	return new Date(t - (COLOMBIA_OFFSET_H + BUSINESS_DAY_START_H) * HOUR).toISOString().slice(0, 10);
}

export function isValidDateKey(value: string | null | undefined): value is string {
	return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function currentRange(type: RangeType, dateKey?: string): DateRange {
	return getRange(type, isValidDateKey(dateKey) ? dateKey : undefined);
}

/**
 * Período anterior del mismo tipo (ayer, semana pasada, mes pasado...).
 * Si el período actual está EN CURSO, el anterior se recorta al mismo tiempo
 * transcurrido (p. ej. 1–9 nov se compara con 1–9 oct, no con octubre completo).
 */
export function previousRange(type: RangeType, current: DateRange, now: Date = new Date()): DateRange {
	const prev = getRange(type, businessDayKey(new Date(current.start.getTime() - 1)));
	const t = now.getTime();
	if (t > current.start.getTime() && t < current.end.getTime()) {
		const elapsed = t - current.start.getTime();
		return { start: prev.start, end: new Date(Math.min(prev.end.getTime(), prev.start.getTime() + elapsed)) };
	}
	return prev;
}

export interface SeriesBucket {
	key: string;
	label: string;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Ventana del gráfico de flujo de caja. Para "diario" se muestran los últimos
 * 7 días (un solo punto no aporta contexto).
 */
export function seriesWindow(type: RangeType, current: DateRange): DateRange {
	if (type === 'diario') {
		return { start: new Date(current.start.getTime() - 6 * DAY), end: current.end };
	}
	return current;
}

/** Clave de agrupación de un instante según la granularidad del gráfico. */
export function bucketKey(type: RangeType, instant: Date | string): string {
	const day = businessDayKey(instant);
	return type === 'anual' ? day.slice(0, 7) : day;
}

export function buildBuckets(type: RangeType, window: DateRange): SeriesBucket[] {
	if (type === 'anual') {
		const year = businessDayKey(window.start).slice(0, 4);
		return MONTHS.map((m, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, label: m }));
	}
	const buckets: SeriesBucket[] = [];
	// +12h para caer a mitad de la jornada y evitar bordes.
	for (let t = window.start.getTime() + 12 * HOUR; t < window.end.getTime(); t += DAY) {
		const key = businessDayKey(new Date(t));
		const d = new Date(key + 'T12:00:00Z');
		const label =
			type === 'mensual'
				? String(d.getUTCDate())
				: `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
		buckets.push({ key, label });
	}
	return buckets;
}
