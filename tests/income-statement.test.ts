import { describe, it, expect } from 'vitest';
import {
	centsToDecimalString,
	fromCents,
	parseMoneyInput,
	ratio,
	toCents
} from '../src/lib/features/finance/domain/money';
import {
	buildStatement,
	clasificarGasto,
	compararStatements,
	movimientosDeLinea,
	resolverCategoria,
	variacion,
	type Movimiento,
	type MovimientoGasto,
	type StatementInput
} from '../src/lib/modules/estado-resultados/domain/income-statement';
import {
	comparisonRange,
	diasDelRango,
	presetActivo,
	presetRange,
	resolveRange
} from '../src/lib/modules/estado-resultados/domain/statement-period';
import { toCsv } from '../src/lib/utils/export';
import { canAccess } from '../src/lib/auth/access';

let seq = 0;
const mov = (
	pesos: number | string,
	concepto = 'x',
	fecha: string | null = '2026-11-05T17:00:00.000Z'
): Movimiento => ({
	id: `m-${++seq}`,
	origen: 'ajuste',
	refId: seq,
	fecha,
	concepto,
	cents: toCents(pesos)
});
const gasto = (pesos: number | string, categoria: string, concepto = 'x'): MovimientoGasto => ({
	...mov(pesos, concepto),
	origen: 'gasto',
	categoria,
	automatica: false
});
const input = (p: Partial<StatementInput>): StatementInput => ({
	ventas: [],
	devoluciones: [],
	descuentos: [],
	compras: [],
	gastos: [],
	otrosIngresos: [],
	...p
});
const linea = (s: ReturnType<typeof buildStatement>, id: string) =>
	s.lineas.find((l) => l.id === id)!;

describe('dinero en centavos', () => {
	it('convierte NUMERIC de Postgres sin pasar por coma flotante', () => {
		expect(toCents('1234.56')).toBe(123456);
		expect(toCents('0.10')).toBe(10);
		expect(toCents('19.99')).toBe(1999);
		expect(toCents('-45.5')).toBe(-4550);
		expect(toCents('1000')).toBe(100000);
		expect(toCents('0.995')).toBe(100);
		expect(toCents('0.994')).toBe(99);
	});

	it('trata vacíos e inválidos como cero', () => {
		expect(toCents(null)).toBe(0);
		expect(toCents('')).toBe(0);
		expect(toCents('abc')).toBe(0);
		expect(toCents(NaN)).toBe(0);
	});

	it('suma sin el error clásico de 0.1 + 0.2', () => {
		expect(0.1 + 0.2).not.toBe(0.3);
		expect(fromCents(toCents('0.10') + toCents('0.20'))).toBe(0.3);
		// 1000 movimientos de $0,10: en flotante acumula error; en centavos es exacto.
		const total = Array.from({ length: 1000 }, () => toCents('0.10')).reduce((a, b) => a + b, 0);
		expect(total).toBe(10000);
	});

	it('serializa de vuelta a NUMERIC', () => {
		expect(centsToDecimalString(123456)).toBe('1234.56');
		expect(centsToDecimalString(5)).toBe('0.05');
		expect(centsToDecimalString(-150)).toBe('-1.50');
	});

	it('lee importes digitados con formato colombiano', () => {
		expect(parseMoneyInput('1.250.000')).toBe(125000000);
		expect(parseMoneyInput('$ 35.000')).toBe(3500000);
		expect(parseMoneyInput('35000,50')).toBe(3500050);
		expect(parseMoneyInput('1.250.000,75')).toBe(125000075);
		expect(parseMoneyInput('1250.5')).toBe(125050);
		expect(parseMoneyInput('12000')).toBe(1200000);
	});

	it('rechaza importes que no son números', () => {
		for (const raw of ['', 'abc', '-500', '1e9', '12,345,678', '10.5.5,1,2']) {
			expect(parseMoneyInput(raw), raw).toBeNull();
		}
	});

	it('no divide por cero', () => {
		expect(ratio(10, 0)).toBeNull();
		expect(ratio(25, 100)).toBe(0.25);
	});
});

describe('clasificación de gastos', () => {
	it('sugiere la categoría por el concepto', () => {
		expect(clasificarGasto('Pago arriendo local')).toBe('arriendo');
		expect(clasificarGasto('Recibo de la LUZ')).toBe('servicios');
		expect(clasificarGasto('Nómina quincena')).toBe('nomina');
		expect(clasificarGasto('Domicilios Rappi')).toBe('ventas');
		expect(clasificarGasto('Comisión bancaria datáfono')).toBe('financieros');
		expect(clasificarGasto('Pago IVA bimestral')).toBe('impuestos');
		expect(clasificarGasto('2 bolsas de hielo')).toBe('insumos');
	});

	it('compara por palabra completa: "gas" no es "gaseosa"', () => {
		expect(clasificarGasto('Pipeta de gas')).toBe('servicios');
		expect(clasificarGasto('Gaseosas para la nevera')).toBe('insumos');
	});

	it('cae en "otros" si no reconoce el concepto', () => {
		expect(clasificarGasto('Varios')).toBe('otros');
		expect(clasificarGasto('')).toBe('otros');
	});

	it('la categoría asignada a mano manda sobre la sugerida', () => {
		expect(resolverCategoria('nomina', 'Pago arriendo')).toBe('nomina');
		expect(resolverCategoria(null, 'Pago arriendo')).toBe('arriendo');
		expect(resolverCategoria('categoria-borrada', 'Pago arriendo')).toBe('arriendo');
	});
});

describe('estado de resultados', () => {
	const completo = input({
		ventas: [mov(6_000_000), mov(4_000_000)],
		devoluciones: [mov(150_000)],
		descuentos: [mov(50_000)],
		compras: [mov(3_000_000)],
		gastos: [
			gasto(200_000, 'insumos'),
			gasto(1_200_000, 'arriendo'),
			gasto(1_800_000, 'nomina'),
			gasto(300_000, 'servicios'),
			gasto(80_000, 'financieros'),
			gasto(400_000, 'impuestos')
		],
		otrosIngresos: [mov(30_000)]
	});

	it('calcula la cascada completa', () => {
		const s = buildStatement(completo);
		const pesos = Object.fromEntries(Object.entries(s.totales).map(([k, v]) => [k, fromCents(v)]));
		expect(pesos).toEqual({
			ingresosOperacionales: 10_000_000,
			devolucionesDescuentos: 200_000,
			ingresosNetos: 9_800_000,
			costoVentas: 3_200_000,
			utilidadBruta: 6_600_000,
			gastosOperacionales: 3_300_000,
			utilidadOperacional: 3_300_000,
			otrosIngresos: 30_000,
			otrosEgresos: 80_000,
			utilidadAntesImpuestos: 3_250_000,
			impuestos: 400_000,
			utilidadNeta: 2_850_000,
			ingresosTotales: 9_830_000,
			costosGastosTotales: 6_980_000
		});
		// Las tarjetas cuadran con la última línea
		expect(s.totales.ingresosTotales - s.totales.costosGastosTotales).toBe(s.totales.utilidadNeta);
		expect(s.movimientos).toBe(12);
	});

	it('calcula los márgenes sobre ingresos netos', () => {
		const s = buildStatement(completo);
		expect(s.margenes.bruto).toBeCloseTo(6_600_000 / 9_800_000, 10);
		expect(s.margenes.operacional).toBeCloseTo(3_300_000 / 9_800_000, 10);
		expect(s.margenes.neto).toBeCloseTo(2_850_000 / 9_800_000, 10);
		expect(linea(s, 'utilidad_bruta').margen).toBe(s.margenes.bruto);
		expect(linea(s, 'utilidad_neta').margen).toBe(s.margenes.neto);
	});

	it('respeta el orden contable de las líneas', () => {
		const s = buildStatement(completo);
		expect(s.lineas.filter((l) => l.nivel === 0).map((l) => l.id)).toEqual([
			'ingresos_operacionales',
			'devoluciones_descuentos',
			'ingresos_netos',
			'costo_ventas',
			'utilidad_bruta',
			'gastos_operacionales',
			'utilidad_operacional',
			'otros_ingresos',
			'otros_egresos',
			'utilidad_antes_impuestos',
			'impuestos',
			'utilidad_neta'
		]);
	});

	it('agrupa los gastos operacionales por categoría, de mayor a menor', () => {
		const s = buildStatement(completo);
		const grupo = linea(s, 'gastos_operacionales');
		expect(grupo.hijos).toEqual([
			'gastos_operacionales.nomina',
			'gastos_operacionales.arriendo',
			'gastos_operacionales.servicios'
		]);
		// Cada grupo es exactamente la suma de sus categorías
		for (const g of s.lineas.filter((l) => l.hijos.length > 0)) {
			const suma = g.hijos.reduce((a, id) => a + linea(s, id).cents, 0);
			expect(suma).toBe(g.cents);
		}
	});

	it('el desglose de cada línea suma exactamente su importe', () => {
		const s = buildStatement(completo);
		for (const l of s.lineas.filter((x) => x.tipo === 'ingreso' || x.tipo === 'deduccion')) {
			const suma = movimientosDeLinea(s, l.id).reduce((a, m) => a + m.cents, 0);
			expect(suma, l.id).toBe(l.cents);
		}
		expect(movimientosDeLinea(s, 'costo_ventas')).toHaveLength(2);
		expect(movimientosDeLinea(s, 'no-existe')).toEqual([]);
	});

	it('envía los insumos pagados por caja al costo de ventas, no a gastos', () => {
		const s = buildStatement(input({ ventas: [mov(100_000)], gastos: [gasto(20_000, 'insumos')] }));
		expect(fromCents(s.totales.costoVentas)).toBe(20_000);
		expect(s.totales.gastosOperacionales).toBe(0);
	});

	it('reporta la pérdida con signo negativo y la nombra como pérdida', () => {
		const s = buildStatement(
			input({ ventas: [mov(100_000)], gastos: [gasto(150_000, 'arriendo')] })
		);
		expect(fromCents(s.totales.utilidadNeta)).toBe(-50_000);
		expect(s.margenes.neto).toBeCloseTo(-0.5);
		expect(linea(s, 'utilidad_neta').label).toBe('Pérdida neta del periodo');
		expect(linea(buildStatement(completo), 'utilidad_neta').label).toBe(
			'Utilidad neta del periodo'
		);
	});

	it('un periodo sin movimientos da ceros y márgenes nulos (no NaN)', () => {
		const s = buildStatement(input({}));
		expect(Object.values(s.totales).every((v) => v === 0)).toBe(true);
		expect(s.margenes).toEqual({ bruto: null, operacional: null, neto: null });
		expect(s.movimientos).toBe(0);
	});

	it('no acumula error de redondeo con importes con centavos', () => {
		const s = buildStatement(
			input({
				ventas: Array.from({ length: 300 }, () => mov('33333.33')),
				compras: Array.from({ length: 300 }, () => mov('11111.11')),
				gastos: Array.from({ length: 300 }, () => gasto('0.10', 'otros'))
			})
		);
		expect(s.totales.ingresosOperacionales).toBe(999999900); // 300 × 33.333,33
		expect(s.totales.costoVentas).toBe(333333300);
		expect(s.totales.gastosOperacionales).toBe(3000);
		expect(s.totales.utilidadNeta).toBe(999999900 - 333333300 - 3000);
	});

	it('una categoría desconocida se trata como "otros" y no se pierde', () => {
		const s = buildStatement(
			input({ ventas: [mov(10_000)], gastos: [gasto(1_000, 'inexistente')] })
		);
		expect(fromCents(s.totales.gastosOperacionales)).toBe(1_000);
		expect(fromCents(s.totales.utilidadNeta)).toBe(9_000);
	});

	it('ordena el desglose del más reciente al más antiguo', () => {
		const s = buildStatement(
			input({
				ventas: [
					mov(1, 'viejo', '2026-11-01T17:00:00.000Z'),
					mov(2, 'nuevo', '2026-11-09T17:00:00.000Z'),
					mov(3, 'sin fecha', null)
				]
			})
		);
		expect(linea(s, 'ingresos_operacionales').movimientos.map((m) => m.concepto)).toEqual([
			'nuevo',
			'viejo',
			'sin fecha'
		]);
	});
});

describe('comparativo entre periodos', () => {
	it('calcula diferencia en dinero y en porcentaje', () => {
		expect(variacion(120, 100)).toEqual({ anterior: 100, diferencia: 20, pct: 0.2 });
		expect(variacion(80, 100).pct).toBeCloseTo(-0.2);
		expect(variacion(50, 0)).toEqual({ anterior: 0, diferencia: 50, pct: null });
	});

	it('usa el valor absoluto de la base cuando el periodo anterior fue pérdida', () => {
		// De −100 a +50 es una mejora de 150 %, no un "−150 %".
		expect(variacion(50, -100).pct).toBeCloseTo(1.5);
	});

	it('compara línea por línea; una categoría nueva se compara contra cero', () => {
		const actual = buildStatement(
			input({
				ventas: [mov(1_000_000)],
				gastos: [gasto(100_000, 'arriendo'), gasto(50_000, 'transporte')]
			})
		);
		const anterior = buildStatement(
			input({ ventas: [mov(800_000)], gastos: [gasto(100_000, 'arriendo')] })
		);
		const v = compararStatements(actual, anterior);
		expect(v.ingresos_operacionales).toEqual({
			anterior: 80_000_000,
			diferencia: 20_000_000,
			pct: 0.25
		});
		expect(v['gastos_operacionales.arriendo'].diferencia).toBe(0);
		expect(v['gastos_operacionales.transporte']).toEqual({
			anterior: 0,
			diferencia: 5_000_000,
			pct: null
		});
		expect(fromCents(v.utilidad_neta.diferencia)).toBe(150_000);
		expect(Object.keys(v)).toEqual(actual.lineas.map((l) => l.id));
	});
});

describe('periodos del informe', () => {
	const hoy = '2026-11-13'; // viernes

	it('resuelve los accesos rápidos', () => {
		expect(presetRange('hoy', hoy)).toEqual({ inicio: '2026-11-13', fin: '2026-11-13' });
		expect(presetRange('semana', hoy)).toEqual({ inicio: '2026-11-09', fin: '2026-11-13' });
		expect(presetRange('mes', hoy)).toEqual({ inicio: '2026-11-01', fin: '2026-11-13' });
		expect(presetRange('mes_anterior', hoy)).toEqual({ inicio: '2026-10-01', fin: '2026-10-31' });
		expect(presetRange('trimestre', hoy)).toEqual({ inicio: '2026-10-01', fin: '2026-11-13' });
		expect(presetRange('anio', hoy)).toEqual({ inicio: '2026-01-01', fin: '2026-11-13' });
	});

	it('maneja bordes de calendario', () => {
		// Domingo: la semana empezó el lunes anterior
		expect(presetRange('semana', '2026-11-15').inicio).toBe('2026-11-09');
		// Enero: el mes anterior es diciembre del año pasado
		expect(presetRange('mes_anterior', '2026-01-10')).toEqual({
			inicio: '2025-12-01',
			fin: '2025-12-31'
		});
		// Febrero bisiesto
		expect(presetRange('mes_anterior', '2024-03-05')).toEqual({
			inicio: '2024-02-01',
			fin: '2024-02-29'
		});
		expect(presetRange('trimestre', '2026-03-31').inicio).toBe('2026-01-01');
	});

	it('reconoce qué acceso rápido está activo', () => {
		expect(presetActivo({ inicio: '2026-11-01', fin: '2026-11-13' }, hoy)).toBe('mes');
		expect(presetActivo({ inicio: '2026-11-02', fin: '2026-11-13' }, hoy)).toBeNull();
	});

	it('compara contra el periodo anterior', () => {
		// Mes en curso → mismo tramo del mes previo
		expect(comparisonRange({ inicio: '2026-11-01', fin: '2026-11-13' }, 'anterior')).toEqual({
			inicio: '2026-10-01',
			fin: '2026-10-13'
		});
		// Mes completo → mes previo completo (aunque tenga distinta cantidad de días)
		expect(comparisonRange({ inicio: '2026-10-01', fin: '2026-10-31' }, 'anterior')).toEqual({
			inicio: '2026-09-01',
			fin: '2026-09-30'
		});
		expect(comparisonRange({ inicio: '2026-03-01', fin: '2026-03-31' }, 'anterior')).toEqual({
			inicio: '2026-02-01',
			fin: '2026-02-28'
		});
		// 1–30 de marzo no cabe en febrero: se recorta al último día
		expect(comparisonRange({ inicio: '2026-03-01', fin: '2026-03-30' }, 'anterior')).toEqual({
			inicio: '2026-02-01',
			fin: '2026-02-28'
		});
		// Rango libre → los N días inmediatamente anteriores
		expect(comparisonRange({ inicio: '2026-11-09', fin: '2026-11-13' }, 'anterior')).toEqual({
			inicio: '2026-11-04',
			fin: '2026-11-08'
		});
		expect(comparisonRange({ inicio: '2026-11-13', fin: '2026-11-13' }, 'anterior')).toEqual({
			inicio: '2026-11-12',
			fin: '2026-11-12'
		});
		// Enero → diciembre del año anterior
		expect(comparisonRange({ inicio: '2026-01-01', fin: '2026-01-31' }, 'anterior')).toEqual({
			inicio: '2025-12-01',
			fin: '2025-12-31'
		});
	});

	it('compara contra el mismo periodo del año pasado', () => {
		expect(comparisonRange({ inicio: '2026-11-01', fin: '2026-11-13' }, 'anio')).toEqual({
			inicio: '2025-11-01',
			fin: '2025-11-13'
		});
		// 29 de febrero no existe el año anterior
		expect(comparisonRange({ inicio: '2024-02-01', fin: '2024-02-29' }, 'anio')).toEqual({
			inicio: '2023-02-01',
			fin: '2023-02-28'
		});
		expect(comparisonRange({ inicio: '2026-11-01', fin: '2026-11-13' }, 'ninguna')).toBeNull();
	});

	it('normaliza el rango recibido por URL', () => {
		expect(resolveRange(null, null, hoy)).toEqual({ inicio: '2026-11-01', fin: '2026-11-13' });
		expect(resolveRange('2026-11-10', '2026-11-02', hoy)).toEqual({
			inicio: '2026-11-02',
			fin: '2026-11-10'
		});
		expect(resolveRange('1; DROP TABLE turnos;--', 'ayer', hoy)).toEqual({
			inicio: '2026-11-01',
			fin: '2026-11-13'
		});
		expect(resolveRange('2026-11-05', null, hoy)).toEqual({
			inicio: '2026-11-05',
			fin: '2026-11-05'
		});
		// Un rango enorme se acota para no lanzar consultas sin límite
		const r = resolveRange('1990-01-01', '2026-11-13', hoy);
		expect(diasDelRango(r)).toBe(1100);
		expect(r.fin).toBe('2026-11-13');
	});
});

describe('exportación CSV', () => {
	it('usa ; y coma decimal (Excel en español)', () => {
		expect(toCsv([{ Concepto: 'Ventas', Monto: 1234.5 }])).toBe('Concepto;Monto\r\nVentas;1234,5');
	});

	it('escapa separadores, comillas y saltos de línea', () => {
		expect(toCsv([{ a: 'x;y', b: 'dijo "hola"', c: 'l1\nl2' }])).toBe(
			'a;b;c\r\n"x;y";"dijo ""hola""";"l1\nl2"'
		);
	});

	it('neutraliza celdas que Excel ejecutaría como fórmula', () => {
		expect(toCsv([{ Concepto: '=HYPERLINK("http://x")' }])).toContain(
			`"'=HYPERLINK(""http://x"")"`
		);
		expect(toCsv([{ Concepto: '+57 300', Monto: -500 }])).toBe("Concepto;Monto\r\n'+57 300;-500");
	});

	it('deja vacíos los nulos', () => {
		expect(toCsv([{ a: null, b: 0 }])).toBe('a;b\r\n;0');
		expect(toCsv([])).toBe('');
	});
});

describe('acceso al estado de resultados', () => {
	it('solo el administrador puede verlo', () => {
		const ruta = '/finanzas/estado-resultados';
		expect(canAccess('jefe', ruta)).toBe(true);
		for (const rol of ['cajero', 'bodeguero', 'empleado', 'desconocido', null]) {
			expect(canAccess(rol, ruta), String(rol)).toBe(false);
		}
	});
});
