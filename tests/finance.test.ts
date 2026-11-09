import { describe, it, expect } from 'vitest';
import { summarize, delta, foodCostStatus, buildCashflow } from '../src/lib/features/finance/domain/metrics';
import {
	businessDayKey,
	currentRange,
	previousRange,
	buildBuckets,
	seriesWindow
} from '../src/lib/features/finance/domain/period';
import { canAccess, homeFor, normalizeRol } from '../src/lib/auth/access';

const shift = (fecha: string, efectivo: number, transferencias = 0, porciones = 0, mermas = 0) => ({
	id: Math.random(),
	fecha,
	descripcion: null,
	efectivo,
	transferencias,
	porciones,
	mermas
});

describe('summarize', () => {
	it('reporta pérdidas como utilidad negativa (antes se ocultaban como 0)', () => {
		const s = summarize([shift('2026-11-05T20:00:00Z', 100_000)], [{ fecha: null, monto: 150_000 }], []);
		expect(s.utilidadNeta).toBe(-50_000);
		expect(s.margen).toBeCloseTo(-0.5);
	});

	it('calcula food cost, ticket y tasa de merma', () => {
		const s = summarize(
			[shift('x', 600_000, 400_000, 90, 10), shift('y', 0, 0, 0, 0)],
			[],
			[{ fecha: null, costo: 320_000 }]
		);
		expect(s.ventasBrutas).toBe(1_000_000);
		expect(s.foodCost).toBeCloseTo(0.32);
		expect(s.ticketPorTurno).toBe(500_000);
		expect(s.tasaMerma).toBeCloseTo(0.1);
	});

	it('devuelve null en ratios sin ventas', () => {
		const s = summarize([], [], [{ fecha: null, costo: 1 }]);
		expect(s.foodCost).toBeNull();
		expect(s.margen).toBeNull();
	});
});

describe('delta', () => {
	it('calcula variación y tendencia', () => {
		expect(delta(120, 100)).toEqual({ pct: 0.2, trend: 'up' });
		expect(delta(80, 100).trend).toBe('down');
		expect(delta(100.1, 100).trend).toBe('flat');
		expect(delta(50, 0)).toEqual({ pct: null, trend: 'up' });
	});

	it('usa el valor absoluto de la base cuando era negativa', () => {
		expect(delta(0, -100).trend).toBe('up');
	});
});

describe('foodCostStatus', () => {
	it('clasifica por umbrales', () => {
		expect(foodCostStatus(0.28)).toBe('saludable');
		expect(foodCostStatus(0.33)).toBe('vigilar');
		expect(foodCostStatus(0.4)).toBe('riesgo');
		expect(foodCostStatus(null)).toBe('sin-datos');
	});
});

describe('periodos de negocio (Colombia, jornada desde 04:00)', () => {
	it('asigna un cierre a la 1 a.m. al día anterior', () => {
		// 2026-11-06 01:00 Colombia = 06:00Z
		expect(businessDayKey('2026-11-06T06:00:00Z')).toBe('2026-11-05');
		// 2026-11-05 21:00 Colombia = 2026-11-06T02:00Z -> sigue siendo día 5 (antes se agrupaba en el 6 por UTC)
		expect(businessDayKey('2026-11-06T02:00:00Z')).toBe('2026-11-05');
	});

	it('calcula el período anterior del mismo tipo', () => {
		const cur = currentRange('mensual', '2026-03-15');
		const prev = previousRange('mensual', cur);
		expect(businessDayKey(prev.start)).toBe('2026-02-01');
		expect(prev.end.getTime()).toBe(cur.start.getTime());

		const day = currentRange('diario', '2026-11-05');
		expect(businessDayKey(previousRange('diario', day).start)).toBe('2026-11-04');
	});

	it('compara un período en curso contra el mismo tramo del anterior', () => {
		const cur = currentRange('mensual', '2026-11-09');
		// "Ahora" = 9 nov 12:00 Colombia → el anterior debe ser 1 oct 04:00 → 9 oct 12:00
		const prev = previousRange('mensual', cur, new Date('2026-11-09T17:00:00Z'));
		expect(businessDayKey(prev.start)).toBe('2026-10-01');
		expect(prev.end.toISOString()).toBe('2026-10-09T17:00:00.000Z');
	});

	it('la utilidad descuenta gastos de caja y compras de insumos', () => {
		const s = summarize([shift('x', 1_000_000)], [{ fecha: null, monto: 50_000 }], [{ fecha: null, costo: 300_000 }]);
		expect(s.utilidadNeta).toBe(650_000);
		expect(s.margen).toBeCloseTo(0.65);
	});

	it('genera 7 barras para la vista diaria y 12 para la anual', () => {
		const day = currentRange('diario', '2026-11-05');
		const b = buildBuckets('diario', seriesWindow('diario', day));
		expect(b).toHaveLength(7);
		expect(b.at(-1)?.key).toBe('2026-11-05');
		expect(buildBuckets('anual', currentRange('anual', '2026-06-01'))).toHaveLength(12);
	});

	it('agrupa el flujo de caja por día de negocio', () => {
		const day = currentRange('diario', '2026-11-05');
		const series = buildCashflow(
			'diario',
			buildBuckets('diario', seriesWindow('diario', day)),
			[shift('2026-11-06T02:00:00Z', 100, 50)],
			[{ fecha: '2026-11-05T18:00:00Z', monto: 30 }]
		);
		const last = series.at(-1)!;
		expect(last).toMatchObject({ efectivo: 100, transferencias: 50, gastos: 30, neto: 120 });
	});
});

describe('política de acceso', () => {
	it('niega por defecto a roles desconocidos (antes tenían acceso total)', () => {
		expect(canAccess('gerente', '/finanzas/resumen')).toBe(false);
		expect(canAccess('Cajero ', '/configuracion/personal')).toBe(false);
		expect(normalizeRol('JEFE')).toBe('jefe');
	});

	it('aplica a subrutas y no a prefijos parciales', () => {
		expect(canAccess('bodeguero', '/bodega')).toBe(true);
		expect(canAccess('bodeguero', '/bodegaXYZ')).toBe(false);
		expect(canAccess('cajero', '/turnos/cierre')).toBe(true);
		expect(canAccess('cajero', '/saas/suscripcion')).toBe(false);
		expect(canAccess('jefe', '/saas/suscripcion')).toBe(true);
		expect(homeFor('bodeguero')).toBe('/bodega');
	});
});
