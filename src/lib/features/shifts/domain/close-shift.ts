/**
 * Reglas puras del cierre de turno (conciliación de inventario de vitrina).
 */

export const PORCIONES_POR_MASA = 8;

/** Entero no negativo; vacío o inválido => 0. */
export function nonNegInt(value: unknown): number {
	const n = parseInt(String(value ?? ''), 10);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Decimal no negativo; vacío o inválido => 0. */
export function nonNegFloat(value: unknown): number {
	const n = parseFloat(String(value ?? ''));
	return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface InventoryInput {
	masasIniciales: number;
	masasSobrantes: number;
	porcionesAyer: number;
	porcionesSobrantes: number;
	porcionesMermadas: number;
}

/** Porciones vendidas = (masas usadas × 8 + vitrina de ayer) − sobrantes − mermas. */
export function porcionesVendidas(i: InventoryInput): number {
	const masasUsadas = Math.max(0, i.masasIniciales - i.masasSobrantes);
	return Math.max(
		0,
		Math.round(masasUsadas * PORCIONES_POR_MASA + i.porcionesAyer - i.porcionesSobrantes - i.porcionesMermadas)
	);
}

export function ventasPorSabor(sobrasAyer: number, ruedas: number, sobras: number, quemadas: number): number {
	return Math.max(0, sobrasAyer + ruedas * PORCIONES_POR_MASA - sobras - quemadas);
}

/**
 * Referencias de comprobantes (Nequi/Daviplata) normalizadas. Solo cuenta
 * tokens de ≥4 caracteres que tengan al menos un dígito, para no confundir
 * palabras sueltas ("pago", "cliente") con comprobantes.
 */
export function extractRefs(text: string | null | undefined): string[] {
	if (!text) return [];
	return [
		...new Set(
			text
				.split(/[,;\s]+/)
				.map((t) => t.trim().toLowerCase())
				.filter((t) => t.length >= 4 && /\d/.test(t))
		)
	];
}

export interface GastoInput {
	descripcion: string;
	monto: number;
}

export function parseGastos(descripciones: string[], montos: string[]): GastoInput[] {
	const out: GastoInput[] = [];
	for (let i = 0; i < descripciones.length; i++) {
		const descripcion = descripciones[i].trim().slice(0, 200);
		const monto = parseFloat(montos[i]);
		if (descripcion && Number.isFinite(monto) && monto > 0) out.push({ descripcion, monto });
	}
	return out;
}
