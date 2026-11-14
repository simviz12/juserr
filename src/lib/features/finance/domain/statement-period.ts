/**
 * Rangos de fechas del Estado de Resultados (puros). Trabajan con claves de día
 * de negocio "YYYY-MM-DD" y aritmética UTC, así no dependen de la zona horaria
 * del servidor ni del navegador.
 */
import { isValidDateKey } from './period';

export interface KeyRange {
	/** Primer día incluido. */
	inicio: string;
	/** Último día incluido. */
	fin: string;
}

export const PRESETS = ['hoy', 'semana', 'mes', 'mes_anterior', 'trimestre', 'anio'] as const;
export type Preset = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<Preset, string> = {
	hoy: 'Hoy',
	semana: 'Esta semana',
	mes: 'Mes actual',
	mes_anterior: 'Mes anterior',
	trimestre: 'Trimestre',
	anio: 'Año actual'
};

export const COMPARACIONES = ['ninguna', 'anterior', 'anio'] as const;
export type Comparacion = (typeof COMPARACIONES)[number];

export const COMPARACION_LABELS: Record<Comparacion, string> = {
	ninguna: 'Sin comparar',
	anterior: 'Periodo anterior',
	anio: 'Año pasado'
};

export function parseComparacion(value: string | null): Comparacion {
	return (COMPARACIONES as readonly string[]).includes(value ?? '')
		? (value as Comparacion)
		: 'anterior';
}

const DAY_MS = 86_400_000;
const toUtc = (key: string) => Date.parse(key + 'T00:00:00Z');
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const parts = (key: string) => key.split('-').map(Number) as [number, number, number];
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addDays(key: string, days: number): string {
	return toKey(toUtc(key) + days * DAY_MS);
}

/** Días incluidos en el rango (ambos extremos cuentan). */
export function diasDelRango(r: KeyRange): number {
	return Math.round((toUtc(r.fin) - toUtc(r.inicio)) / DAY_MS) + 1;
}

/** Mismo día en otro mes/año; si no existe (31 → febrero) usa el último día del mes. */
function claveAjustada(y: number, m: number, d: number): string {
	const base = new Date(Date.UTC(y, m - 1, 1));
	const yy = base.getUTCFullYear();
	const mm = base.getUTCMonth() + 1;
	return `${yy}-${pad(mm)}-${pad(Math.min(d, lastDayOfMonth(yy, mm)))}`;
}

/**
 * Rango de un acceso rápido. Los periodos en curso terminan HOY (no al final
 * del mes/año) para que el comparativo sea contra el mismo tramo transcurrido.
 */
export function presetRange(preset: Preset, hoy: string): KeyRange {
	const [y, m] = parts(hoy);
	switch (preset) {
		case 'hoy':
			return { inicio: hoy, fin: hoy };
		case 'semana': {
			const dow = new Date(toUtc(hoy)).getUTCDay(); // 0 = domingo
			return { inicio: addDays(hoy, -(dow === 0 ? 6 : dow - 1)), fin: hoy };
		}
		case 'mes':
			return { inicio: `${y}-${pad(m)}-01`, fin: hoy };
		case 'mes_anterior': {
			const inicio = claveAjustada(y, m - 1, 1);
			const [py, pm] = parts(inicio);
			return { inicio, fin: `${py}-${pad(pm)}-${pad(lastDayOfMonth(py, pm))}` };
		}
		case 'trimestre':
			return { inicio: `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`, fin: hoy };
		case 'anio':
			return { inicio: `${y}-01-01`, fin: hoy };
	}
}

/** Qué acceso rápido corresponde al rango (para resaltarlo), si alguno. */
export function presetActivo(r: KeyRange, hoy: string): Preset | null {
	return (
		PRESETS.find((p) => {
			const x = presetRange(p, hoy);
			return x.inicio === r.inicio && x.fin === r.fin;
		}) ?? null
	);
}

/**
 * Normaliza el rango pedido por URL: claves inválidas caen al mes actual y un
 * rango invertido se ordena. Se limita a `maxDias` para acotar las consultas.
 */
export function resolveRange(
	inicioRaw: string | null,
	finRaw: string | null,
	hoy: string,
	maxDias = 1100
): KeyRange {
	const porDefecto = presetRange('mes', hoy);
	let inicio = isValidDateKey(inicioRaw) ? toKey(toUtc(inicioRaw)) : porDefecto.inicio;
	let fin = isValidDateKey(finRaw)
		? toKey(toUtc(finRaw))
		: isValidDateKey(inicioRaw)
			? inicio
			: porDefecto.fin;
	if (inicio > fin) [inicio, fin] = [fin, inicio];
	if (diasDelRango({ inicio, fin }) > maxDias) inicio = addDays(fin, -(maxDias - 1));
	return { inicio, fin };
}

/**
 * Periodo contra el que se compara.
 * - `anio`: las mismas fechas del año pasado.
 * - `anterior`: si el rango es un mes calendario (completo o del 1 a la fecha),
 *   el mismo tramo del mes previo; en otro caso, los N días inmediatamente anteriores.
 */
export function comparisonRange(r: KeyRange, modo: Comparacion): KeyRange | null {
	if (modo === 'ninguna') return null;
	const [iy, im, id] = parts(r.inicio);
	const [fy, fm, fd] = parts(r.fin);

	if (modo === 'anio') {
		return { inicio: claveAjustada(iy - 1, im, id), fin: claveAjustada(fy - 1, fm, fd) };
	}

	const mismoMes = iy === fy && im === fm;
	if (mismoMes && id === 1) {
		const mesCompleto = fd === lastDayOfMonth(fy, fm);
		const inicio = claveAjustada(iy, im - 1, 1);
		const [py, pm] = parts(inicio);
		return { inicio, fin: claveAjustada(py, pm, mesCompleto ? 31 : fd) };
	}

	const dias = diasDelRango(r);
	return { inicio: addDays(r.inicio, -dias), fin: addDays(r.inicio, -1) };
}
