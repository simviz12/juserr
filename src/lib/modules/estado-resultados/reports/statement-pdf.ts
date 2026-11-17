/**
 * PDF propio del Estado de Resultados, con formato de estado financiero (no
 * la plantilla genérica de los reportes de caja):
 *
 *   1. Portada con banda oscura: negocio, periodo, base de preparación.
 *   2. Resultado del periodo destacado (utilidad o pérdida) y cifras clave.
 *   3. Cascada del resultado dibujada en vectores (nítida al imprimir).
 *   4. Márgenes con barras y referencia.
 *   5. El estado en formato contable: deducciones entre paréntesis,
 *      subtotales con filete, total con doble subrayado y comparativo coloreado.
 *   6. Lectura del resultado (hallazgos calculados de las cifras).
 *   7. Anexo con el detalle de movimientos, bases de preparación y firmas.
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

export interface StatementPdfInput {
	fileName: string;
	negocio: string;
	/** "1 nov 2026 – 30 nov 2026" */
	periodo: string;
	statement: Statement;
	comparativo: {
		/** "Periodo anterior", "Mismo periodo del año pasado"… */
		etiqueta: string;
		periodo: string;
		totales: Statement['totales'];
		margenes: Statement['margenes'];
		variaciones: Record<string, Variacion>;
	} | null;
	/** Máximo de movimientos para incluir el anexo de detalle. */
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
const BAR_BASE: RGB = [51, 65, 85];

const pesos = (cents: number) => fromCents(cents);
/** Convención contable: las deducciones y los resultados negativos van entre paréntesis. */
function contable(cents: number, entreParentesis: boolean): string {
	const v = pdfMoney(Math.abs(pesos(cents)));
	return entreParentesis && cents !== 0 ? `(${v})` : v;
}
function pct(v: number | null, digits = 1): string {
	if (v === null || !Number.isFinite(v)) return '-';
	return `${(v * 100).toFixed(digits).replace('.', ',')}%`;
}
const signo = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '');

const FECHA = new Intl.DateTimeFormat('es-CO', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	timeZone: 'America/Bogota'
});
const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'America/Bogota'
});
/**
 * Fecha del movimiento en hora de Colombia, igual que en pantalla. (Antes se
 * cortaba el ISO en UTC: un turno de las 11:30 p. m. salía con el día siguiente.)
 * Los manuales se guardan al mediodía de su día de negocio: se muestran sin hora.
 */
export function fechaMovimiento(m: Pick<Movimiento, 'fecha' | 'origen'>): string {
	if (!m.fecha) return '-';
	return (m.origen === 'ajuste' ? FECHA : FECHA_HORA).format(new Date(m.fecha));
}

/** Hallazgos en lenguaje sencillo, calculados de las cifras (nada inventado). */
export function lecturaDelResultado(input: StatementPdfInput): string[] {
	const { statement: st, comparativo: cmp } = input;
	const t = st.totales;
	const out: string[] = [];
	if (st.movimientos === 0) return ['No hay movimientos en el periodo: el informe está en ceros.'];

	if (st.margenes.neto !== null) {
		const cada100 = Math.round(st.margenes.neto * 100);
		out.push(
			t.utilidadNeta >= 0
				? `De cada $100 de ingresos netos quedaron $${cada100} de utilidad (margen neto ${pct(st.margenes.neto)}).`
				: `El periodo cerró en pérdida: por cada $100 de ingresos netos se perdieron $${Math.abs(cada100)} (margen neto ${pct(st.margenes.neto)}).`
		);
	}

	const costo = ratio(t.costoVentas, t.ingresosNetos);
	if (costo !== null) {
		const ref =
			costo <= 0.3
				? 'dentro de la referencia de comida rápida (hasta 30%)'
				: costo <= 0.35
					? 'en zona de vigilancia (30% a 35%)'
					: 'por encima de la referencia (más de 35%): revisa precios, porciones y mermas';
		out.push(`El costo de ventas fue el ${pct(costo)} de los ingresos netos, ${ref}.`);
	}

	const gastosOp = st.lineas.filter(
		(l) => l.nivel === 1 && l.id.startsWith('gastos_operacionales.')
	);
	if (gastosOp.length) {
		const mayor = gastosOp[0]; // ya vienen de mayor a menor
		out.push(
			`El gasto operacional más grande fue "${mayor.label}": ${pdfMoney(pesos(mayor.cents))}, el ${pct(ratio(mayor.cents, t.ingresosNetos))} de los ingresos netos.`
		);
	}

	if (t.devolucionesDescuentos > 0)
		out.push(
			`Devoluciones y descuentos restaron ${pdfMoney(pesos(t.devolucionesDescuentos))} (${pct(ratio(t.devolucionesDescuentos, t.ingresosOperacionales))} de las ventas).`
		);

	if (cmp) {
		const v = cmp.variaciones['utilidad_neta'];
		if (v && v.diferencia !== 0) {
			const sube = v.diferencia > 0;
			out.push(
				`Frente a ${cmp.etiqueta.toLowerCase()} (${cmp.periodo}), la utilidad neta ${sube ? 'mejoró' : 'bajó'} ${pdfMoney(Math.abs(pesos(v.diferencia)))}${v.pct !== null ? ` (${signo(v.pct)}${pct(Math.abs(v.pct))})` : ''}.`
			);
		}
		// La deducción que más creció (lo que más presionó el resultado)
		const deducciones = st.lineas
			.filter((l) => l.nivel === 1 && l.tipo === 'deduccion')
			.map((l) => ({ l, v: cmp.variaciones[l.id] }))
			.filter((x) => x.v && x.v.diferencia > 0)
			.sort((a, b) => b.v.diferencia - a.v.diferencia);
		if (deducciones[0])
			out.push(
				`Lo que más aumentó fue "${deducciones[0].l.label}": +${pdfMoney(pesos(deducciones[0].v.diferencia))} frente al periodo comparado.`
			);
	}
	return out;
}

/** Construye el documento (separado de la descarga para poder probarlo). */
export async function buildStatementPdf(input: StatementPdfInput) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);
	const st = input.statement;
	const t = st.totales;
	const cmp = input.comparativo;
	const negocio = pdfText(input.negocio);
	const periodo = pdfText(input.periodo);
	const perdida = t.utilidadNeta < 0;

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

	// ═════════════════ 1. Portada ═════════════════
	fill(NAVY);
	doc.rect(0, 0, W, 50, 'F');
	fill(GOLD);
	doc.rect(0, 50, W, 1.2, 'F');

	font('helvetica', 'bold', 8);
	color(GOLD);
	txt('ESTADO DE RESULTADOS', M, 15, { charSpace: 1.2 });
	font('times', 'bold', 22);
	doc.setTextColor(255, 255, 255);
	const nombre = doc.splitTextToSize(negocio, ancho * 0.62) as string[];
	doc.text(nombre.slice(0, 2), M, 25);
	font('helvetica', 'normal', 10);
	color(FAINT);
	txt(`Periodo: ${periodo}`, M, 25 + nombre.slice(0, 2).length * 8 + 1);

	font('helvetica', 'normal', 7.5);
	color(FAINT);
	const generado = new Date().toLocaleString('es-CO', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'America/Bogota'
	});
	const derecha = [
		'Informe gerencial · base caja',
		'Cifras en pesos colombianos (COP)',
		...(cmp ? [`Comparado con: ${cmp.periodo}`] : []),
		`Generado el ${generado}`
	];
	derecha.forEach((l, i) => txt(l, W - M, 15 + i * 4.6, { align: 'right' }));

	// ═════════════════ 2. Resultado destacado ═════════════════
	let y = 60;
	const alto = 34;
	fill(perdida ? NEG_SOFT : POS_SOFT);
	doc.roundedRect(M, y, ancho, alto, 2, 2, 'F');
	fill(perdida ? NEG : POS);
	doc.rect(M, y, 2.2, alto, 'F');

	font('helvetica', 'bold', 7.5);
	color(perdida ? NEG : POS);
	txt(perdida ? 'PÉRDIDA NETA DEL PERIODO' : 'UTILIDAD NETA DEL PERIODO', M + 7, y + 8, {
		charSpace: 0.5
	});
	font('times', 'bold', 26);
	color(INK);
	txt(contable(t.utilidadNeta, perdida), M + 7, y + 20);
	font('helvetica', 'normal', 8);
	color(MUTED);
	const lineaMargen = `Margen neto ${pct(st.margenes.neto)}`;
	txt(lineaMargen, M + 7, y + 26);
	if (cmp) {
		const v = cmp.variaciones['utilidad_neta'];
		if (v) {
			const bueno = v.diferencia >= 0;
			font('helvetica', 'bold', 8);
			color(v.diferencia === 0 ? MUTED : bueno ? POS : NEG);
			const varTxt =
				v.diferencia === 0
					? `Igual que ${cmp.etiqueta.toLowerCase()}`
					: `${signo(v.diferencia)}${pdfMoney(Math.abs(pesos(v.diferencia)))}${v.pct !== null ? ` (${signo(v.pct)}${pct(Math.abs(v.pct))})` : ''} vs. ${cmp.etiqueta.toLowerCase()}`;
			// En su propia línea: al lado del margen se cruzaba con las cifras clave.
			txt(varTxt, M + 7, y + 30.5);
		}
	}

	// Cifras clave a la derecha del bloque
	const clave: [string, string][] = [
		['Ingresos netos', pdfMoney(pesos(t.ingresosNetos))],
		['Costos y gastos', pdfMoney(pesos(t.costosGastosTotales))],
		['Movimientos', st.movimientos.toLocaleString('es-CO')]
	];
	const colW = 34;
	clave.forEach(([k, v], i) => {
		const x = W - M - (clave.length - i) * colW;
		draw(perdida ? ([252, 165, 165] as RGB) : ([167, 243, 208] as RGB));
		doc.setLineWidth(0.2);
		doc.line(x - 2, y + 6, x - 2, y + alto - 6);
		font('helvetica', 'normal', 7);
		color(MUTED);
		txt(k, x + 1, y + 12);
		font('helvetica', 'bold', 10);
		color(INK);
		txt(v, x + 1, y + 19);
	});
	y += alto + 10;

	// ═════════════════ 3. Cascada (vectorial) ═════════════════
	y = seccion('Cascada del resultado', y);
	const otrosNeto = t.otrosIngresos - t.otrosEgresos;
	const pasos: { label: string; valor: number; tipo: 'base' | 'resta' | 'suma' | 'total' }[] = [
		{ label: 'Ingresos netos', valor: t.ingresosNetos, tipo: 'base' },
		{ label: 'Costo de ventas', valor: -t.costoVentas, tipo: 'resta' },
		{ label: 'Gastos operac.', valor: -t.gastosOperacionales, tipo: 'resta' },
		{ label: 'No operacional', valor: otrosNeto, tipo: otrosNeto >= 0 ? 'suma' : 'resta' },
		{ label: 'Impuestos', valor: -t.impuestos, tipo: 'resta' },
		{ label: perdida ? 'Pérdida neta' : 'Utilidad neta', valor: t.utilidadNeta, tipo: 'total' }
	];
	// Tramos [desde, hasta] acumulados
	let acum = 0;
	const tramos = pasos.map((p) => {
		if (p.tipo === 'base' || p.tipo === 'total') {
			acum = p.valor;
			return { ...p, desde: 0, hasta: p.valor };
		}
		const desde = acum;
		acum += p.valor;
		return { ...p, desde, hasta: acum };
	});
	const maxV = Math.max(1, ...tramos.flatMap((tr) => [tr.desde, tr.hasta]));
	const minV = Math.min(0, ...tramos.flatMap((tr) => [tr.desde, tr.hasta]));
	const chartH = 50;
	const chartTop = y + 4;
	const escala = (v: number) => chartTop + ((maxV - v) / (maxV - minV)) * chartH;
	const slot = ancho / tramos.length;
	const barW = slot * 0.56;
	// línea de cero
	draw(RULE);
	doc.setLineWidth(0.2);
	doc.line(M, escala(0), W - M, escala(0));
	tramos.forEach((tr, i) => {
		const x = M + i * slot + (slot - barW) / 2;
		const y1 = escala(Math.max(tr.desde, tr.hasta));
		const y2 = escala(Math.min(tr.desde, tr.hasta));
		const h = Math.max(0.6, y2 - y1);
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
		doc.rect(x, y1, barW, h, 'F');
		// conector punteado hacia la siguiente barra
		if (i < tramos.length - 1) {
			draw(FAINT);
			doc.setLineWidth(0.15);
			doc.setLineDashPattern([0.8, 0.8], 0);
			doc.line(x + barW, escala(tr.hasta), x + slot, escala(tr.hasta));
			doc.setLineDashPattern([], 0);
		}
		font('helvetica', 'bold', 7);
		color(INK);
		const etiquetaValor =
			tr.tipo === 'base' || tr.tipo === 'total'
				? pdfMoney(pesos(tr.valor))
				: `${tr.valor < 0 ? '-' : '+'}${pdfMoney(Math.abs(pesos(tr.valor)))}`;
		txt(etiquetaValor, x + barW / 2, y1 - 1.5, { align: 'center' });
		font('helvetica', 'normal', 7);
		color(MUTED);
		txt(tr.label, x + barW / 2, chartTop + chartH + 5, { align: 'center' });
	});
	y = chartTop + chartH + 12;

	// ═════════════════ 4. Márgenes ═════════════════
	y = seccion('Márgenes sobre ingresos netos', y);
	const margenes: [string, number | null, number | null][] = [
		['Margen bruto', st.margenes.bruto, cmp?.margenes.bruto ?? null],
		['Margen operacional', st.margenes.operacional, cmp?.margenes.operacional ?? null],
		['Margen neto', st.margenes.neto, cmp?.margenes.neto ?? null]
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
	y += margenes.length * 8 + 6;

	// ═════════════════ 5. Estado en formato contable ═════════════════
	if (y > 205) {
		doc.addPage();
		y = 24;
	}
	y = seccion('Estado de resultados', y);
	const conCmp = !!cmp;
	const head = [
		'Concepto',
		// Con comparativo las columnas son angostas: el rango completo ya está en la portada.
		conCmp || input.periodo.length > 28 ? 'Actual' : periodo,
		'% ing.',
		...(conCmp ? ['Comparado', 'Variación', 'Var. %'] : [])
	].map(pdfText);
	const lineas = st.lineas;
	const fila = (l: StatementLine) => {
		const v = cmp?.variaciones[l.id];
		const parentesis = l.tipo === 'deduccion' || l.cents < 0;
		return [
			l.nivel === 1 ? `      ${l.label}` : l.label,
			contable(l.cents, parentesis),
			l.nivel === 1 ? '' : pct(ratio(l.cents, t.ingresosNetos)),
			...(v
				? [
						contable(v.anterior, l.tipo === 'deduccion' || v.anterior < 0),
						v.diferencia === 0
							? '-'
							: `${signo(v.diferencia)}${pdfMoney(Math.abs(pesos(v.diferencia)))}`,
						v.pct === null
							? v.diferencia === 0
								? '-'
								: 'nuevo'
							: `${signo(v.pct)}${pct(Math.abs(v.pct))}`
					]
				: [])
		].map((c) => pdfText(String(c)));
	};
	const numericas = conCmp ? [1, 2, 3, 4, 5] : [1, 2];
	autoTable(doc, {
		startY: y,
		margin: { left: M, right: M, top: 22, bottom: 20 },
		head: [head],
		body: lineas.map(fila),
		theme: 'plain',
		showHead: 'everyPage',
		styles: {
			font: 'helvetica',
			fontSize: 8.5,
			cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 },
			textColor: INK
		},
		headStyles: {
			fillColor: NAVY,
			textColor: [255, 255, 255],
			fontStyle: 'bold',
			fontSize: 7.5
		},
		columnStyles: {
			0: { cellWidth: conCmp ? 62 : 104 },
			...Object.fromEntries(numericas.map((i) => [i, { halign: 'right' as const }]))
		},
		didParseCell: (d) => {
			if (d.section === 'head') {
				if (numericas.includes(d.column.index)) d.cell.styles.halign = 'right';
				return;
			}
			const l = lineas[d.row.index];
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
			const l = lineas[d.row.index];
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
				// doble subrayado contable
				const yb = d.cell.y + d.cell.height;
				doc.setLineWidth(0.25);
				doc.line(x1, yb - 0.2, x2, yb - 0.2);
				doc.line(x1, yb + 0.6, x2, yb + 0.6);
			}
		}
	});
	y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
	font('helvetica', 'italic', 7);
	color(MUTED);
	txt(
		'Las deducciones y los resultados negativos se muestran entre paréntesis. "% ing." = participación sobre los ingresos netos.',
		M,
		y + 2
	);
	y += 10;

	// ═════════════════ 6. Lectura del resultado ═════════════════
	const lectura = lecturaDelResultado(input);
	if (lectura.length) {
		const altoLectura = lectura.reduce(
			(a, l) => a + (doc.splitTextToSize(pdfText(l), ancho - 10) as string[]).length * 4 + 2,
			0
		);
		if (y + altoLectura + 12 > H - 24) {
			doc.addPage();
			y = 24;
		}
		y = seccion('Lectura del resultado', y);
		lectura.forEach((l) => {
			const partes = doc.splitTextToSize(pdfText(l), ancho - 10) as string[];
			fill(GOLD);
			doc.circle(M + 1.6, y - 1.1, 0.9, 'F');
			font('helvetica', 'normal', 8.5);
			color(INK);
			doc.text(partes, M + 5, y);
			y += partes.length * 4 + 2;
		});
		y += 4;
	}

	// ═════════════════ 7. Anexo, bases y firmas ═════════════════
	const detalleMax = input.detalleMax ?? 150;
	const conDetalle = st.movimientos > 0 && st.movimientos <= detalleMax;
	if (conDetalle) {
		doc.addPage();
		y = 24;
		y = seccion('Anexo · Detalle de movimientos', y);
		for (const l of lineas.filter((x) => x.movimientos.length > 0)) {
			if (y > H - 50) {
				doc.addPage();
				y = 24;
			}
			const padre = lineas.find((p) => p.hijos.includes(l.id));
			font('times', 'bold', 10);
			color(NAVY_2);
			txt(padre ? `${padre.label} · ${l.label}` : l.label, M, y);
			autoTable(doc, {
				startY: y + 2,
				margin: { left: M, right: M, top: 22, bottom: 20 },
				head: [['Fecha', 'Concepto', 'Detalle', 'Monto'].map(pdfText)],
				body: l.movimientos.map((m) =>
					[fechaMovimiento(m), m.concepto, m.detalle ?? '', pdfMoney(pesos(m.cents))].map((c) =>
						pdfText(c)
					)
				),
				foot: [['', '', pdfText('Total'), pdfMoney(pesos(l.cents))]],
				theme: 'striped',
				showFoot: 'lastPage',
				styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.5, textColor: INK },
				headStyles: { fillColor: TINT, textColor: NAVY_2, fontStyle: 'bold' },
				alternateRowStyles: { fillColor: [250, 250, 252] },
				footStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold' },
				columnStyles: { 0: { cellWidth: 34 }, 3: { halign: 'right', cellWidth: 28 } },
				didParseCell: (d) => {
					if (d.column.index === 3 && d.section !== 'body') d.cell.styles.halign = 'right';
				}
			});
			y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
		}
	}

	const bases = [
		'Base caja: los ingresos se reconocen cuando se cobran (cierres de turno: efectivo + transferencias) y los costos cuando se pagan (compras de Bodega y gastos de caja).',
		'Los días se cuentan por jornada de negocio, de 04:00 a 04:00 (hora de Colombia).',
		'Costo de ventas: compras de insumos de Bodega y gastos de caja clasificados como insumos.',
		'Solo se incluyen registros confirmados; los movimientos manuales anulados no cuentan.',
		...(st.movimientos > detalleMax
			? [`El detalle de los ${st.movimientos} movimientos está en la exportación a Excel.`]
			: []),
		'Documento gerencial para la toma de decisiones. No reemplaza los estados financieros bajo NIIF ni las declaraciones tributarias.'
	];
	const altoBases =
		bases.reduce(
			(a, b) => a + (doc.splitTextToSize(pdfText(b), ancho - 6) as string[]).length * 3.6 + 1,
			0
		) + 40;
	if (y + altoBases > H - 22) {
		doc.addPage();
		y = 24;
	}
	y = seccion('Bases de preparación', y);
	font('helvetica', 'normal', 7.5);
	color(MUTED);
	bases.forEach((b) => {
		const partes = doc.splitTextToSize(pdfText(b), ancho - 6) as string[];
		txt('–', M, y);
		doc.text(partes, M + 4, y);
		y += partes.length * 3.6 + 1;
	});

	// Firmas
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
