const copFormatter = new Intl.NumberFormat('es-CO', {
	style: 'currency',
	currency: 'COP',
	maximumFractionDigits: 0
});

const compactFormatter = new Intl.NumberFormat('es-CO', {
	notation: 'compact',
	maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export function formatCOP(value: number): string {
	return copFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatCompactCOP(value: number): string {
	return '$' + compactFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
	return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatPct(value: number | null, digits = 1): string {
	if (value === null || !Number.isFinite(value)) return '—';
	return `${(value * 100).toFixed(digits).replace('.', ',')}%`;
}

const dateFmt = new Intl.DateTimeFormat('es-CO', {
	day: '2-digit',
	month: 'short',
	timeZone: 'America/Bogota'
});
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', {
	day: '2-digit',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'America/Bogota'
});

export function formatDate(value: string | Date | null): string {
	if (!value) return '—';
	return dateFmt.format(new Date(value));
}

export function formatDateTime(value: string | Date | null): string {
	if (!value) return '—';
	return dateTimeFmt.format(new Date(value));
}
