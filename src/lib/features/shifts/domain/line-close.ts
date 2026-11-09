/**
 * Conciliación por inventario de una línea (hamburguesas, chuzos, lasañas, carnes).
 * Pensado para puestos callejeros: se cuenta un insumo de control (pan, chuzo
 * armado, porción) al cierre y el sistema deduce cuánto se vendió.
 *
 *   consumidas = inicial (bodega) − sobrantes (contados) − mermas
 */

export interface PlatoLinea {
	id: number;
	precio: number;
	costo: number;
	/** Unidades del insumo de control que consume una venta (p. ej. 1 pan). */
	unidades: number;
}

export interface DesgloseItem {
	itemId: number;
	cantidad: number;
}

export interface LineCloseResult {
	consumidas: number;
	/** Unidades de control que explica el desglose por plato. */
	unidadesDesglose: number;
	/** true si el desglose explica exactamente el consumo (±0,01). */
	desgloseCompleto: boolean;
	/** Diferencia (consumidas − desglose); >0 = unidades sin explicar. */
	diferenciaUnidades: number;
	ventaEsperada: number;
	/** Precio promedio por unidad de control (para el cálculo sin desglose). */
	precioPorUnidad: number;
}

const EPS = 0.01;

export function consumoLinea(inicial: number, sobrantes: number, mermas: number): number {
	return Math.max(0, inicial - sobrantes - mermas);
}

/** Promedio simple del precio por unidad de control de los platos activos. */
export function precioPorUnidad(platos: readonly PlatoLinea[]): number {
	const validos = platos.filter((p) => p.precio > 0 && p.unidades > 0);
	if (validos.length === 0) return 0;
	return validos.reduce((a, p) => a + p.precio / p.unidades, 0) / validos.length;
}

/**
 * Venta esperada de la línea:
 *  - con desglose completo → suma exacta de cantidad × precio de cada plato
 *  - sin desglose (o incompleto) → unidades consumidas × precio promedio por unidad
 *    (el faltante/sobrante del cuadre sigue siendo detectable)
 */
export function cerrarLinea(
	inicial: number,
	sobrantes: number,
	mermas: number,
	platos: readonly PlatoLinea[],
	desglose: readonly DesgloseItem[]
): LineCloseResult {
	const consumidas = consumoLinea(inicial, sobrantes, mermas);
	const byId = new Map(platos.map((p) => [p.id, p]));
	let unidadesDesglose = 0;
	let ventaDesglose = 0;
	for (const d of desglose) {
		const p = byId.get(d.itemId);
		if (!p || d.cantidad <= 0) continue;
		unidadesDesglose += d.cantidad * p.unidades;
		ventaDesglose += d.cantidad * p.precio;
	}
	const ppu = precioPorUnidad(platos);
	const desgloseCompleto = unidadesDesglose > 0 && Math.abs(unidadesDesglose - consumidas) < EPS;
	return {
		consumidas,
		unidadesDesglose,
		desgloseCompleto,
		diferenciaUnidades: consumidas - unidadesDesglose,
		ventaEsperada: Math.round(desgloseCompleto ? ventaDesglose : consumidas * ppu),
		precioPorUnidad: ppu
	};
}

/** Insumo de control sugerido por línea, creado automáticamente si no existe. */
export const CONTROL_POR_DEFECTO: Record<string, { nombre: string; unidad: string; etiqueta: string }> = {
	burger: { nombre: 'Pan de hamburguesa', unidad: 'unidad', etiqueta: 'panes' },
	chuzo: { nombre: 'Chuzos armados', unidad: 'unidad', etiqueta: 'chuzos' },
	lasana: { nombre: 'Porciones de lasaña', unidad: 'unidad', etiqueta: 'porciones' },
	carne: { nombre: 'Porciones de carne', unidad: 'unidad', etiqueta: 'porciones' }
};
