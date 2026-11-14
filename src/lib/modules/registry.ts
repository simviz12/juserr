/**
 * Registro de módulos (isomórfico: lo usan el servidor y el menú).
 *
 * ── Cómo agregar un módulo (add-on o desarrollo a medida) ──────────────
 * 1. Crea su código en src/lib/modules/<codigo>/ y sus rutas en src/routes/.
 *    El módulo solo importa del Core (src/lib/...), nunca de otro módulo.
 * 2. Regístralo aquí con las rutas que le pertenecen.
 * 3. Agrégalo al catálogo (tabla modulos_catalogo) con una migración nueva.
 * 4. Actívalo por restaurante desde la consola /plataforma.
 * Las rutas registradas quedan bloqueadas automáticamente (vista y acciones)
 * para cualquier restaurante que no tenga el módulo pagado. El Core no se toca.
 */

export const CORE = 'core' as const;

export interface ModuleDef {
	codigo: string;
	nombre: string;
	/** Prefijos de ruta que pertenecen al módulo. El Core no declara rutas: es todo lo demás. */
	rutas: readonly string[];
}

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

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

/** Add-on al que pertenece una ruta, o null si la ruta es del Core. */
export function moduloDeRuta(path: string): ModuleDef | null {
	return ADDONS.find((m) => m.rutas.some((r) => matches(path, r))) ?? null;
}

export function nombreModulo(codigo: string): string {
	if (codigo === CORE) return 'Plan Core';
	return ADDONS.find((m) => m.codigo === codigo)?.nombre ?? codigo;
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
	estadoCore: EstadoCore;
	/** Add-ons utilizables hoy (pagados o en gracia). */
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
	| { tipo: 'modulo-no-contratado'; modulo: ModuleDef }
	| { tipo: 'solo-lectura' }
	| { tipo: 'suspendido' };

/**
 * Decide si un restaurante puede usar una ruta. `escritura` = la petición
 * modifica datos (form action / POST). Función pura: misma regla en servidor y menú.
 */
export function evaluarAcceso(path: string, ent: Entitlements, escritura: boolean): Gate {
	if (RUTAS_SIEMPRE.some((r) => matches(path, r) && (r !== '/' || path === '/')))
		return { tipo: 'ok' };
	if (ent.estadoCore === 'suspendido') return { tipo: 'suspendido' };
	const modulo = moduloDeRuta(path);
	if (modulo && !ent.modulos.includes(modulo.codigo))
		return { tipo: 'modulo-no-contratado', modulo };
	if (escritura && ent.estadoCore === 'solo-lectura') return { tipo: 'solo-lectura' };
	return { tipo: 'ok' };
}

/** ¿El menú debe mostrar la ruta como disponible? (los add-ons no contratados van con candado). */
export function rutaDisponible(path: string, ent: Entitlements): boolean {
	return evaluarAcceso(path, ent, false).tipo === 'ok';
}
