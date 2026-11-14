/**
 * Freno de fuerza bruta para el login: tras MAX_FALLOS intentos fallidos de la
 * misma IP o del mismo usuario dentro de VENTANA_MS, se bloquea hasta que la
 * ventana expire. Es en memoria (por instancia del servidor): suficiente para un
 * despliegue Node único; en varias instancias cada una aplica su propio límite.
 */
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60_000;
const MAX_CLAVES = 10_000;

const fallos = new Map<string, { n: number; desde: number }>();

function vigente(clave: string, ahora: number) {
	const e = fallos.get(clave);
	if (!e) return null;
	if (ahora - e.desde > VENTANA_MS) {
		fallos.delete(clave);
		return null;
	}
	return e;
}

/** Minutos que faltan para poder intentar de nuevo, o 0 si no hay bloqueo. */
export function minutosBloqueo(claves: string[], ahora = Date.now()): number {
	let restante = 0;
	for (const c of claves) {
		const e = vigente(c, ahora);
		if (e && e.n >= MAX_FALLOS) restante = Math.max(restante, VENTANA_MS - (ahora - e.desde));
	}
	return Math.ceil(restante / 60_000);
}

export function registrarFallo(claves: string[], ahora = Date.now()): void {
	if (fallos.size > MAX_CLAVES) fallos.clear(); // evita crecimiento sin límite ante un ataque distribuido
	for (const c of claves) {
		const e = vigente(c, ahora);
		if (e) e.n += 1;
		else fallos.set(c, { n: 1, desde: ahora });
	}
}

export function limpiarFallos(claves: string[]): void {
	for (const c of claves) fallos.delete(c);
}
