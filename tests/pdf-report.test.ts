import { describe, it, expect } from 'vitest';
import { buildPdfReport, pdfMoney, pdfText } from '../src/lib/features/finance/reports/pdf';

describe('reporte PDF', () => {
	it('genera un documento con KPIs, tablas largas paginadas y pie de página', async () => {
		const dias = Array.from({ length: 60 }, (_, i) => [`${i + 1} nov`, pdfMoney(350000 + i * 1000), pdfMoney(-2000)]);
		const doc = await buildPdfReport({
			fileName: 'test',
			negocio: 'Pizzería Prueba',
			title: 'Reporte mensual',
			period: 'Noviembre de 2026',
			kpis: [
				{ label: 'Ventas brutas', value: pdfMoney(12_500_000), hint: '+8,0% vs mes anterior' },
				{ label: 'Utilidad neta', value: pdfMoney(9_100_000) },
				{ label: 'Food cost', value: '31,2%' }
			],
			tables: [
				{ title: 'Ventas por día', head: ['Día', 'Ventas', 'Gastos'], numeric: [1, 2], body: dias, foot: ['Total', pdfMoney(1), pdfMoney(2)] },
				{ title: 'Vacía', head: ['A'], body: [] }
			],
			notes: ['Nota de prueba']
		});
		const pages = doc.getNumberOfPages();
		expect(pages).toBeGreaterThan(1); // 60 filas no caben en una página
		const out = doc.output('arraybuffer');
		expect(out.byteLength).toBeGreaterThan(3000);
	});

	it('normaliza símbolos que Helvetica no puede pintar', () => {
		expect(pdfText('Ventas − gastos ÷ compras')).toBe('Ventas - gastos ÷ compras');
		expect(pdfText('1 de oct – 31 de oct')).toBe('1 de oct – 31 de oct');
		expect(pdfText('≈ 5')).toBe('~ 5');
	});

	it('formatea dinero sin decimales y con signo', () => {
		expect(pdfMoney(1234567.6)).toBe('$1.234.568');
		expect(pdfMoney(-5000)).toBe('-$5.000');
	});
});
