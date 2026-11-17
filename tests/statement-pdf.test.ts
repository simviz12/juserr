/** PDF propio del Estado de Resultados y su análisis (cobertura, medios, turnos, insumos). */
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
	cantidadConUnidad,
	cobertura,
	comprasPorInsumo,
	gastosFijosFaltantes,
	mediosDePago,
	pluralUnidad,
	tramos,
	turnoDe,
	ventasPorDia,
	ventasPorTurno
} from '../src/lib/modules/estado-resultados/domain/analisis';
import {
	buildStatementPdf,
	fechaMovimiento,
	lecturaDelResultado,
	type StatementPdfInput
} from '../src/lib/modules/estado-resultados/reports/statement-pdf';

let n = 0;
const mov = (p: number, c = 'Movimiento', fecha = '2026-11-05T17:00:00Z'): Movimiento => ({
	id: `m${++n}`,
	origen: 'ajuste',
	refId: n,
	fecha,
	concepto: c,
	cents: toCents(p)
});
/** Turno que cierra a una hora de Colombia (UTC-5) en un día de noviembre. */
const turno = (dia: number, horaCol: number, efectivo: number, transf: number): Movimiento => {
	const f = new Date(Date.UTC(2026, 10, dia, horaCol + 5, 0)).toISOString();
	return {
		...mov(efectivo + transf, `Cierre de turno #${n + 1}`, f),
		origen: 'turno',
		efectivoCents: toCents(efectivo),
		transferenciasCents: toCents(transf)
	};
};
const compra = (dia: number, insumo: string, cantidad: number, unidad: string, total: number) => ({
	...mov(total, insumo, new Date(Date.UTC(2026, 10, dia, 15)).toISOString()),
	origen: 'compra' as const,
	cantidad,
	unidad
});
const gasto = (p: number, categoria: string, c: string): MovimientoGasto => ({
	...mov(p, c),
	origen: 'gasto',
	categoria,
	automatica: true
});

/** Mes con todo registrado (incluidos nómina y arriendo) y datos todos los días 1–10. */
const completo = (factor: number): StatementInput => ({
	ventas: Array.from({ length: 10 }, (_, i) => [
		turno(i + 1, 16, 300_000 * factor, 200_000 * factor),
		turno(i + 1, 22, 500_000 * factor, 300_000 * factor)
	]).flat(),
	devoluciones: [mov(150_000, 'Pedido devuelto')],
	descuentos: [],
	compras: [
		compra(2, 'Queso mozzarella', 4, 'kilo', 150_332),
		compra(9, 'Queso mozzarella', 4, 'kilo', 152_768),
		compra(3, 'Harina', 2, 'paquete', 40_000)
	],
	gastos: [
		gasto(15_000, 'insumos', 'Hielo'),
		gasto(1_200_000, 'arriendo', 'Arriendo local'),
		gasto(1_800_000, 'nomina', 'Nómina quincena'),
		gasto(300_000, 'servicios', 'Luz y agua')
	],
	otrosIngresos: [mov(30_000, 'Venta de aceite usado')]
});

function entrada(
	actual: StatementInput,
	rango = { inicio: '2026-11-01', fin: '2026-11-10' },
	anterior?: StatementInput,
	diasCmp = 10
): StatementPdfInput {
	const st = buildStatement(actual);
	const prev = anterior ? buildStatement(anterior) : null;
	return {
		fileName: 'prueba',
		negocio: 'ChuzoOS GastroFlow Gourmet',
		periodo: `${rango.inicio} – ${rango.fin}`,
		rango,
		hoy: '2026-11-30',
		statement: st,
		comparativo: prev
			? {
					etiqueta: 'Periodo anterior',
					periodo: 'oct 2026',
					totales: prev.totales,
					margenes: prev.margenes,
					variaciones: compararStatements(st, prev),
					diasConDatos: diasCmp,
					diasRango: 10
				}
			: null
	};
}
const texto = (doc: Awaited<ReturnType<typeof buildStatementPdf>>) => doc.output();
const guardar = (nombre: string, doc: Awaited<ReturnType<typeof buildStatementPdf>>) => {
	if (process.env.PDF_MUESTRA)
		writeFileSync(
			`${process.env.PDF_MUESTRA}/${nombre}.pdf`,
			Buffer.from(doc.output('arraybuffer'))
		);
};

describe('análisis del periodo', () => {
	it('plurales de unidades', () => {
		expect(pluralUnidad('paquete', 4)).toBe('paquetes');
		expect(pluralUnidad('kilo', 16)).toBe('kilos');
		expect(pluralUnidad('litro', 1)).toBe('litro');
		expect(pluralUnidad('unidad', 2)).toBe('unidades');
		expect(pluralUnidad('fracción', 3)).toBe('fracciones');
		expect(cantidadConUnidad(6.5, 'kilo')).toBe('6,5 kilos');
	});

	it('cuenta días con datos y describe los huecos (periodo del 1 al 17 con datos hasta el 9)', () => {
		const ventas = Array.from({ length: 9 }, (_, i) => turno(i + 1, 22, 100, 0));
		const c = cobertura(ventas, { inicio: '2026-11-01', fin: '2026-11-17' });
		expect(c.diasConDatos).toBe(9);
		expect(c.diasSinDatos).toHaveLength(8);
		expect(c.ultimoDiaConDatos).toBe('2026-11-09');
		expect(tramos(c.diasSinDatos)).toEqual([{ desde: '2026-11-10', hasta: '2026-11-17' }]);
		// Los días futuros del rango no cuentan como "sin datos"
		const hoy = cobertura(ventas, { inicio: '2026-11-01', fin: '2026-11-30' }, '2026-11-09');
		expect(hoy.diasSinDatos).toHaveLength(0);
	});

	it('un turno que cierra a las 11:30 p. m. pertenece a ese día (hora de Colombia)', () => {
		const v = [turno(5, 23, 100, 0)];
		const dias = ventasPorDia(v, { inicio: '2026-11-04', fin: '2026-11-06' });
		expect(dias.find((d) => d.dia === '2026-11-05')?.cierres).toBe(1);
		expect(turnoDe(v[0].fecha!)).toBe('noche');
		expect(turnoDe(turno(5, 16, 1, 0).fecha!)).toBe('dia');
	});

	it('medios de pago y ventas por turno', () => {
		const v = [turno(1, 16, 300, 200), turno(1, 22, 500, 300)];
		expect(mediosDePago(v)).toEqual({
			efectivo: toCents(800),
			transferencias: toCents(500),
			total: toCents(1300)
		});
		const t = ventasPorTurno(v);
		expect(t.map((x) => [x.turno, x.cierres, x.cents])).toEqual([
			['dia', 1, toCents(500)],
			['noche', 1, toCents(800)]
		]);
	});

	it('agrupa compras por insumo con variación de precio', () => {
		const [queso, harina] = comprasPorInsumo(completo(1).compras);
		expect(queso.insumo).toBe('Queso mozzarella');
		expect(queso.compras).toBe(2);
		expect(queso.cantidad).toBe(8);
		expect(queso.precioInicial).toBe(toCents(37_583));
		expect(queso.precioFinal).toBe(toCents(38_192));
		expect(queso.variacionPrecio).toBeCloseTo(0.0162, 3);
		expect(harina.variacionPrecio).toBeNull(); // una sola compra
		// Precio mínimo y máximo pagado (no solo primera y última compra)
		const masa = comprasPorInsumo([
			compra(1, 'Masa', 10, 'unidad', 18_000),
			compra(3, 'Masa', 10, 'unidad', 17_000),
			compra(5, 'Masa', 10, 'unidad', 19_000),
			compra(9, 'Masa', 10, 'unidad', 18_000)
		])[0];
		expect([masa.precioMin, masa.precioMax]).toEqual([toCents(1_700), toCents(1_900)]);
		expect(masa.variacionPrecio).toBe(0); // primera vs. última: igual
	});

	it('detecta gastos fijos sin registrar', () => {
		expect(gastosFijosFaltantes(buildStatement(completo(1)))).toEqual([]);
		const sin = { ...completo(1), gastos: [gasto(15_000, 'insumos', 'Hielo')] };
		expect(gastosFijosFaltantes(buildStatement(sin))).toEqual(['nomina', 'arriendo']);
	});
});

describe('PDF del estado de resultados', () => {
	it('periodo completo con gastos fijos: utilidad neta, todas las secciones y paréntesis', async () => {
		const doc = await buildStatementPdf(entrada(completo(1), undefined, completo(0.9)));
		const out = texto(doc);
		for (const s of [
			'ESTADO DE RESULTADOS',
			'UTILIDAD NETA DEL PERIODO',
			'Días con datos: 10 de 10',
			'CASCADA DEL RESULTADO',
			'INGRESOS',
			'Por medio de pago',
			'Por turno',
			'Ventas por día',
			'LECTURA DEL RESULTADO',
			'A. Compras de insumos por producto',
			'8 kilos',
			'Revisó y aprobó'
		])
			expect(out, s).toContain(s);
		expect(out).toContain('\\($'); // deducciones entre paréntesis (escapados en el PDF)
		expect(out).not.toContain('Periodo incompleto');
		expect(out).not.toContain('RESULTADO DE CAJA');
		expect(out).not.toMatch(/No operacional[\s\S]{0,200}\+\$0/); // sin barras en cero
		guardar('er-completo', doc);
	});

	it('periodo con huecos y sin gastos fijos: avisa, cambia el nombre y compara por promedio diario', async () => {
		const rango = { inicio: '2026-11-01', fin: '2026-11-17' };
		const parcial: StatementInput = {
			...completo(1),
			ventas: completo(1).ventas.filter((v) => v.fecha! < '2026-11-10'),
			gastos: [gasto(15_000, 'insumos', 'Hielo'), gasto(121_600, 'ventas', 'Domicilios')]
		};
		const input = entrada(parcial, rango, completo(1), 10);
		input.comparativo!.diasRango = 10;
		const doc = await buildStatementPdf(input);
		const out = texto(doc);
		expect(out).toContain('Días con datos: 9 de 17');
		expect(out).toContain('Periodo incompleto');
		expect(out).toContain('del 10 nov al 17 nov');
		expect(out).toContain('RESULTADO DE CAJA DEL PERIODO');
		expect(out).toContain('Sin gastos fijos');
		expect(out).toContain('Venta por día');
		guardar('er-incompleto', doc);

		const l = lecturaDelResultado(input);
		expect(l[0]).toMatch(/^Faltan datos/); // las alertas van primero
		expect(l[1]).toMatch(/nómina ni arriendo/);
		expect(l.some((x) => x.includes('Por día con datos se vendió'))).toBe(true);
		expect(l.some((x) => x.includes('costo de compras, no de consumo'))).toBe(true);
	});

	it('la lectura no resalta cambios insignificantes', () => {
		const a = completo(1);
		const b = {
			...completo(1),
			gastos: completo(1).gastos.map((g) => ({ ...g, cents: g.cents + 340_000 / 100 }))
		};
		const l = lecturaDelResultado(entrada(a, undefined, b));
		expect(l.some((x) => x.includes('subió') || x.includes('bajó $3.400'))).toBe(false);
	});

	it('el gráfico diario marca el día más alto, el de un solo cierre y el tramo sin cierres', async () => {
		const rango = { inicio: '2026-11-01', fin: '2026-11-17' };
		const ventas = [
			...Array.from({ length: 8 }, (_, i) => [
				turno(i + 1, 16, 600_000, 300_000),
				turno(i + 1, 22, 700_000 + i * 50_000, 400_000)
			]).flat(),
			turno(9, 11, 500_000, 200_000)
		];
		const doc = await buildStatementPdf(entrada({ ...completo(1), ventas }, rango));
		const out = texto(doc);
		for (const s of ['más alto', '1 solo cierre', 'sin cierres de turno', 'M', 'Nº', 'Precio mín.'])
			expect(out, s).toContain(s);
		expect(doc.getNumberOfPages()).toBeLessThanOrEqual(5);
	});

	it('un nombre de negocio largo no se corta', async () => {
		const input = entrada(completo(1));
		input.negocio = 'Restaurante Asadero y Pizzería La Gran Parrilla Familiar del Norte de Bogotá';
		const out = texto(await buildStatementPdf(input));
		expect(out).toContain('Bogot');
		expect(out).toContain('Familiar');
	});

	it('fechas cortas en hora de Colombia', () => {
		expect(fechaMovimiento({ origen: 'turno', fecha: '2026-11-06T04:30:00.000Z' })).toBe(
			'05/11 23:30'
		);
		expect(fechaMovimiento({ origen: 'ajuste', fecha: '2026-11-05T17:00:00.000Z' })).toBe('05/11');
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
		expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
		expect(lecturaDelResultado(entrada(vacio))[0]).toContain('ceros');
	});
});
