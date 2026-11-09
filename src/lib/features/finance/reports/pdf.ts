/**
 * Generador de reportes PDF financieros. jsPDF se carga bajo demanda (solo al
 * exportar), no en cada visita.
 */
import { BRAND } from '$lib/config/brand';

export interface PdfKpi {
	label: string;
	value: string;
	hint?: string;
}

export interface PdfTable {
	title: string;
	head: string[];
	body: (string | number)[][];
	/** Índices de columnas numéricas (alineadas a la derecha). */
	numeric?: number[];
	/** Fila de totales opcional, en negrita. */
	foot?: (string | number)[];
}

export interface PdfReport {
	fileName: string;
	negocio: string;
	title: string;
	period: string;
	kpis: PdfKpi[];
	chart?: { title: string; canvas: HTMLCanvasElement | null | undefined };
	tables: PdfTable[];
	notes?: string[];
}

const INK: [number, number, number] = [9, 9, 11];
const MUTED: [number, number, number] = [113, 113, 122];
const LINE: [number, number, number] = [228, 228, 231];
const SOFT: [number, number, number] = [244, 244, 245];
const BRAND_RGB: [number, number, number] = [5, 150, 105];

/** Caracteres que la fuente base del PDF (Helvetica / WinAnsi) sí puede pintar fuera de Latin-1. */
const WINANSI_EXTRA = new Set(['–', '—', '‘', '’', '“', '”', '•', '…', '€', '™']);

/**
 * Normaliza texto para Helvetica: el signo menos (U+2212), espacios finos y
 * otros símbolos fuera de WinAnsi se pintaban como comillas y descuadraban la línea.
 */
export function pdfText(s: string): string {
	return s
		.replace(/−/g, '-')
		.replace(/[   ]/g, ' ')
		.replace(/≈/g, '~')
		.replace(/[^ -ÿ\n]/g, (c) => (WINANSI_EXTRA.has(c) ? c : ''));
}

function sanitize(r: PdfReport): PdfReport {
	const t = (v: string | number) => (typeof v === 'string' ? pdfText(v) : v);
	return {
		...r,
		negocio: pdfText(r.negocio),
		title: pdfText(r.title),
		period: pdfText(r.period),
		kpis: r.kpis.map((k) => ({ label: pdfText(k.label), value: pdfText(k.value), hint: k.hint ? pdfText(k.hint) : undefined })),
		tables: r.tables.map((tb) => ({ ...tb, title: pdfText(tb.title), head: tb.head.map(pdfText), body: tb.body.map((row) => row.map(t)), foot: tb.foot?.map(t) })),
		notes: r.notes?.map(pdfText)
	};
}

/** Construye el documento (separado de la descarga para poder probarlo). */
export async function buildPdfReport(input: PdfReport) {
	const r = sanitize(input);
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const W = doc.internal.pageSize.getWidth();
	const M = 14;
	let y = 16;

	// ── Encabezado ──────────────────────────────────────────
	doc.setFillColor(...BRAND_RGB);
	doc.rect(M, y - 4, 3, 13, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(16);
	doc.setTextColor(...INK);
	doc.text(r.negocio, M + 6, y + 1);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...MUTED);
	doc.text(`${r.title} · ${r.period}`, M + 6, y + 7);
	const generado = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
	doc.text(`Generado ${generado}`, W - M, y + 7, { align: 'right' });
	y += 15;
	doc.setDrawColor(...LINE);
	doc.line(M, y, W - M, y);
	y += 6;

	// ── KPIs en rejilla ─────────────────────────────────────
	if (r.kpis.length) {
		const cols = Math.min(4, r.kpis.length);
		const gap = 3;
		const cw = (W - 2 * M - gap * (cols - 1)) / cols;
		const ch = 18;
		r.kpis.forEach((k, i) => {
			const cx = M + (i % cols) * (cw + gap);
			const cy = y + Math.floor(i / cols) * (ch + gap);
			doc.setFillColor(...SOFT);
			doc.roundedRect(cx, cy, cw, ch, 1.5, 1.5, 'F');
			doc.setFontSize(8);
			doc.setTextColor(...MUTED);
			doc.text(k.label, cx + 3, cy + 5);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			doc.setTextColor(...INK);
			doc.text(k.value, cx + 3, cy + 11.5);
			doc.setFont('helvetica', 'normal');
			if (k.hint) {
				doc.setFontSize(7);
				doc.setTextColor(...MUTED);
				doc.text(k.hint, cx + 3, cy + 15.5);
			}
		});
		y += Math.ceil(r.kpis.length / cols) * (ch + gap) + 4;
	}

	// ── Gráfico (captura del canvas en pantalla) ────────────
	if (r.chart?.canvas) {
		try {
			const img = r.chart.canvas.toDataURL('image/png', 1);
			const ratio = r.chart.canvas.height / r.chart.canvas.width || 0.4;
			const iw = W - 2 * M;
			const ih = Math.min(75, iw * ratio);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(10);
			doc.setTextColor(...INK);
			doc.text(r.chart.title, M, y);
			doc.addImage(img, 'PNG', M, y + 3, iw, ih);
			y += ih + 10;
		} catch (e) {
			console.warn('No se pudo incluir el gráfico en el PDF', e);
		}
	}

	// ── Tablas ──────────────────────────────────────────────
	for (const t of r.tables) {
		if (t.body.length === 0) continue;
		if (y > 250) {
			doc.addPage();
			y = 18;
		}
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10);
		doc.setTextColor(...INK);
		doc.text(t.title, M, y);
		const numeric = new Set(t.numeric ?? []);
		autoTable(doc, {
			startY: y + 3,
			margin: { left: M, right: M },
			head: [t.head],
			body: t.body.map((row) => row.map(String)),
			foot: t.foot ? [t.foot.map(String)] : undefined,
			theme: 'plain',
			showHead: 'everyPage',
			showFoot: 'lastPage',
			styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.1 } },
			headStyles: { fillColor: SOFT, textColor: MUTED, fontStyle: 'bold' },
			footStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: INK, lineWidth: { top: 0.3 } },
			columnStyles: Object.fromEntries([...numeric].map((i) => [i, { halign: 'right' as const }])),
			didParseCell: (d) => {
				if (numeric.has(d.column.index) && (d.section === 'head' || d.section === 'foot')) d.cell.styles.halign = 'right';
			}
		});
		y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
	}

	if (r.notes?.length) {
		if (y > 260) {
			doc.addPage();
			y = 18;
		}
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.setTextColor(...MUTED);
		for (const n of r.notes) {
			const lines: string[] = doc.splitTextToSize(`• ${n}`, W - 2 * M);
			doc.text(lines, M, y);
			y += lines.length * 3.8 + 1;
		}
	}

	// ── Pie de página ───────────────────────────────────────
	const pages = doc.getNumberOfPages();
	for (let p = 1; p <= pages; p++) {
		doc.setPage(p);
		doc.setFontSize(7);
		doc.setTextColor(...MUTED);
		const H = doc.internal.pageSize.getHeight();
		doc.text(`${BRAND.name} · ${r.negocio}`, M, H - 8);
		doc.text(`Página ${p} de ${pages}`, W - M, H - 8, { align: 'right' });
	}

	return doc;
}

export async function downloadPdfReport(r: PdfReport): Promise<void> {
	const doc = await buildPdfReport(r);
	doc.save(`${r.fileName}.pdf`);
}

/** Formato de dinero para PDF (sin el espacio duro que Intl inserta y Helvetica no siempre pinta bien). */
export function pdfMoney(n: number): string {
	const sign = n < 0 ? '-' : '';
	return `${sign}$${Math.round(Math.abs(n)).toLocaleString('es-CO')}`;
}
