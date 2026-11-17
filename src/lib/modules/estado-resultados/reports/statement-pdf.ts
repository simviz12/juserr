/**
 * PDF propio del Estado de Resultados, con formato de estado financiero (no
 * la plantilla genérica de los reportes de caja).
 *
 * Página 1 — resumen ejecutivo
 *   · Portada: negocio, periodo, base de preparación y DÍAS CON DATOS.
 *   · Avisos: días sin cierres de turno y gastos fijos sin registrar.
 *   · Resultado destacado (se llama "Resultado de caja" si faltan gastos fijos)
 *     y tres cifras de apoyo; si los periodos no tienen la misma cobertura, la
 *     comparación se hace por PROMEDIO DIARIO, no por totales.
 *   · Cascada vectorial (sin barras en cero) y márgenes.
 * Página 2 — ingresos y estado
 *   · Medios de pago, ventas por turno (día/noche) y ventas por día (los días
 *     sin cierres se ven como hueco).
 *   · El estado en formato contable y la lectura del resultado (alertas
 *     primero, luego lo de mayor monto).
 * Anexos — compras agrupadas por insumo (con variación de precio), gastos y
 *   cierres de turno; bases de preparación y firmas.
 *
 * jsPDF se carga bajo demanda. La función es pura respecto a la app (recibe el
 * informe ya calculado), así se prueba sin navegador.
 */
import { BRAND } from '$lib/config/brand';
import { pdfMoney, pdfText } from '$lib/features/finance/reports/pdf';
import { fromCents, ratio } from '$lib/features/finance/domain/money';
import {
	aumentoEsFavorable,
	type Movimiento,
	type Statement,
	type StatementLine,
	type Variacion
} from '../domain/income-statement';
import type { KeyRange } from '../domain/statement-period';
import { businessDayKey } from '$lib/features/finance/domain/period';
import {
	cantidadConUnidad,
	cobertura,
	comprasDe,
	comprasPorInsumo,
	gastosFijosFaltantes,
	mediosDePago,
	movimientosDe,
	pluralUnidad,
	promedioDiario,
	totalesComparables,
	tramos,
	ventasDe,
	ventasPorDia,
	ventasPorTurno,
	type Cobertura
} from '../domain/analisis';

export interface StatementPdfInput {
	fileName: string;
	negocio: string;
	/** "1 nov 2026 – 30 nov 2026" */
	periodo: string;
	/** Rango del informe (para contar días con datos). */
	rango: KeyRange;
	/** Día de negocio de hoy: los días futuros del rango no cuentan como "sin datos". */
	hoy?: string;
	statement: Statement;
	comparativo: {
		/** "Periodo anterior", "Año pasado"… */
		etiqueta: string;
		periodo: string;
		totales: Statement['totales'];
		margenes: Statement['margenes'];
		variaciones: Record<string, Variacion>;
		diasConDatos: number;
		diasRango: number;
	} | null;
	/** Máximo de cierres de turno para listarlos uno a uno en el anexo. */
	detalleMax?: number;
}

type RGB = [number, number, number];
const NAVY: RGB = [17, 24, 39];
const NAVY_2: RGB = [30, 41, 59];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const FAINT: RGB = [148, 163, 184];
const RULE: RGB = [203, 213, 225];
const TINT: RGB = [241, 245, 249];
const GOLD: RGB = [180, 142, 62];
const POS: RGB = [4, 120, 87];
const POS_SOFT: RGB = [209, 250, 229];
const NEG: RGB = [185, 28, 28];
const NEG_SOFT: RGB = [254, 226, 226];
const WARN: RGB = [146, 64, 14];
const WARN_SOFT: RGB = [254, 243, 199];
const BAR_BASE: RGB = [51, 65, 85];
const BAR_NOCHE: RGB = [30, 58, 138];
const BAR_DIA: RGB = [96, 165, 250];

const pesos = (cents: number) => fromCents(cents);
const $ = (cents: number) => pdfMoney(pesos(cents));
/** "$1,78 M" para textos cortos. */
function millones(cents: number): string {
	const v = pesos(cents);
	return Math.abs(v) >= 1_000_000
		? `$${(v / 1_000_000).toFixed(2).replace('.', ',')} M`
		: pdfMoney(v);
}
/** Convención contable: las deducciones y los resultados negativos van entre paréntesis. */
function contable(cents: number, entreParentesis: boolean): string {
	const v = $(Math.abs(cents));
	return entreParentesis && cents !== 0 ? `(${v})` : v;
}
function pct(v: number | null, digits = 1): string {
	if (v === null || !Number.isFinite(v)) return '-';
	return `${(v * 100).toFixed(digits).replace('.', ',')}%`;
}
const signo = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '');
const conSigno = (v: number | null) => (v === null ? '-' : `${signo(v)}${pct(Math.abs(v))}`);

// ── Fechas cortas (hora de Colombia) ─────────────────────────────────
const partes = (iso: string, conHora: boolean) => {
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('es-CO', {
			day: '2-digit',
			month: '2-digit',
			...(conHora ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
			timeZone: 'America/Bogota'
		})
			.formatToParts(new Date(iso))
			.map((x) => [x.type, x.value])
	);
	// es-CO a veces omite el cero inicial del día aunque se pida 2 dígitos
	const dd = String(p.day).padStart(2, '0');
	const mm = String(p.month).padStart(2, '0');
	return conHora ? `${dd}/${mm} ${p.hour}:${p.minute}` : `${dd}/${mm}`;
};
/**
 * Fecha del movimiento en hora de Colombia, corta para que no se parta en dos
 * líneas: "09/11 22:30". Los manuales (mediodía de su día de negocio) sin hora.
 */
export function fechaMovimiento(m: Pick<Movimiento, 'fecha' | 'origen'>): string {
	if (!m.fecha) return '-';
	return partes(m.fecha, m.origen !== 'ajuste');
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** "2026-11-10" → "10 nov". */
const diaCorto = (key: string) =>
	`${Number(key.slice(8, 10))} ${MESES[Number(key.slice(5, 7)) - 1]}`;
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaSemana = (key: string) => DIAS_SEMANA[new Date(key + 'T12:00:00Z').getUTCDay()];

/** "del 10 al 17 nov" / "el 12 nov" / "3 días sueltos". */
function describirHuecos(c: Cobertura): string {
	const t = tramos(c.diasSinDatos);
	const txt = t.map((x) =>
		x.desde === x.hasta
			? `el ${diaCorto(x.desde)}`
			: `del ${diaCorto(x.desde)} al ${diaCorto(x.hasta)}`
	);
	return txt.length <= 3 ? txt.join(', ') : `${c.diasSinDatos.length} días en ${t.length} tramos`;
}

// ── Análisis que comparten el PDF y la lectura ───────────────────────

interface Contexto {
	st: Statement;
	cob: Cobertura;
	faltanFijos: string[];
	/** Promedio diario de ventas (días con datos), actual y comparado. */
	promedio: number | null;
	promedioCmp: number | null;
	comparable: boolean;
}

function contexto(input: StatementPdfInput): Contexto {
	const st = input.statement;
	const cob = cobertura(ventasDe(st), input.rango, input.hoy);
	const cmp = input.comparativo;
	return {
		st,
		cob,
		faltanFijos: gastosFijosFaltantes(st),
		promedio: promedioDiario(st.totales.ingresosOperacionales, cob.diasConDatos),
		promedioCmp: cmp ? promedioDiario(cmp.totales.ingresosOperacionales, cmp.diasConDatos) : null,
		comparable: cmp
			? totalesComparables(cob.proporcion, cmp.diasRango ? cmp.diasConDatos / cmp.diasRango : 0)
			: true
	};
}

const NOMBRE_FIJO: Record<string, string> = { nomina: 'nómina', arriendo: 'arriendo' };

/** Nombre honesto del resultado: sin gastos fijos no es una "utilidad neta". */
function nombreResultado(ctx: Contexto, mayus = false): string {
	const perdida = ctx.st.totales.utilidadNeta < 0;
	const base = ctx.faltanFijos.length
		? perdida
			? 'Pérdida de caja del periodo'
			: 'Resultado de caja del periodo'
		: perdida
			? 'Pérdida neta del periodo'
			: 'Utilidad neta del periodo';
	return mayus ? base.toUpperCase() : base;
}

/**
 * Hallazgos en lenguaje sencillo, calculados de las cifras y ordenados por
 * importancia: primero lo que limita la lectura (datos faltantes), luego el
 * resultado, la comparación y los cambios de mayor monto.
 */
export function lecturaDelResultado(input: StatementPdfInput): string[] {
	const ctx = contexto(input);
	const { st, cob } = ctx;
	const t = st.totales;
	const cmp = input.comparativo;
	if (st.movimientos === 0) return ['No hay movimientos en el periodo: el informe está en ceros.'];
	const out: string[] = [];

	// 1. Alertas de datos
	if (cob.diasSinDatos.length > 0)
		out.push(
			`Faltan datos: no hay cierres de turno ${describirHuecos(cob)}. El informe cubre ${cob.diasConDatos} de ${cob.diasConDatos + cob.diasSinDatos.length} días; los totales no son comparables con un periodo completo.`
		);
	if (ctx.faltanFijos.length)
		out.push(
			`No se registró ${ctx.faltanFijos.map((c) => NOMBRE_FIJO[c] ?? c).join(' ni ')} en el periodo: el resultado no descuenta esos gastos fijos y se ve más alto de lo real. Regístralos en "Registrar movimiento".`
		);

	// 2. Resultado
	if (st.margenes.neto !== null) {
		const cada100 = Math.round(st.margenes.neto * 100);
		const que = ctx.faltanFijos.length ? 'antes de gastos fijos' : 'de utilidad';
		out.push(
			t.utilidadNeta >= 0
				? `De cada $100 de ingresos netos quedaron $${cada100} ${que} (margen ${pct(st.margenes.neto)}).`
				: `Por cada $100 de ingresos netos se perdieron $${Math.abs(cada100)} (margen ${pct(st.margenes.neto)}).`
		);
	}

	// 3. Comparación
	if (cmp) {
		if (!ctx.comparable && ctx.promedio !== null && ctx.promedioCmp) {
			const v = (ctx.promedio - ctx.promedioCmp) / ctx.promedioCmp;
			out.push(
				`Por día con datos se vendió ${millones(ctx.promedio)} en promedio, frente a ${millones(ctx.promedioCmp)} en ${cmp.etiqueta.toLowerCase()} (${conSigno(v)}). Es la comparación válida cuando los periodos no tienen los mismos días con datos.`
			);
		} else {
			const v = cmp.variaciones['utilidad_neta'];
			const vi = cmp.variaciones['ingresos_netos'];
			if (v && vi)
				out.push(
					`Frente a ${cmp.etiqueta.toLowerCase()}, los ingresos netos ${vi.diferencia >= 0 ? 'subieron' : 'bajaron'} ${$(Math.abs(vi.diferencia))} (${conSigno(vi.pct)}) y el resultado ${v.diferencia >= 0 ? 'mejoró' : 'bajó'} ${$(Math.abs(v.diferencia))} (${conSigno(v.pct)}).`
				);
			// Cambios de costo/gasto relevantes (≥ 1 % de los ingresos netos), de mayor a menor monto
			const umbral = Math.abs(t.ingresosNetos) * 0.01;
			const cambios = st.lineas
				.filter((l) => l.nivel === 1 && l.tipo === 'deduccion')
				.map((l) => ({ l, v: cmp.variaciones[l.id] }))
				.filter((x) => x.v && Math.abs(x.v.diferencia) >= umbral)
				.sort((a, b) => Math.abs(b.v.diferencia) - Math.abs(a.v.diferencia))
				.slice(0, 2);
			for (const { l, v: d } of cambios)
				out.push(
					`"${l.label}" ${d.diferencia > 0 ? 'subió' : 'bajó'} ${$(Math.abs(d.diferencia))} frente al periodo comparado.`
				);
		}
	}

	// 4. Costo (base caja: es costo de COMPRAS, no de consumo)
	const costo = ratio(t.costoVentas, t.ingresosNetos);
	if (costo !== null && t.costoVentas > 0)
		out.push(
			`Las compras de insumos equivalen al ${pct(costo)} de los ingresos netos. Es costo de compras, no de consumo: una compra hecha al final del periodo lo infla y una hecha antes lo reduce. Compáralo con la referencia de comida rápida (30%-35%) solo en meses completos.`
		);

	// 5. Ventas por medio de pago y por turno
	const medios = mediosDePago(ventasDe(st));
	const turnos = ventasPorTurno(ventasDe(st));
	if (medios.total > 0 && medios.transferencias > 0)
		out.push(
			`El ${pct(ratio(medios.transferencias, medios.total), 0)} de las ventas llegó por transferencia (${$(medios.transferencias)}) y el ${pct(ratio(medios.efectivo, medios.total), 0)} en efectivo.`
		);
	const noche = turnos.find((x) => x.turno === 'noche');
	const dia = turnos.find((x) => x.turno === 'dia');
	if (noche && dia && dia.promedio > 0)
		out.push(
			`El turno de noche vende ${millones(noche.promedio)} por cierre, ${conSigno((noche.promedio - dia.promedio) / dia.promedio)} frente al de día (${millones(dia.promedio)}).`
		);

	// 6. Precios de insumos que subieron
	const subidas = comprasPorInsumo(comprasDe(st))
		.filter((c) => c.variacionPrecio !== null && c.variacionPrecio >= 0.01)
		.sort((a, b) => b.cents - a.cents)
		.slice(0, 3);
	if (subidas.length)
		out.push(
			`Subieron de precio: ${subidas
				.map(
					(c) =>
						`${c.insumo} (${$(c.precioInicial!)} a ${$(c.precioFinal!)} por ${pluralUnidad(c.unidad, 1)}, ${conSigno(c.variacionPrecio)})`
				)
				.join('; ')}.`
		);

	// 7. Devoluciones
	if (t.devolucionesDescuentos > 0)
		out.push(
			`Devoluciones y descuentos restaron ${$(t.devolucionesDescuentos)} (${pct(ratio(t.devolucionesDescuentos, t.ingresosOperacionales))} de las ventas).`
		);
	return out;
}

/** Construye el documento (separado de la descarga para poder probarlo). */
export async function buildStatementPdf(input: StatementPdfInput) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);
	const ctx = contexto(input);
	const { st, cob } = ctx;
	const t = st.totales;
	const cmp = input.comparativo;
	const negocio = pdfText(input.negocio);
	const periodo = pdfText(input.periodo);
	const perdida = t.utilidadNeta < 0;
	const sinFijos = ctx.faltanFijos.length > 0;
	const ventas = ventasDe(st);

	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();
	const M = 16;
	const ancho = W - 2 * M;
	const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
	const draw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
	const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
	const font = (f: 'times' | 'helvetica', s: 'normal' | 'bold' | 'italic', size: number) => {
		doc.setFont(f, s);
		doc.setFontSize(size);
	};
	const txt = (s: string, x: number, y: number, o?: Parameters<typeof doc.text>[3]) =>
		doc.text(pdfText(s), x, y, o);
	const lineas = (s: string, w: number) => doc.splitTextToSize(pdfText(s), w) as string[];
	const finalY = () =>
		(doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
	const nuevaPagina = () => {
		doc.addPage();
		return 22;
	};
	const asegurar = (y: number, alto: number) => (y + alto > H - 20 ? nuevaPagina() : y);

	/** Título de sección: versalitas con filete dorado. */
	function seccion(titulo: string, y: number): number {
		font('helvetica', 'bold', 8.5);
		color(NAVY_2);
		txt(titulo.toUpperCase(), M, y, { charSpace: 0.6 });
		draw(GOLD);
		doc.setLineWidth(0.5);
		doc.line(M, y + 1.8, M + 14, y + 1.8);
		draw(RULE);
		doc.setLineWidth(0.15);
		doc.line(M + 15, y + 1.8, W - M, y + 1.8);
		return y + 7;
	}
	/** Recuadro de aviso (ámbar) con texto envuelto. Devuelve la nueva y. */
	function aviso(texto: string, y: number): number {
		const ls = lineas(texto, ancho - 12);
		const alto = ls.length * 3.9 + 5;
		fill(WARN_SOFT);
		doc.roundedRect(M, y, ancho, alto, 1.5, 1.5, 'F');
		fill(WARN);
		doc.rect(M, y, 1.6, alto, 'F');
		font('helvetica', 'bold', 8);
		color(WARN);
		txt('!', M + 4.5, y + 4.6);
		font('helvetica', 'normal', 8);
		doc.text(ls, M + 8, y + 4.6);
		return y + alto + 3;
	}

	// ═════════════════ 1. Portada ═════════════════
	// El bloque de datos (derecha) se mide primero; el nombre del negocio usa el
	// ancho que queda libre, así nunca se cruzan. Si queda muy poco (nombre o
	// datos largos), los datos pasan debajo del nombre (apilado).
	const generado = new Date().toLocaleString('es-CO', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'America/Bogota'
	});
	const transcurridos = cob.diasConDatos + cob.diasSinDatos.length;
	const AMBAR_CLARO: RGB = [251, 191, 36];
	const derecha: [string, RGB][] = [
		['Informe gerencial · base caja · COP', FAINT],
		[
			`Días con datos: ${cob.diasConDatos} de ${transcurridos}${transcurridos < cob.diasRango ? ` (de ${cob.diasRango} del rango)` : ''}`,
			cob.diasSinDatos.length ? AMBAR_CLARO : FAINT
		],
		...(cmp
			? ([[`Comparado con: ${cmp.periodo} (${cmp.diasConDatos} días con datos)`, FAINT]] as [
					string,
					RGB
				][])
			: []),
		[`Generado el ${generado}`, FAINT]
	];
	const anchoDerecha = Math.max(
		...derecha.map(([l, c]) => {
			font('helvetica', c === FAINT ? 'normal' : 'bold', 7.5);
			return doc.getTextWidth(pdfText(l));
		})
	);
	const GAP = 10;
	// Se prueba de la opción más amplia a la más compacta hasta que el nombre
	// quepa COMPLETO en 2 líneas: al lado de los datos (22 pt, 17 pt) o con
	// los datos debajo (22, 17, 14 pt). Nunca se corta el nombre.
	const anchoLado = ancho - anchoDerecha - GAP;
	const opciones: { apilado: boolean; tam: number }[] = [
		...(anchoLado >= 78
			? [
					{ apilado: false, tam: 22 },
					{ apilado: false, tam: 17 }
				]
			: []),
		{ apilado: true, tam: 22 },
		{ apilado: true, tam: 17 },
		{ apilado: true, tam: 14 }
	];
	let apilado = true;
	let tamNombre = 14;
	let nombre: string[] = [];
	for (const o of opciones) {
		font('times', 'bold', o.tam);
		const ls = lineas(negocio, o.apilado ? ancho : anchoLado);
		apilado = o.apilado;
		tamNombre = o.tam;
		nombre = ls;
		if (ls.length <= 2) break;
	}
	// Si ni a 14 pt cabe en 2 líneas, se usan las que hagan falta: la banda crece.
	const altoLinea = tamNombre * 0.3528 * 1.08;
	const yNombre = 25;
	const yPeriodo = yNombre + (nombre.length - 1) * altoLinea + 7;
	const yDatos = apilado ? yPeriodo + 6 : 15;
	const bandaH = apilado
		? yDatos + (derecha.length - 1) * 4.4 + 6
		: Math.max(50, yPeriodo + 8, 15 + (derecha.length - 1) * 4.6 + 8);

	fill(NAVY);
	doc.rect(0, 0, W, bandaH, 'F');
	fill(GOLD);
	doc.rect(0, bandaH, W, 1.2, 'F');
	font('helvetica', 'bold', 8);
	color(GOLD);
	txt('ESTADO DE RESULTADOS', M, 15, { charSpace: 1.2 });
	font('times', 'bold', tamNombre);
	doc.setTextColor(255, 255, 255);
	doc.text(nombre, M, yNombre, { lineHeightFactor: 1.08 });
	font('helvetica', 'normal', 10);
	color(FAINT);
	txt(`Periodo: ${periodo}`, M, yPeriodo);
	derecha.forEach(([l, c], i) => {
		color(c);
		font('helvetica', c === FAINT ? 'normal' : 'bold', 7.5);
		if (apilado) txt(l, M, yDatos + i * 4.4);
		else txt(l, W - M, yDatos + i * 4.6, { align: 'right' });
	});

	// ═════════════════ 2. Avisos + resultado destacado ═════════════════
	const yInicio = bandaH + 7;
	let y = yInicio;
	if (cob.diasSinDatos.length)
		y = aviso(
			`Periodo incompleto: no hay cierres de turno ${describirHuecos(cob)}. Las cifras cubren ${cob.diasConDatos} de ${transcurridos} días${cmp ? ' y la comparación se hace por promedio diario' : ''}.`,
			y
		);
	if (sinFijos)
		y = aviso(
			`Sin gastos fijos: no se registró ${ctx.faltanFijos.map((c) => NOMBRE_FIJO[c] ?? c).join(' ni ')}. El resultado es "de caja" (ventas menos compras y gastos de caja), no la utilidad real del negocio.`,
			y
		);
	if (y > yInicio) y += 2;

	const alto = 34;
	fill(perdida ? NEG_SOFT : POS_SOFT);
	doc.roundedRect(M, y, ancho, alto, 2, 2, 'F');
	fill(perdida ? NEG : POS);
	doc.rect(M, y, 2.2, alto, 'F');

	font('helvetica', 'bold', 7.5);
	color(perdida ? NEG : POS);
	txt(nombreResultado(ctx, true), M + 7, y + 8, { charSpace: 0.5 });
	font('times', 'bold', 26);
	color(INK);
	txt(contable(t.utilidadNeta, perdida), M + 7, y + 20);
	font('helvetica', 'normal', 8);
	color(MUTED);
	txt(`${sinFijos ? 'Margen de caja' : 'Margen neto'} ${pct(st.margenes.neto)}`, M + 7, y + 26);
	if (cmp) {
		let varTxt: string;
		let tono: RGB = MUTED;
		if (!ctx.comparable && ctx.promedio !== null && ctx.promedioCmp) {
			const v = (ctx.promedio - ctx.promedioCmp) / ctx.promedioCmp;
			varTxt = `Venta por día ${conSigno(v)} vs. ${cmp.etiqueta.toLowerCase()}`;
			tono = v === 0 ? MUTED : v > 0 ? POS : NEG;
		} else {
			const v = cmp.variaciones['utilidad_neta'];
			varTxt =
				!v || v.diferencia === 0
					? `Igual que ${cmp.etiqueta.toLowerCase()}`
					: `${signo(v.diferencia)}${$(Math.abs(v.diferencia))}${v.pct !== null ? ` (${conSigno(v.pct)})` : ''} vs. ${cmp.etiqueta.toLowerCase()}`;
			if (v && v.diferencia !== 0) tono = v.diferencia > 0 ? POS : NEG;
		}
		font('helvetica', 'bold', 8);
		color(tono);
		txt(varTxt, M + 7, y + 30.5);
	}

	// Tres cifras de apoyo
	const clave: [string, string, string?][] = [
		['Ingresos netos', $(t.ingresosNetos)],
		['Costos y gastos', $(t.costosGastosTotales)],
		[
			'Venta por día con datos',
			ctx.promedio === null ? '-' : $(ctx.promedio),
			cmp && ctx.promedioCmp ? `antes ${$(ctx.promedioCmp)}` : undefined
		]
	];
	const colW = 36;
	clave.forEach(([k, v, nota], i) => {
		const x = W - M - (clave.length - i) * colW;
		draw(perdida ? ([252, 165, 165] as RGB) : ([167, 243, 208] as RGB));
		doc.setLineWidth(0.2);
		doc.line(x - 2, y + 6, x - 2, y + alto - 6);
		font('helvetica', 'normal', 7);
		color(MUTED);
		txt(k, x + 1, y + 11);
		font('helvetica', 'bold', 10);
		color(INK);
		txt(v, x + 1, y + 18);
		if (nota) {
			font('helvetica', 'normal', 6.8);
			color(MUTED);
			txt(nota, x + 1, y + 23);
		}
	});
	y += alto + 9;

	// ═════════════════ 3. Cascada (sin barras en cero) ═════════════════
	y = seccion('Cascada del resultado', y);
	const otrosNeto = t.otrosIngresos - t.otrosEgresos;
	const pasos = (
		[
			{ label: 'Ingresos netos', valor: t.ingresosNetos, tipo: 'base' },
			{ label: 'Costo de ventas', valor: -t.costoVentas, tipo: 'resta' },
			{ label: 'Gastos operac.', valor: -t.gastosOperacionales, tipo: 'resta' },
			{ label: 'No operacional', valor: otrosNeto, tipo: otrosNeto >= 0 ? 'suma' : 'resta' },
			{ label: 'Impuestos', valor: -t.impuestos, tipo: 'resta' },
			{
				label: sinFijos ? 'Resultado de caja' : perdida ? 'Pérdida neta' : 'Utilidad neta',
				valor: t.utilidadNeta,
				tipo: 'total'
			}
		] as { label: string; valor: number; tipo: 'base' | 'resta' | 'suma' | 'total' }[]
	).filter((p) => p.tipo === 'base' || p.tipo === 'total' || p.valor !== 0);
	let acum = 0;
	const tramosCascada = pasos.map((p) => {
		if (p.tipo === 'base' || p.tipo === 'total') {
			acum = p.valor;
			return { ...p, desde: 0, hasta: p.valor };
		}
		const desde = acum;
		acum += p.valor;
		return { ...p, desde, hasta: acum };
	});
	const maxV = Math.max(1, ...tramosCascada.flatMap((tr) => [tr.desde, tr.hasta]));
	const minV = Math.min(0, ...tramosCascada.flatMap((tr) => [tr.desde, tr.hasta]));
	const chartH = 44;
	const chartTop = y + 4;
	const escala = (v: number) => chartTop + ((maxV - v) / (maxV - minV)) * chartH;
	const slot = ancho / tramosCascada.length;
	const barW = Math.min(30, slot * 0.56);
	draw(RULE);
	doc.setLineWidth(0.2);
	doc.line(M, escala(0), W - M, escala(0));
	tramosCascada.forEach((tr, i) => {
		const x = M + i * slot + (slot - barW) / 2;
		const y1 = escala(Math.max(tr.desde, tr.hasta));
		const y2 = escala(Math.min(tr.desde, tr.hasta));
		const c: RGB =
			tr.tipo === 'base'
				? BAR_BASE
				: tr.tipo === 'total'
					? tr.valor < 0
						? NEG
						: POS
					: tr.tipo === 'suma'
						? [16, 185, 129]
						: [239, 68, 68];
		fill(c);
		doc.rect(x, y1, barW, Math.max(0.6, y2 - y1), 'F');
		if (i < tramosCascada.length - 1) {
			draw(FAINT);
			doc.setLineWidth(0.15);
			doc.setLineDashPattern([0.8, 0.8], 0);
			doc.line(x + barW, escala(tr.hasta), x + slot + (slot - barW) / 2, escala(tr.hasta));
			doc.setLineDashPattern([], 0);
		}
		font('helvetica', 'bold', 7);
		color(INK);
		const etiquetaValor =
			tr.tipo === 'base' || tr.tipo === 'total'
				? $(tr.valor)
				: `${tr.valor < 0 ? '-' : '+'}${$(Math.abs(tr.valor))}`;
		txt(etiquetaValor, x + barW / 2, y1 - 1.5, { align: 'center' });
		font('helvetica', 'normal', 7);
		color(MUTED);
		txt(tr.label, x + barW / 2, chartTop + chartH + 5, { align: 'center' });
	});
	y = chartTop + chartH + 11;

	// ═════════════════ 4. Márgenes ═════════════════
	y = asegurar(y, 34);
	y = seccion('Márgenes sobre ingresos netos', y);
	const margenes: [string, number | null, number | null][] = [
		['Margen bruto', st.margenes.bruto, cmp?.margenes.bruto ?? null],
		['Margen operacional', st.margenes.operacional, cmp?.margenes.operacional ?? null],
		[sinFijos ? 'Margen de caja' : 'Margen neto', st.margenes.neto, cmp?.margenes.neto ?? null]
	];
	const etiquetaW = 38;
	const barraW = ancho - etiquetaW - 42;
	margenes.forEach(([label, v, prev], i) => {
		const yy = y + i * 8;
		font('helvetica', 'normal', 8.5);
		color(INK);
		txt(label, M, yy + 3.2);
		fill(TINT);
		doc.roundedRect(M + etiquetaW, yy, barraW, 4.2, 1, 1, 'F');
		if (v !== null) {
			const largo = Math.max(0, Math.min(1, Math.abs(v))) * barraW;
			fill(v < 0 ? NEG : i === 2 ? POS : NAVY_2);
			if (largo > 0.5) doc.roundedRect(M + etiquetaW, yy, largo, 4.2, 1, 1, 'F');
		}
		font('helvetica', 'bold', 9);
		color(v !== null && v < 0 ? NEG : INK);
		txt(pct(v), M + etiquetaW + barraW + 4, yy + 3.3);
		if (cmp && v !== null && prev !== null) {
			const pp = (v - prev) * 100;
			font('helvetica', 'normal', 7);
			color(Math.abs(pp) < 0.05 ? MUTED : pp > 0 ? POS : NEG);
			txt(`${signo(pp)}${Math.abs(pp).toFixed(1).replace('.', ',')} pp`, W - M, yy + 3.3, {
				align: 'right'
			});
		}
	});

	// ═════════════════ 5. Ingresos (página 2) ═════════════════
	y = nuevaPagina();
	y = seccion('Ingresos', y);
	const medios = mediosDePago(ventas);
	const porTurno = ventasPorTurno(ventas);
	const mitad = (ancho - 8) / 2;

	// 5a. Medios de pago: barra apilada + cifras
	font('helvetica', 'bold', 8);
	color(INK);
	txt('Por medio de pago', M, y);
	const pEf = ratio(medios.efectivo, medios.total) ?? 0;
	fill(TINT);
	doc.roundedRect(M, y + 3, mitad, 5, 1, 1, 'F');
	if (medios.total > 0) {
		fill(BAR_BASE);
		doc.rect(M, y + 3, mitad * pEf, 5, 'F');
		fill(BAR_DIA);
		doc.rect(M + mitad * pEf, y + 3, mitad * (1 - pEf), 5, 'F');
	}
	(
		[
			['Efectivo', medios.efectivo, BAR_BASE],
			['Transferencias', medios.transferencias, BAR_DIA]
		] as [string, number, RGB][]
	).forEach(([k, v, c], i) => {
		const yy = y + 13 + i * 5;
		fill(c);
		doc.rect(M, yy - 2.4, 2.5, 2.5, 'F');
		font('helvetica', 'normal', 8);
		color(INK);
		txt(k, M + 4, yy);
		font('helvetica', 'bold', 8);
		txt(`${$(v)}  (${pct(ratio(v, medios.total), 0)})`, M + mitad, yy, { align: 'right' });
	});

	// 5b. Por turno
	const xT = M + mitad + 8;
	font('helvetica', 'bold', 8);
	color(INK);
	txt('Por turno (hora del cierre)', xT, y);
	const maxProm = Math.max(1, ...porTurno.map((x) => x.promedio));
	porTurno.forEach((r, i) => {
		const yy = y + 5 + i * 9;
		font('helvetica', 'normal', 8);
		color(INK);
		txt(r.turno === 'noche' ? 'Noche' : 'Día / tarde', xT, yy + 2.8);
		const bw = mitad - 22;
		fill(TINT);
		doc.roundedRect(xT + 22, yy, bw, 3.6, 0.8, 0.8, 'F');
		fill(r.turno === 'noche' ? BAR_NOCHE : BAR_DIA);
		doc.roundedRect(xT + 22, yy, (r.promedio / maxProm) * bw, 3.6, 0.8, 0.8, 'F');
		font('helvetica', 'normal', 6.8);
		color(MUTED);
		txt(`${r.cierres} cierres · ${$(r.cents)} · ${$(r.promedio)} por cierre`, xT + 22, yy + 7);
	});
	y += 26;

	// 5c. Ventas por día. Los días sin cierres NO se dibujan como barras: solo
	// una franja ámbar mínima en la base y la nota "sin cierres" sobre el tramo.
	const dias = ventasPorDia(ventas, input.rango, input.hoy);
	if (dias.length > 1) {
		font('helvetica', 'bold', 8);
		color(INK);
		txt('Ventas por día', M, y);
		font('helvetica', 'normal', 6.8);
		color(MUTED);
		txt('Franja ámbar: días sin cierres de turno.', W - M, y, { align: 'right' });
		const top = y + 10; // espacio para el valor y la nota sobre la barra más alta
		const hh = 24;
		const conDatos = dias.filter((d) => d.cierres > 0);
		const maxD = Math.max(1, ...conDatos.map((d) => d.total));
		const iMax = dias.findIndex((d) => d.cierres > 0 && d.total === maxD);
		// Cierres "normales" por día = el valor más frecuente
		const frecuencia = new Map<number, number>();
		for (const d of conDatos) frecuencia.set(d.cierres, (frecuencia.get(d.cierres) ?? 0) + 1);
		const tipicos =
			[...frecuencia.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
		const s = ancho / dias.length;
		const bw = Math.max(0.8, s * 0.66);
		const conValores = s >= 7.5; // con muchos días no caben: se muestra solo el más alto
		const valorCorto = (c: number) => `$${(pesos(c) / 1_000_000).toFixed(2).replace('.', ',')} M`;
		dias.forEach((d, i) => {
			const x = M + i * s + (s - bw) / 2;
			const cx = x + bw / 2;
			if (d.cierres === 0) {
				fill(WARN_SOFT);
				doc.rect(x, top + hh - 1.4, bw, 1.4, 'F');
			} else {
				const h = Math.max(0.6, (d.total / maxD) * hh);
				const yb = top + hh - h;
				fill(i === iMax ? POS : BAR_BASE);
				doc.rect(x, yb, bw, h, 'F');
				if (conValores || i === iMax) {
					font('helvetica', 'bold', 5.6);
					color(i === iMax ? POS : INK);
					txt(valorCorto(d.total), cx, yb - 1.2, { align: 'center' });
				}
				const nota =
					i === iMax
						? 'más alto'
						: d.cierres < tipicos
							? d.cierres === 1
								? '1 solo cierre'
								: `${d.cierres} cierres`
							: '';
				if (nota) {
					font('helvetica', 'bold', 5.2);
					color(i === iMax ? POS : WARN);
					txt(nota, cx, yb - 4, { align: 'center' });
				}
			}
			const cada = dias.length > 20 ? 5 : dias.length > 12 ? 2 : 1;
			if (i % cada === 0 || i === dias.length - 1) {
				font('helvetica', 'normal', 5.8);
				color(MUTED);
				txt(diaCorto(d.dia), cx, top + hh + 3.5, { align: 'center' });
			}
		});
		// Nota sobre cada tramo de días sin cierres
		for (const tr of tramos(dias.filter((d) => d.cierres === 0).map((d) => d.dia))) {
			const i0 = dias.findIndex((d) => d.dia === tr.desde);
			const i1 = dias.findIndex((d) => d.dia === tr.hasta);
			const cx = M + ((i0 + i1 + 1) / 2) * s;
			const anchoTramo = (i1 - i0 + 1) * s;
			font('helvetica', 'italic', 6);
			color(WARN);
			const texto = anchoTramo > 34 ? 'sin cierres de turno' : anchoTramo > 14 ? 'sin cierres' : '';
			if (texto) txt(texto, cx, top + hh - 3, { align: 'center' });
		}
		draw(RULE);
		doc.setLineWidth(0.15);
		doc.line(M, top + hh, W - M, top + hh);
		y = top + hh + 9;
	}

	// ═════════════════ 6. Estado en formato contable ═════════════════
	y = asegurar(y, 60);
	y = seccion('Estado de resultados', y);
	const conCmp = !!cmp;
	const head = [
		'Concepto',
		conCmp || input.periodo.length > 28 ? 'Actual' : periodo,
		'% ing.',
		...(conCmp ? ['Comparado', 'Variación', 'Var. %'] : [])
	].map(pdfText);
	const filas = st.lineas;
	const fila = (l: StatementLine) => {
		const v = cmp?.variaciones[l.id];
		const parentesis = l.tipo === 'deduccion' || l.cents < 0;
		const label = l.tipo === 'total' ? nombreResultado(ctx) : l.label;
		return [
			l.nivel === 1 ? `      ${label}` : label,
			contable(l.cents, parentesis),
			l.nivel === 1 ? '' : pct(ratio(l.cents, t.ingresosNetos)),
			...(v
				? [
						contable(v.anterior, l.tipo === 'deduccion' || v.anterior < 0),
						v.diferencia === 0 ? '-' : `${signo(v.diferencia)}${$(Math.abs(v.diferencia))}`,
						v.pct === null ? (v.diferencia === 0 ? '-' : 'nuevo') : conSigno(v.pct)
					]
				: [])
		].map((c) => pdfText(String(c)));
	};
	const numericas = conCmp ? [1, 2, 3, 4, 5] : [1, 2];
	autoTable(doc, {
		startY: y,
		margin: { left: M, right: M, top: 22, bottom: 20 },
		head: [head],
		body: filas.map(fila),
		theme: 'plain',
		showHead: 'everyPage',
		rowPageBreak: 'avoid',
		styles: {
			font: 'helvetica',
			fontSize: 8,
			cellPadding: { top: 1.25, bottom: 1.25, left: 2, right: 2 },
			textColor: INK
		},
		headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
		columnStyles: {
			0: { cellWidth: conCmp ? 62 : 104 },
			...Object.fromEntries(numericas.map((i) => [i, { halign: 'right' as const }]))
		},
		didParseCell: (d) => {
			if (d.section === 'head') {
				if (numericas.includes(d.column.index)) d.cell.styles.halign = 'right';
				return;
			}
			const l = filas[d.row.index];
			if (!l) return;
			if (l.nivel === 1) {
				d.cell.styles.textColor = MUTED;
				d.cell.styles.fontSize = 7.8;
			} else if (l.tipo === 'subtotal') {
				d.cell.styles.fontStyle = 'bold';
				d.cell.styles.fillColor = TINT;
			} else if (l.tipo === 'total') {
				d.cell.styles.fontStyle = 'bold';
				d.cell.styles.fontSize = 9.5;
				d.cell.styles.fillColor = l.cents < 0 ? NEG_SOFT : POS_SOFT;
				if (d.column.index > 0 && d.column.index < 3)
					d.cell.styles.textColor = l.cents < 0 ? NEG : POS;
			} else {
				d.cell.styles.fontStyle = 'bold';
			}
			// Variación coloreada según si es buena o mala noticia
			if (cmp && (d.column.index === 4 || d.column.index === 5)) {
				const v = cmp.variaciones[l.id];
				if (v && v.diferencia !== 0) {
					const bueno = v.diferencia > 0 === aumentoEsFavorable(l.tipo);
					d.cell.styles.textColor = bueno ? POS : NEG;
				}
			}
		},
		didDrawCell: (d) => {
			if (d.section !== 'body') return;
			const l = filas[d.row.index];
			if (!l) return;
			const x1 = d.cell.x;
			const x2 = d.cell.x + d.cell.width;
			if (l.tipo === 'subtotal') {
				draw(NAVY_2);
				doc.setLineWidth(0.25);
				doc.line(x1, d.cell.y, x2, d.cell.y);
			}
			if (l.tipo === 'total') {
				draw(l.cents < 0 ? NEG : POS);
				doc.setLineWidth(0.35);
				doc.line(x1, d.cell.y, x2, d.cell.y);
				const yb = d.cell.y + d.cell.height;
				doc.setLineWidth(0.25);
				doc.line(x1, yb - 0.2, x2, yb - 0.2);
				doc.line(x1, yb + 0.6, x2, yb + 0.6);
			}
		}
	});
	y = finalY() + 4;
	font('helvetica', 'italic', 7);
	color(MUTED);
	const notaTabla = [
		'Las deducciones y los resultados negativos van entre paréntesis. "% ing." = participación sobre los ingresos netos.',
		...(cmp && !ctx.comparable
			? [
					'Los periodos no tienen los mismos días con datos: las variaciones en pesos comparan totales de distinta cobertura; usa el promedio diario de la portada.'
				]
			: [])
	];
	notaTabla.forEach((n) => {
		const ls = lineas(n, ancho);
		doc.text(ls, M, y + 2);
		y += ls.length * 3.4;
	});
	y += 7;

	// ═════════════════ 7. Lectura del resultado ═════════════════
	const lectura = lecturaDelResultado(input);
	if (lectura.length) {
		y = asegurar(y, 30);
		y = seccion('Lectura del resultado', y);
		lectura.forEach((l, i) => {
			// Las alertas de datos van marcadas en ámbar
			const esAlerta = i < (cob.diasSinDatos.length ? 1 : 0) + (sinFijos ? 1 : 0);
			font('helvetica', esAlerta ? 'bold' : 'normal', 8);
			const ls = lineas(l, ancho - 8);
			y = asegurar(y, ls.length * 3.7 + 1.6);
			fill(esAlerta ? WARN : GOLD);
			doc.circle(M + 1.6, y - 1.1, 0.9, 'F');
			color(esAlerta ? WARN : INK);
			doc.text(ls, M + 5, y);
			y += ls.length * 3.7 + 1.6;
		});
	}

	// ═════════════════ 8. Anexos ═════════════════
	const tablaAnexo = (
		titulo: string,
		head: string[],
		body: string[][],
		opts: {
			foot?: string[];
			numericas: number[];
			anchos?: Record<number, number>;
			resaltar?: (fila: number, col: number) => RGB | null;
		}
	) => {
		y = asegurar(y, 30);
		font('times', 'bold', 10);
		color(NAVY_2);
		txt(titulo, M, y);
		autoTable(doc, {
			startY: y + 2,
			margin: { left: M, right: M, top: 22, bottom: 20 },
			head: [head.map(pdfText)],
			body: body.map((r) => r.map((c) => pdfText(c))),
			foot: opts.foot ? [opts.foot.map(pdfText)] : undefined,
			theme: 'striped',
			showFoot: 'lastPage',
			rowPageBreak: 'avoid',
			styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.5, textColor: INK },
			headStyles: { fillColor: TINT, textColor: NAVY_2, fontStyle: 'bold' },
			alternateRowStyles: { fillColor: [250, 250, 252] },
			footStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold' },
			columnStyles: Object.fromEntries([
				...opts.numericas.map((i) => [i, { halign: 'right' as const }]),
				...Object.entries(opts.anchos ?? {}).map(([i, w]) => [
					Number(i),
					{
						cellWidth: w,
						...(opts.numericas.includes(Number(i)) ? { halign: 'right' as const } : {})
					}
				])
			]),
			didParseCell: (d) => {
				if (opts.numericas.includes(d.column.index) && d.section !== 'body')
					d.cell.styles.halign = 'right';
				if (d.section === 'body' && opts.resaltar) {
					const c = opts.resaltar(d.row.index, d.column.index);
					if (c) {
						d.cell.styles.textColor = c;
						d.cell.styles.fontStyle = 'bold';
					}
				}
			}
		});
		y = finalY() + 8;
	};

	const insumos = comprasPorInsumo(comprasDe(st));
	const gastosMovs = st.lineas
		.filter((l) => l.nivel === 1 && l.id !== 'costo_ventas.compras' && l.tipo === 'deduccion')
		.flatMap((l) => l.movimientos.map((m) => ({ m, cat: l.label })))
		.sort((a, b) => (a.m.fecha ?? '').localeCompare(b.m.fecha ?? ''));
	const otros = movimientosDe(st, 'otros_ingresos');
	const detalleMax = input.detalleMax ?? 150;

	// Los anexos siguen justo después de la lectura (sin forzar página nueva).
	if (insumos.length || gastosMovs.length || ventas.length) {
		y = asegurar(y + 2, 40);
		y = seccion('Anexos', y);
	}
	if (insumos.length)
		tablaAnexo(
			'A. Compras de insumos por producto',
			['Insumo', 'Nº', 'Cantidad', 'Total', 'Precio prom.', 'Precio mín. – máx.', 'Var.'],
			insumos.map((c) => [
				c.insumo,
				String(c.compras),
				cantidadConUnidad(c.cantidad, c.unidad),
				$(c.cents),
				c.precioPromedio === null ? '-' : `${$(c.precioPromedio)}/${pluralUnidad(c.unidad, 1)}`,
				c.precioMin === null || c.precioMax === null
					? '-'
					: c.precioMin === c.precioMax
						? $(c.precioMin)
						: `${$(c.precioMin)} – ${$(c.precioMax)}`,
				c.variacionPrecio === null ? '-' : conSigno(c.variacionPrecio)
			]),
			{
				foot: [
					'Total',
					String(insumos.reduce((a, c) => a + c.compras, 0)),
					'',
					$(insumos.reduce((a, c) => a + c.cents, 0)),
					'',
					'',
					''
				],
				numericas: [1, 3, 4, 6],
				anchos: { 0: 40, 1: 10, 5: 36, 6: 14 },
				resaltar: (r, col) => {
					const v = insumos[r]?.variacionPrecio;
					if (col !== 6 || v === null || v === undefined || Math.abs(v) < 0.005) return null;
					return v > 0 ? NEG : POS; // subir de precio es mala noticia
				}
			}
		);
	if (gastosMovs.length)
		tablaAnexo(
			'B. Gastos y deducciones',
			['Fecha', 'Concepto', 'Categoría', 'Monto'],
			gastosMovs.map(({ m, cat }) => [fechaMovimiento(m), m.concepto, cat, $(m.cents)]),
			{
				foot: ['', '', 'Total', $(gastosMovs.reduce((a, g) => a + g.m.cents, 0))],
				numericas: [3],
				anchos: { 0: 24, 3: 26 }
			}
		);
	if (otros.length)
		tablaAnexo(
			'C. Otros ingresos',
			['Fecha', 'Concepto', 'Monto'],
			otros.map((m) => [fechaMovimiento(m), m.concepto, $(m.cents)]),
			{ numericas: [2], anchos: { 0: 24, 2: 26 } }
		);
	if (ventas.length && ventas.length <= detalleMax) {
		const orden = [...ventas].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
		tablaAnexo(
			`${otros.length ? 'D' : 'C'}. Cierres de turno`,
			['Fecha', 'Día', 'Cierre', 'Efectivo', 'Transferencias', 'Total'],
			orden.map((m) => [
				fechaMovimiento(m),
				m.fecha ? diaSemana(businessDayKey(m.fecha)) : '',
				m.concepto.replace('Cierre de turno ', ''),
				$(m.efectivoCents ?? m.cents),
				$(m.transferenciasCents ?? 0),
				$(m.cents)
			]),
			{
				foot: ['', '', 'Total', $(medios.efectivo), $(medios.transferencias), $(medios.total)],
				numericas: [3, 4, 5],
				anchos: { 0: 24, 1: 12 }
			}
		);
	}

	// ═════════════════ 9. Bases de preparación y firmas ═════════════════
	const bases = [
		'Base caja: los ingresos se reconocen cuando se cobran (cierres de turno: efectivo + transferencias) y los costos cuando se pagan (compras de Bodega y gastos de caja).',
		'El costo de ventas es costo de COMPRAS del periodo, no de consumo: no se ajusta con el inventario inicial y final.',
		'Los días se cuentan por jornada de negocio, de 04:00 a 04:00 (hora de Colombia). Los turnos que cierran desde las 6:00 p. m. se cuentan como turno de noche.',
		'Solo se incluyen registros confirmados; los movimientos manuales anulados no cuentan.',
		...(ventas.length > detalleMax
			? [`Los ${ventas.length} cierres de turno se detallan en la exportación a Excel.`]
			: []),
		'Documento gerencial para la toma de decisiones. No reemplaza los estados financieros bajo NIIF ni las declaraciones tributarias.'
	];
	const altoBases = bases.reduce((a, b) => a + lineas(b, ancho - 6).length * 3.6 + 1, 0) + 42;
	y = asegurar(y, altoBases);
	y = seccion('Bases de preparación', y);
	font('helvetica', 'normal', 7.5);
	color(MUTED);
	bases.forEach((b) => {
		const ls = lineas(b, ancho - 6);
		txt('-', M, y);
		doc.text(ls, M + 4, y);
		y += ls.length * 3.6 + 1;
	});
	y += 16;
	const firmaW = (ancho - 20) / 2;
	(['Elaboró', 'Revisó y aprobó'] as const).forEach((rol, i) => {
		const x = M + i * (firmaW + 20);
		draw(INK);
		doc.setLineWidth(0.2);
		doc.line(x, y, x + firmaW, y);
		font('helvetica', 'bold', 7.5);
		color(INK);
		txt(rol, x, y + 4);
		font('helvetica', 'normal', 7);
		color(MUTED);
		txt('Nombre, cargo y fecha', x, y + 8);
	});

	// ═════════════════ Encabezado y pie en todas las páginas ═════════════════
	const paginas = doc.getNumberOfPages();
	for (let p = 1; p <= paginas; p++) {
		doc.setPage(p);
		if (p > 1) {
			fill(NAVY);
			doc.rect(0, 0, W, 13, 'F');
			fill(GOLD);
			doc.rect(0, 13, W, 0.6, 'F');
			font('helvetica', 'bold', 7.5);
			color(GOLD);
			txt('ESTADO DE RESULTADOS', M, 8.2, { charSpace: 0.8 });
			font('helvetica', 'normal', 7.5);
			doc.setTextColor(255, 255, 255);
			txt(`${negocio} · ${periodo}`, W - M, 8.2, { align: 'right' });
		}
		draw(RULE);
		doc.setLineWidth(0.15);
		doc.line(M, H - 13, W - M, H - 13);
		font('helvetica', 'normal', 6.8);
		color(MUTED);
		txt(`${BRAND.name} · Informe gerencial en base caja`, M, H - 8.5);
		txt(`Página ${p} de ${paginas}`, W - M, H - 8.5, { align: 'right' });
	}

	return doc;
}

export async function downloadStatementPdf(input: StatementPdfInput): Promise<void> {
	const doc = await buildStatementPdf(input);
	doc.save(`${input.fileName}.pdf`);
}
