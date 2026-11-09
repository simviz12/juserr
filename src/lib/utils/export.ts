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

export function todayStamp(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
}

export function safeFileName(s: string): string {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');
}
