import { describe, it, expect } from 'vitest';
import {
	extractRefs,
	porcionesVendidas,
	ventasPorSabor,
	parseGastos,
	nonNegInt
} from '../src/lib/features/shifts/domain/close-shift';
import { itemEconomics, isRubro } from '../src/lib/features/business/domain/lines';
import { formatFraction } from '../src/lib/utils/fractions';

describe('cierre de turno', () => {
	it('calcula porciones vendidas con vitrina de ayer y mermas', () => {
		expect(porcionesVendidas({ masasIniciales: 10, masasSobrantes: 7, porcionesAyer: 5, porcionesSobrantes: 4, porcionesMermadas: 2 })).toBe(23);
		expect(porcionesVendidas({ masasIniciales: 1, masasSobrantes: 1, porcionesAyer: 0, porcionesSobrantes: 3, porcionesMermadas: 0 })).toBe(0);
	});

	it('calcula ventas por sabor', () => {
		expect(ventasPorSabor(2, 3, 4, 1)).toBe(21);
	});

	it('detecta referencias de comprobantes y ignora palabras sueltas', () => {
		expect(extractRefs('M12345, c8901; pago cliente')).toEqual(['m12345', 'c8901']);
		expect(extractRefs('')).toEqual([]);
		expect(extractRefs('M12345 m12345')).toEqual(['m12345']);
	});

	it('descarta gastos vacíos o inválidos', () => {
		expect(parseGastos(['Hielo', '', 'Gas'], ['3000', '500', 'abc'])).toEqual([{ descripcion: 'Hielo', monto: 3000 }]);
		expect(nonNegInt('-3')).toBe(0);
		expect(nonNegInt('')).toBe(0);
	});
});

describe('líneas y menú', () => {
	it('calcula margen y food cost por plato', () => {
		expect(itemEconomics(20000, 6000)).toEqual({ margen: 14000, foodCost: 0.3 });
		expect(itemEconomics(0, 100).foodCost).toBeNull();
	});
	it('valida el tipo de negocio', () => {
		expect(isRubro('pizzas')).toBe(true);
		expect(isRubro('ferreteria')).toBe(false);
	});
});

describe('fracciones', () => {
	it('formatea negativos correctamente (antes -1.5 salía como "-2 1/2")', () => {
		expect(formatFraction(-1.5)).toBe('-1 1/2');
		expect(formatFraction(2.25)).toBe('2 1/4');
	});
});
