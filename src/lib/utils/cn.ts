/** Concatena clases condicionales (subset de clsx, sin dependencias). */
export function cn(...inputs: (string | false | null | undefined)[]): string {
	return inputs.filter(Boolean).join(' ');
}
