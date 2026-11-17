/**
 * Análisis complementario del Estado de Resultados (lógica pura, sin BD).
 *
 * Responde preguntas que el estado contable por sí solo esconde:
 *   - ¿El periodo tiene datos todos los días? (un rango con días sin cierres
 *     compara mal contra uno completo);
 *   - ¿cuánto se vende en promedio por día con datos?;
 *   - ¿cómo se reparte la venta por medio de pago y por turno?;
 *   - ¿cuánto se compró de cada insumo y cómo cambió su precio?;
 *   - ¿el informe incluye gastos fijos (nómina, arriendo)?
 */
import { businessDayKey, addDays } from '$lib/features/finance/domain/period';
import type { Movimiento, Statement } from './income-statement';
import { diasDelRango, type KeyRange } from './statement-period';

// ── Plurales ─────────────────────────────────────────────────────────

/** "4 paquete" → "4 paquetes"; "1 kilo" queda en singular. */
export function pluralUnidad(unidad: string, cantidad: number): string {
	const u = unidad.trim();
	if (!u || Math.abs(cantidad) === 1) return u;
	if (/[aeiouáéó]$/i.test(u)) return u + 's';
	if (/z$/i.test(u)) return u.slice(0, -1) + 'ces';
	if (/ón$/i.test(u)) return u.slice(0, -2) + 'ones';
	return u + 'es';
}

/** "6,5 kilos", "1 paquete", "2 unidades". */
export function cantidadConUnidad(cantidad: number, unidad: string): string {
	const n = cantidad.toLocaleString('es-CO', { maximumFractionDigits: 3 });
	return `${n} ${pluralUnidad(unidad, cantidad)}`.trim();
}

// ── Cobertura del periodo ────────────────────────────────────────────

export interface Cobertura {
	diasRango: number;
	diasConDatos: number;
	/** Días del rango (hasta `hoy`) sin ningún cierre de turno. */
	diasSinDatos: string[];
	/** Último día con un cierre de turno, o null. */
	ultimoDiaConDatos: string | null;
	/** diasConDatos / días transcurridos del rango (0..1). */
	proporcion: number;
}

/**
 * Días del rango con al menos un cierre de turno. Si el rango llega al futuro
 * (p. ej. "este mes"), solo cuentan los días hasta `hoy`.
 */
export function cobertura(ventas: readonly Movimiento[], rango: KeyRange, hoy?: string): Cobertura {
	const fin = hoy && hoy < rango.fin ? hoy : rango.fin;
	const transcurridos = fin < rango.inicio ? 0 : diasDelRango({ inicio: rango.inicio, fin });
	const dias = new Set(ventas.filter((v) => v.fecha).map((v) => businessDayKey(v.fecha!)));
	const sin: string[] = [];
	for (let i = 0; i < transcurridos; i++) {
		const d = addDays(rango.inicio, i);
		if (!dias.has(d)) sin.push(d);
	}
	const ordenados = [...dias].filter((d) => d >= rango.inicio && d <= rango.fin).sort();
	return {
		diasRango: diasDelRango(rango),
		diasConDatos: ordenados.length,
		diasSinDatos: sin,
		ultimoDiaConDatos: ordenados.at(-1) ?? null,
		proporcion: transcurridos ? ordenados.length / transcurridos : 0
	};
}

/** Agrupa días consecutivos: ["2026-11-10".."2026-11-17"] → [{desde, hasta}]. */
export function tramos(dias: readonly string[]): { desde: string; hasta: string }[] {
	const out: { desde: string; hasta: string }[] = [];
	for (const d of [...dias].sort()) {
		const ultimo = out.at(-1);
		if (ultimo && addDays(ultimo.hasta, 1) === d) ultimo.hasta = d;
		else out.push({ desde: d, hasta: d });
	}
	return out;
}

/** Promedio de ventas por día con datos (centavos), o null si no hubo días. */
export const promedioDiario = (ventasCents: number, diasConDatos: number) =>
	diasConDatos > 0 ? Math.round(ventasCents / diasConDatos) : null;

/**
 * ¿Se pueden comparar los totales de dos periodos? Solo si ambos tienen datos
 * en casi todos sus días; si no, hay que comparar promedios diarios.
 */
export const totalesComparables = (a: number, b: number) => a >= 0.9 && b >= 0.9;

// ── Ventas ───────────────────────────────────────────────────────────

export interface MediosDePago {
	efectivo: number;
	transferencias: number;
	total: number;
}

export function mediosDePago(ventas: readonly Movimiento[]): MediosDePago {
	let efectivo = 0;
	let transferencias = 0;
	for (const v of ventas) {
		efectivo += v.efectivoCents ?? v.cents;
		transferencias += v.transferenciasCents ?? 0;
	}
	return { efectivo, transferencias, total: efectivo + transferencias };
}

/** Hora (Colombia) desde la que un cierre cuenta como turno de noche. */
export const HORA_NOCHE = 18;

const horaColombia = new Intl.DateTimeFormat('en-US', {
	hour: 'numeric',
	hourCycle: 'h23',
	timeZone: 'America/Bogota'
});

export function turnoDe(fechaIso: string): 'dia' | 'noche' {
	const h = Number(horaColombia.format(new Date(fechaIso)));
	return h >= HORA_NOCHE || h < 4 ? 'noche' : 'dia';
}

export interface ResumenTurno {
	turno: 'dia' | 'noche';
	cierres: number;
	cents: number;
	promedio: number;
}

export function ventasPorTurno(ventas: readonly Movimiento[]): ResumenTurno[] {
	const acc = { dia: { n: 0, c: 0 }, noche: { n: 0, c: 0 } };
	for (const v of ventas) {
		if (!v.fecha) continue;
		const t = turnoDe(v.fecha);
		acc[t].n++;
		acc[t].c += v.cents;
	}
	return (['dia', 'noche'] as const)
		.filter((t) => acc[t].n > 0)
		.map((t) => ({
			turno: t,
			cierres: acc[t].n,
			cents: acc[t].c,
			promedio: Math.round(acc[t].c / acc[t].n)
		}));
}

export interface VentaDia {
	dia: string;
	cierres: number;
	efectivo: number;
	transferencias: number;
	total: number;
}

/** Ventas por día de negocio, incluidos los días SIN cierres (en cero). */
export function ventasPorDia(
	ventas: readonly Movimiento[],
	rango: KeyRange,
	hoy?: string
): VentaDia[] {
	const fin = hoy && hoy < rango.fin ? hoy : rango.fin;
	const n = fin < rango.inicio ? 0 : diasDelRango({ inicio: rango.inicio, fin });
	const mapa = new Map<string, VentaDia>();
	for (let i = 0; i < n; i++) {
		const d = addDays(rango.inicio, i);
		mapa.set(d, { dia: d, cierres: 0, efectivo: 0, transferencias: 0, total: 0 });
	}
	for (const v of ventas) {
		if (!v.fecha) continue;
		const fila = mapa.get(businessDayKey(v.fecha));
		if (!fila) continue;
		fila.cierres++;
		fila.efectivo += v.efectivoCents ?? v.cents;
		fila.transferencias += v.transferenciasCents ?? 0;
		fila.total += v.cents;
	}
	return [...mapa.values()];
}

// ── Compras por insumo ───────────────────────────────────────────────

export interface CompraInsumo {
	insumo: string;
	unidad: string;
	compras: number;
	cantidad: number;
	cents: number;
	/** Precio promedio ponderado por unidad (centavos), null si no hay cantidad. */
	precioPromedio: number | null;
	/** Precio unitario de la primera y la última compra del periodo. */
	precioInicial: number | null;
	precioFinal: number | null;
	/** Precio unitario más bajo y más alto pagado en el periodo. */
	precioMin: number | null;
	precioMax: number | null;
	/** Variación del precio unitario (0.016 = +1,6 %), null si hubo una sola compra. */
	variacionPrecio: number | null;
}

export function comprasPorInsumo(compras: readonly Movimiento[]): CompraInsumo[] {
	const grupos = new Map<string, Movimiento[]>();
	for (const c of compras) {
		const k = c.concepto;
		grupos.set(k, [...(grupos.get(k) ?? []), c]);
	}
	const unit = (m: Movimiento) => (m.cantidad && m.cantidad > 0 ? m.cents / m.cantidad : null);
	return [...grupos.entries()]
		.map(([insumo, ms]) => {
			const orden = [...ms].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
			const cantidad = ms.reduce((a, m) => a + (m.cantidad ?? 0), 0);
			const cents = ms.reduce((a, m) => a + m.cents, 0);
			const conPrecio = orden.filter((m) => unit(m) !== null);
			const ini = conPrecio[0] ? unit(conPrecio[0]) : null;
			const fin = conPrecio.at(-1) ? unit(conPrecio.at(-1)!) : null;
			return {
				insumo,
				unidad: ms.find((m) => m.unidad)?.unidad ?? '',
				compras: ms.length,
				cantidad,
				cents,
				precioPromedio: cantidad > 0 ? Math.round(cents / cantidad) : null,
				precioMin: conPrecio.length
					? Math.round(Math.min(...conPrecio.map((m) => unit(m)!)))
					: null,
				precioMax: conPrecio.length
					? Math.round(Math.max(...conPrecio.map((m) => unit(m)!)))
					: null,
				precioInicial: ini === null ? null : Math.round(ini),
				precioFinal: fin === null ? null : Math.round(fin),
				variacionPrecio: conPrecio.length > 1 && ini && fin !== null ? (fin - ini) / ini : null
			};
		})
		.sort((a, b) => b.cents - a.cents || a.insumo.localeCompare(b.insumo));
}

// ── Gastos fijos ─────────────────────────────────────────────────────

/** Categorías que casi todo restaurante paga cada mes. */
export const CATEGORIAS_FIJAS = ['nomina', 'arriendo'] as const;

/** Categorías fijas SIN ningún registro en el periodo (según las líneas del estado). */
export function gastosFijosFaltantes(st: Statement): string[] {
	const presentes = new Set(
		st.lineas.filter((l) => l.cents > 0).map((l) => l.id.replace('gastos_operacionales.', ''))
	);
	return CATEGORIAS_FIJAS.filter((c) => !presentes.has(c));
}

/** Movimientos de una línea del estado por id (p. ej. ventas, compras de Bodega). */
export const movimientosDe = (st: Statement, id: string): Movimiento[] =>
	st.lineas.find((l) => l.id === id)?.movimientos ?? [];
export const ventasDe = (st: Statement) => movimientosDe(st, 'ingresos_operacionales');
export const comprasDe = (st: Statement) => movimientosDe(st, 'costo_ventas.compras');
