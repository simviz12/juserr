/**
 * Registro de módulos (isomórfico: lo usan el servidor y el menú).
 *
 * El modelo de negocio:
 *   - CORE: el esqueleto que usan todos los restaurantes.
 *   - ADDONS: funciones adicionales que cualquier restaurante puede contratar.
 *   - EXCLUSIVOS: funciones construidas a pedido de UN restaurante. Solo existen
 *     para él: nadie más las ve en el menú, no aparecen en ningún catálogo, su
 *     URL responde 404 para cualquier otro restaurante y la base de datos impide
 *     activárselas a otro (trigger en suscripciones_modulo).
 *
 * Para crear una función exclusiva: `pnpm modulo:nuevo` (ver docs/wiki/07).
 */

export const CORE = 'core' as const;

/** Íconos disponibles para las entradas propias del menú (ver ICONOS en +layout.svelte). */
export const ICONOS_MENU = [
	'puzzle',
	'truck',
	'calendar',
	'clipboard',
	'chart',
	'users',
	'star',
	'receipt',
	'package',
	'utensils'
] as const;
export type IconoMenu = (typeof ICONOS_MENU)[number];

export interface ModuleDef {
	codigo: string;
	nombre: string;
	/** Prefijos de ruta que pertenecen al módulo. El Core no declara rutas: es todo lo demás. */
	rutas: readonly string[];
	/**
	 * Código del restaurante dueño. Si se define, el módulo es EXCLUSIVO: para
	 * cualquier otro restaurante no existe (404, sin menú, sin catálogo).
	 */
	exclusivoDe?: string;
	/** Entrada propia en el menú lateral (sección "Hecho para ti" o "Módulos"). */
	menu?: { nombre: string; ruta: string; icono?: IconoMenu };
}

/** Funciones adicionales que cualquier restaurante puede contratar. */
export const ADDONS: readonly ModuleDef[] = [
	{
		codigo: 'finanzas-avanzadas',
		nombre: 'Finanzas avanzadas',
		rutas: ['/finanzas/resumen', '/finanzas/semanal', '/finanzas/mensual']
	},
	{
		codigo: 'estado-resultados',
		nombre: 'Estado de Resultados',
		rutas: ['/finanzas/estado-resultados']
	},
	{
		codigo: 'produccion',
		nombre: 'Reporte de producción',
		rutas: ['/reportes/produccion']
	}
];

/**
 * Funciones construidas a pedido de un restaurante. Sus rutas viven bajo
 * /m/<codigo> y su código bajo src/lib/modules/<codigo>/.
 * `pnpm modulo:nuevo` agrega aquí las entradas nuevas (no borres el marcador).
 */
export const EXCLUSIVOS: readonly ModuleDef[] = [
	// @modulos-exclusivos
];

export const PREFIJO_EXCLUSIVOS = '/m/';

const TODOS: readonly ModuleDef[] = [...ADDONS, ...EXCLUSIVOS];

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

/** Módulo al que pertenece una ruta, o null si la ruta es del Core. */
export function moduloDeRuta(path: string, mods: readonly ModuleDef[] = TODOS): ModuleDef | null {
	return mods.find((m) => m.rutas.some((r) => matches(path, r))) ?? null;
}

export function nombreModulo(codigo: string): string {
	if (codigo === CORE) return 'Plan Core';
	return TODOS.find((m) => m.codigo === codigo)?.nombre ?? codigo;
}

// ── Derechos de acceso del restaurante (calculados en el servidor) ──────

/**
 * - `al-dia`: Core pagado.
 * - `gracia`: Core vencido, dentro de los días de gracia (todo funciona, con aviso).
 * - `solo-lectura`: Core vencido y gracia agotada (se ve y exporta, no se registra).
 * - `suspendido`: suspendido por el dueño de la plataforma (solo facturación).
 */
export type EstadoCore = 'al-dia' | 'gracia' | 'solo-lectura' | 'suspendido';

export interface Entitlements {
	/** Código del restaurante (para resolver los módulos exclusivos). */
	tenant: string | null;
	estadoCore: EstadoCore;
	/** Módulos adicionales y exclusivos utilizables hoy (pagados o en gracia). */
	modulos: string[];
	/** Último día pagado del Core (YYYY-MM-DD) o null si nunca se activó. */
	coreVigenteHasta: string | null;
	/** Días hasta que vence (negativo = vencido). */
	diasParaVencer: number | null;
	/** Días de gracia que quedan (solo en estado `gracia`). */
	diasGraciaRestantes: number | null;
}

/** Rutas que siempre funcionan, aunque el restaurante esté bloqueado. */
export const RUTAS_SIEMPRE = ['/', '/logout', '/facturacion', '/modulos'];

export type Gate =
	| { tipo: 'ok' }
	/** La ruta es un módulo exclusivo de OTRO restaurante: para este no existe. */
	| { tipo: 'no-encontrado' }
	| { tipo: 'modulo-no-contratado'; modulo: ModuleDef }
	| { tipo: 'solo-lectura' }
	| { tipo: 'suspendido' };

const esDeOtro = (m: ModuleDef, ent: Entitlements) =>
	!!m.exclusivoDe && m.exclusivoDe !== ent.tenant;

/**
 * Decide si un restaurante puede usar una ruta. `escritura` = la petición
 * modifica datos (form action / POST). Función pura: misma regla en servidor y menú.
 */
export function evaluarAcceso(
	path: string,
	ent: Entitlements,
	escritura: boolean,
	mods: readonly ModuleDef[] = TODOS
): Gate {
	if (RUTAS_SIEMPRE.some((r) => matches(path, r) && (r !== '/' || path === '/')))
		return { tipo: 'ok' };
	const modulo = moduloDeRuta(path, mods);
	// Primero: lo exclusivo de otro restaurante no existe (ni siquiera revela que está suspendido).
	if (modulo && esDeOtro(modulo, ent)) return { tipo: 'no-encontrado' };
	if (ent.estadoCore === 'suspendido') return { tipo: 'suspendido' };
	if (modulo && !ent.modulos.includes(modulo.codigo))
		return { tipo: 'modulo-no-contratado', modulo };
	if (escritura && ent.estadoCore === 'solo-lectura') return { tipo: 'solo-lectura' };
	return { tipo: 'ok' };
}

/** ¿El menú debe mostrar la ruta como disponible? (los add-ons no contratados van con candado). */
export function rutaDisponible(path: string, ent: Entitlements): boolean {
	return evaluarAcceso(path, ent, false).tipo === 'ok';
}

export interface EntradaMenu {
	codigo: string;
	nombre: string;
	ruta: string;
	icono: IconoMenu;
	exclusivo: boolean;
	/** true = visible con candado (add-on general no contratado o exclusivo vencido). */
	bloqueado: boolean;
}

/**
 * Entradas de menú de los módulos que declaran `menu`. Los exclusivos solo
 * aparecen para su dueño; los generales aparecen para todos (con candado si
 * no los tienen).
 */
export function menuModulos(ent: Entitlements, mods: readonly ModuleDef[] = TODOS): EntradaMenu[] {
	return mods
		.filter((m) => m.menu && !esDeOtro(m, ent))
		.map((m) => ({
			codigo: m.codigo,
			nombre: m.menu!.nombre,
			ruta: m.menu!.ruta,
			icono: m.menu!.icono ?? 'puzzle',
			exclusivo: !!m.exclusivoDe,
			bloqueado: !ent.modulos.includes(m.codigo)
		}));
}

/** Errores de configuración del registro (los valida tests/billing.test.ts). */
export function validarRegistro(mods: readonly ModuleDef[] = TODOS): string[] {
	const errores: string[] = [];
	const codigos = new Set<string>();
	const rutas: string[] = [];
	for (const m of mods) {
		if (codigos.has(m.codigo)) errores.push(`Código repetido: ${m.codigo}`);
		codigos.add(m.codigo);
		if (m.codigo === CORE) errores.push('"core" no se registra como módulo');
		if (m.rutas.length === 0) errores.push(`${m.codigo}: sin rutas`);
		for (const r of m.rutas) {
			if (rutas.some((x) => matches(r, x) || matches(x, r)))
				errores.push(`${m.codigo}: la ruta ${r} se cruza con otra`);
			rutas.push(r);
			if (m.exclusivoDe && !r.startsWith(PREFIJO_EXCLUSIVOS))
				errores.push(`${m.codigo}: un exclusivo debe vivir bajo ${PREFIJO_EXCLUSIVOS}`);
		}
		if (m.menu && !m.rutas.some((r) => matches(m.menu!.ruta, r)))
			errores.push(`${m.codigo}: el menú apunta fuera de sus rutas`);
	}
	return errores;
}
