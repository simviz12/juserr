/** PDF propio del Estado de Resultados (formato de estado financiero). */
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { toCents } from '../src/lib/features/finance/domain/money';
import {
	buildStatement,
	compararStatements,
	type Movimiento,
	type MovimientoGasto,
	type StatementInput
} from '../src/lib/modules/estado-resultados/domain/income-statement';
import {
	buildStatementPdf,
	lecturaDelResultado,
	type StatementPdfInput
} from '../src/lib/modules/estado-resultados/reports/statement-pdf';

let n = 0;
const mov = (p: number, c = 'Movimiento'): Movimiento => ({
	id: `m${++n}`,
	origen: 'ajuste',
	refId: n,
	fecha: '2026-11-05T17:00:00Z',
	concepto: c,
	cents: toCents(p)
});
const gasto = (p: number, categoria: string, c: string): MovimientoGasto => ({
	...mov(p, c),
	origen: 'gasto',
	categoria,
	automatica: true
});
const mes = (factor: number): StatementInput => ({
	ventas: [
		mov(6_000_000 * factor, 'Turnos semana 1-2'),
		mov(4_000_000 * factor, 'Turnos semana 3-4')
	],
	devoluciones: [mov(150_000, 'Pedido devuelto')],
	descuentos: [mov(50_000, 'Descuento cliente frecuente')],
	compras: [mov(3_000_000, 'Compras de Bodega')],
	gastos: [
		gasto(200_000, 'insumos', 'Hielo y carbón'),
		gasto(1_200_000, 'arriendo', 'Pago arriendo local'),
		gasto(1_800_000, 'nomina', 'Nómina quincena meseros'),
		gasto(300_000, 'servicios', 'Recibo de luz y agua'),
		gasto(80_000, 'financieros', 'Comisión datáfono banco'),
		gasto(400_000, 'impuestos', 'Impuesto ICA bimestre')
	],
	otrosIngresos: [mov(30_000, 'Venta de aceite usado')]
});

function entrada(actual: StatementInput, anterior?: StatementInput): StatementPdfInput {
	const st = buildStatement(actual);
	const prev = anterior ? buildStatement(anterior) : null;
	return {
		fileName: 'prueba',
		negocio: 'ChuzoOS GastroFlow Gourmet',
		periodo: '1 nov 2026 – 30 nov 2026',
		statement: st,
		comparativo: prev
			? {
					etiqueta: 'Periodo anterior',
					periodo: '1 oct 2026 – 31 oct 2026',
					totales: prev.totales,
					margenes: prev.margenes,
					variaciones: compararStatements(st, prev)
				}
			: null,
		formatoDia: (k) => k
	};
}

const texto = (doc: Awaited<ReturnType<typeof buildStatementPdf>>) => doc.output();

describe('PDF del estado de resultados', () => {
	it('tiene portada, cascada, estado contable, lectura, anexo y firmas', async () => {
		const doc = await buildStatementPdf(entrada(mes(1), mes(0.9)));
		const out = texto(doc);
		for (const s of [
			'ESTADO DE RESULTADOS',
			'UTILIDAD NETA DEL PERIODO',
			'CASCADA DEL RESULTADO',
			'MARGENES SOBRE INGRESOS NETOS',
			'LECTURA DEL RESULTADO',
			'ANEXO',
			'BASES DE PREPARACI',
			'REVIS'
		])
			expect(
				out.toUpperCase().replace(/[ÁÉÍÓÚ]/g, (c) => 'AEIOU'['ÁÉÍÓÚ'.indexOf(c)]),
				s
			).toContain(s);
		// deducciones entre paréntesis (convención contable)
		// en el contenido del PDF los paréntesis van escapados: \( … \)
		expect(out).toContain('\\($3.200.000\\)');
		expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
		if (process.env.PDF_MUESTRA)
			writeFileSync(
				`${process.env.PDF_MUESTRA}/er-utilidad.pdf`,
				Buffer.from(doc.output('arraybuffer'))
			);
	});

	it('una pérdida se titula como pérdida y va entre paréntesis', async () => {
		const perdida = { ...mes(0.3), compras: [mov(5_000_000)] };
		const doc = await buildStatementPdf(entrada(perdida));
		const out = texto(doc);
		expect(out).toContain('RDIDA NETA DEL PERIODO');
		if (process.env.PDF_MUESTRA)
			writeFileSync(
				`${process.env.PDF_MUESTRA}/er-perdida.pdf`,
				Buffer.from(doc.output('arraybuffer'))
			);
	});

	it('la lectura del resultado sale de las cifras', () => {
		const l = lecturaDelResultado(entrada(mes(1), mes(0.9)));
		expect(l[0]).toContain('quedaron $29');
		expect(l.some((x) => x.includes('Nómina y personal'))).toBe(true);
		expect(l.some((x) => x.includes('32,7%'))).toBe(true); // costo de ventas 3.200.000 / 9.800.000
		expect(l.some((x) => x.includes('mejoró'))).toBe(true);
	});

	it('un periodo vacío no falla', async () => {
		const vacio = {
			ventas: [],
			devoluciones: [],
			descuentos: [],
			compras: [],
			gastos: [],
			otrosIngresos: []
		};
		const doc = await buildStatementPdf(entrada(vacio));
		expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2);
		expect(lecturaDelResultado(entrada(vacio))[0]).toContain('ceros');
	});
});
