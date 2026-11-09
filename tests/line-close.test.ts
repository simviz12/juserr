import { describe, it, expect } from 'vitest';
import { cerrarLinea, consumoLinea, precioPorUnidad } from '../src/lib/features/shifts/domain/line-close';

const platos = [
	{ id: 1, precio: 16000, costo: 5200, unidades: 1 }, // hamburguesa clásica: 1 pan
	{ id: 2, precio: 24000, costo: 9100, unidades: 1 }, // doble + papas: 1 pan
	{ id: 3, precio: 14000, costo: 5600, unidades: 1 } // combo infantil
];

describe('cierre por inventario de líneas', () => {
	it('calcula consumo como inicial − sobrantes − mermas, nunca negativo', () => {
		expect(consumoLinea(40, 12, 3)).toBe(25);
		expect(consumoLinea(5, 8, 0)).toBe(0);
	});

	it('con desglose completo usa el precio exacto de cada plato', () => {
		const r = cerrarLinea(40, 12, 3, platos, [
			{ itemId: 1, cantidad: 15 },
			{ itemId: 2, cantidad: 6 },
			{ itemId: 3, cantidad: 4 }
		]);
		expect(r.consumidas).toBe(25);
		expect(r.desgloseCompleto).toBe(true);
		expect(r.ventaEsperada).toBe(15 * 16000 + 6 * 24000 + 4 * 14000);
	});

	it('sin desglose estima con el precio promedio por unidad', () => {
		const r = cerrarLinea(40, 12, 3, platos, []);
		expect(r.desgloseCompleto).toBe(false);
		expect(r.precioPorUnidad).toBeCloseTo(18000);
		expect(r.ventaEsperada).toBe(25 * 18000);
	});

	it('detecta un desglose que no explica todo el consumo (posible robo de panes)', () => {
		const r = cerrarLinea(40, 12, 3, platos, [{ itemId: 1, cantidad: 20 }]);
		expect(r.desgloseCompleto).toBe(false);
		expect(r.diferenciaUnidades).toBe(5);
		// sigue cobrando lo consumido al promedio, no solo lo declarado
		expect(r.ventaEsperada).toBe(25 * 18000);
	});

	it('respeta platos que consumen más de una unidad', () => {
		const r = cerrarLinea(10, 0, 0, [{ id: 9, precio: 30000, costo: 0, unidades: 2 }], [{ itemId: 9, cantidad: 5 }]);
		expect(r.desgloseCompleto).toBe(true);
		expect(r.ventaEsperada).toBe(150000);
		expect(precioPorUnidad([{ id: 9, precio: 30000, costo: 0, unidades: 2 }])).toBe(15000);
	});
});
