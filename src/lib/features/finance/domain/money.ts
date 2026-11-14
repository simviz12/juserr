/**
 * Aritmética monetaria exacta. Todo importe se maneja como un ENTERO de centavos:
 * sumar `0.1 + 0.2` en coma flotante da 0.30000000000000004, y esos errores se
 * acumulan al totalizar cientos de movimientos. Con enteros la suma es exacta
 * (hasta ±90 billones de pesos, límite de Number.MAX_SAFE_INTEGER).
 */

const DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?$/;

/**
 * Convierte un importe a centavos sin pasar por coma flotante cuando llega como
 * texto (así entrega Postgres las columnas NUMERIC). Redondea al centavo más
 * cercano (mitad hacia arriba, en magnitud). Valores vacíos o inválidos => 0.
 */
export function toCents(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : 0;

	const m = DECIMAL.exec(String(value).trim());
	if (!m) return 0;
	const [, sign, entero, decimales = ''] = m;
	const dec = (decimales + '000').slice(0, 3);
	let cents = Number(entero) * 100 + Number(dec.slice(0, 2));
	if (dec.charCodeAt(2) >= 53 /* '5' */) cents += 1;
	if (!Number.isSafeInteger(cents)) return 0;
	return sign === '-' ? -cents : cents;
}

/** Centavos → pesos (solo para mostrar o exportar; no volver a sumar el resultado). */
export function fromCents(cents: number): number {
	return cents / 100;
}

/** Centavos → texto decimal exacto para guardar en una columna NUMERIC ("1234.50"). */
export function centsToDecimalString(cents: number): string {
	const abs = Math.abs(cents);
	const s = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
	return cents < 0 ? `-${s}` : s;
}

export function sumCents<T>(rows: readonly T[], pick: (row: T) => number): number {
	let total = 0;
	for (const r of rows) total += pick(r);
	return total;
}

/** Razón entre dos importes; null si no hay base (evita dividir por cero y mostrar "Infinity %"). */
export function ratio(num: number, den: number): number | null {
	return den > 0 ? num / den : null;
}

/**
 * Lee un importe escrito por una persona en un formulario ("1.250.000", "35000,50",
 * "$ 12 000"). Devuelve centavos o null si no es un importe válido.
 * Convención colombiana: el punto separa miles y la coma, decimales. Un único punto
 * seguido de 1–2 dígitos se toma como decimal ("1250.5").
 */
export function parseMoneyInput(raw: string): number | null {
	let s = raw.replace(/[\s$]/g, '');
	if (!s) return null;
	if (s.includes(',')) {
		s = s.replace(/\./g, '').replace(',', '.');
	} else if ((s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s)) {
		s = s.replace(/\./g, '');
	}
	if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
	const cents = toCents(s);
	return Number.isSafeInteger(cents) ? cents : null;
}
