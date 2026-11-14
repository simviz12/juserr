/**
 * Navegación dentro de la misma página cambiando solo los parámetros de consulta
 * (filtros de fecha, rango, mes...). Todas las páginas de reportes la usan en vez
 * de armar a mano `goto('?a=1&b=2')`, así los valores siempre van codificados.
 */
import { goto } from '$app/navigation';
import { page } from '$app/state';

type QueryValue = string | number | null | undefined;
type GotoOptions = NonNullable<Parameters<typeof goto>[1]>;

/**
 * Va a la ruta actual con estos parámetros. `merge: true` conserva los que ya
 * estaban en la URL; un valor vacío, null o undefined elimina el parámetro.
 */
export function gotoWithQuery(
	params: Record<string, QueryValue>,
	{ merge = false, ...options }: GotoOptions & { merge?: boolean } = {}
): Promise<void> {
	const url = new URL(page.url);
	if (!merge) url.search = '';
	for (const [key, value] of Object.entries(params)) {
		if (value === null || value === undefined || value === '') url.searchParams.delete(key);
		else url.searchParams.set(key, String(value));
	}
	// La ruta sale de page.url, que SvelteKit ya resolvió (incluye el base path):
	// solo cambia la query, así que resolve() no aplica aquí.
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	return goto(url, { keepFocus: true, noScroll: true, ...options });
}
