/**
 * Líneas de producto del negocio y su relación con los interruptores de configuración.
 */

export const RUBROS = [
	{ value: 'mixto', label: 'Negocio mixto (varias líneas)' },
	{ value: 'pizzas', label: 'Pizzería' },
	{ value: 'chuzos', label: 'Chuzos, asados y parrilla' },
	{ value: 'hamburguesas', label: 'Hamburguesería y comidas rápidas' },
	{ value: 'lasanas', label: 'Lasañas y pastas al horno' },
	{ value: 'carnes', label: 'Asadero de carnes y cortes' }
] as const;

export type Rubro = (typeof RUBROS)[number]['value'];

export function isRubro(v: unknown): v is Rubro {
	return RUBROS.some((r) => r.value === v);
}

/** Interruptor de configuración ↔ código de línea en `lineas_gastronomicas`. */
export const LINE_TOGGLES = [
	{ codigo: 'pizza', field: 'habilitarPizzas', form: 'habilitar_pizzas', label: 'Pizzas', description: 'Masas, porciones en vitrina y sabores. Activa la conciliación de pizzas en el cierre de turno.' },
	{ codigo: 'chuzo', field: 'habilitarChuzos', form: 'habilitar_chuzos', label: 'Chuzos y parrilla', description: 'Pinchos, tocineta y pechugas a la parrilla.' },
	{ codigo: 'burger', field: 'habilitarHamburguesas', form: 'habilitar_hamburguesas', label: 'Hamburguesas y combos', description: 'Pan, carnes, papas y combos.' },
	{ codigo: 'lasana', field: 'habilitarLasanas', form: 'habilitar_lasanas', label: 'Lasañas', description: 'Bandejas familiares y porciones individuales.' },
	{ codigo: 'carne', field: 'habilitarCarnes', form: 'habilitar_carnes', label: 'Carnes y asados', description: 'Cortes por peso, costillas y asados.' }
] as const;

export type LineToggleField = (typeof LINE_TOGGLES)[number]['field'];

export interface MenuItemEconomics {
	margen: number;
	/** costo / precio de venta; null si no hay precio. */
	foodCost: number | null;
}

export function itemEconomics(precioVenta: number, precioCosto: number): MenuItemEconomics {
	return {
		margen: precioVenta - precioCosto,
		foodCost: precioVenta > 0 ? precioCosto / precioVenta : null
	};
}
