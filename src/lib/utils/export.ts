/**
 * Exportación a Excel. La librería xlsx (~400 KB) se carga solo al exportar,
 * no en cada visita a la página.
 */
export interface SheetSpec {
	name: string;
	rows: Record<string, string | number | null>[];
}

export async function exportExcel(fileName: string, sheets: SheetSpec[]): Promise<boolean> {
	const nonEmpty = sheets.filter((s) => s.rows.length > 0);
	if (nonEmpty.length === 0) return false;
	const XLSX = await import('xlsx');
	const wb = XLSX.utils.book_new();
	for (const s of nonEmpty) {
		const ws = XLSX.utils.json_to_sheet(s.rows);
		// Ancho de columnas según el contenido
		const keys = Object.keys(s.rows[0]);
		ws['!cols'] = keys.map((k) => ({
			wch: Math.min(40, Math.max(k.length, ...s.rows.map((r) => String(r[k] ?? '').length)) + 2)
		}));
		XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
	}
	XLSX.writeFile(wb, `${fileName}.xlsx`);
	return true;
}

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue, delimiter: string, decimal: string): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number')
		return Number.isFinite(value) ? String(value).replace('.', decimal) : '';
	// Una celda que empieza por = + - @ se ejecutaría como fórmula al abrir el archivo en Excel.
	const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return text.includes(delimiter) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Serializa filas a CSV. Por defecto usa `;` y coma decimal, que es lo que Excel
 * espera con configuración regional de Colombia (con `,` abre todo en una columna).
 */
export function toCsv(rows: Record<string, CsvValue>[], delimiter = ';', decimal = ','): string {
	if (rows.length === 0) return '';
	const keys = Object.keys(rows[0]);
	const lines = [keys.map((k) => csvCell(k, delimiter, decimal)).join(delimiter)];
	for (const r of rows)
		lines.push(keys.map((k) => csvCell(r[k], delimiter, decimal)).join(delimiter));
	return lines.join('\r\n');
}

/** Descarga un CSV (con BOM para que Excel respete tildes y eñes). */
export function exportCsv(fileName: string, rows: Record<string, CsvValue>[]): boolean {
	if (rows.length === 0) return false;
	const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${fileName}.csv`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	return true;
}

export function todayStamp(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
}

export function safeFileName(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\w-]+/g, '_');
}
