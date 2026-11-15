/**
 * Reglas de facturación (puras, sin BD). Montos en centavos de COP y fechas
 * como claves de día de negocio "YYYY-MM-DD" (Colombia).
 *
 * Modelo: cada módulo contratado (Core incluido) tiene un `vigenteHasta`: el
 * último día cubierto por pagos. Pagar N meses de un módulo extiende esa fecha.
 * Si vence, hay `diasGracia` días en los que todo sigue funcionando con aviso;
 * después, un add-on se bloquea y el Core pasa a solo lectura.
 */
import { CORE, type Entitlements, type EstadoCore } from '$lib/modules/registry';

export interface SuscripcionModulo {
	modulo: string;
	estado: 'activa' | 'cancelada' | string;
	vigenteHasta: string;
	precioMensualCents: number;
}

export type EstadoTenant = 'activo' | 'suspendido' | 'cancelado' | string;

const DAY = 86_400_000;
const toUtc = (k: string) => Date.parse(k + 'T00:00:00Z');
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function diasEntre(desde: string, hasta: string): number {
	return Math.round((toUtc(hasta) - toUtc(desde)) / DAY);
}

export function sumarDias(k: string, n: number): string {
	return toKey(toUtc(k) + n * DAY);
}

/** Suma meses calendario; si el día no existe en el mes destino, usa el último (31 ene + 1 mes = 28/29 feb). */
export function sumarMeses(k: string, meses: number): string {
	const [y, m, d] = k.split('-').map(Number);
	const base = new Date(Date.UTC(y, m - 1 + meses, 1));
	const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
	base.setUTCDate(Math.min(d, ultimo));
	return toKey(base.getTime());
}

export type EstadoModulo = 'vigente' | 'gracia' | 'vencido';

export function estadoModulo(s: SuscripcionModulo, hoy: string, diasGracia: number): EstadoModulo {
	if (s.estado !== 'activa') return 'vencido';
	if (hoy <= s.vigenteHasta) return 'vigente';
	return diasEntre(s.vigenteHasta, hoy) <= diasGracia ? 'gracia' : 'vencido';
}

/** Qué puede usar hoy un restaurante. */
export function calcularEntitlements(
	tenant: { estado: EstadoTenant; diasGracia: number; codigo?: string },
	subs: readonly SuscripcionModulo[],
	hoy: string
): Entitlements {
	const core = subs.find((s) => s.modulo === CORE);
	const estadoCoreMod = core ? estadoModulo(core, hoy, tenant.diasGracia) : 'vencido';

	let estadoCore: EstadoCore =
		estadoCoreMod === 'vigente' ? 'al-dia' : estadoCoreMod === 'gracia' ? 'gracia' : 'solo-lectura';
	if (tenant.estado !== 'activo') estadoCore = 'suspendido';

	// Un add-on sin Core al día no aporta escritura, pero sí se puede consultar
	// (sus datos son del cliente); sigue la misma regla de gracia que el Core.
	const modulos =
		estadoCore === 'suspendido'
			? []
			: subs
					.filter((s) => s.modulo !== CORE && estadoModulo(s, hoy, tenant.diasGracia) !== 'vencido')
					.map((s) => s.modulo)
					.sort();

	const diasParaVencer = core ? diasEntre(hoy, core.vigenteHasta) : null;
	return {
		tenant: tenant.codigo ?? null,
		estadoCore,
		modulos,
		coreVigenteHasta: core?.vigenteHasta ?? null,
		diasParaVencer,
		diasGraciaRestantes:
			estadoCore === 'gracia' && core ? tenant.diasGracia - diasEntre(core.vigenteHasta, hoy) : null
	};
}

/** Total mensual de los módulos activos (lo que el restaurante paga cada mes). */
export function totalMensualCents(subs: readonly SuscripcionModulo[]): number {
	return subs.filter((s) => s.estado === 'activa').reduce((a, s) => a + s.precioMensualCents, 0);
}

/**
 * Nueva fecha de vigencia tras pagar `meses` de un módulo. Si estaba al día se
 * extiende desde su vencimiento (no se pierden días); si ya venció, desde hoy.
 */
export function extenderVigencia(
	vigenteHasta: string | null,
	hoy: string,
	meses: number
): { desde: string; hasta: string } {
	const desde = vigenteHasta && vigenteHasta >= hoy ? sumarDias(vigenteHasta, 1) : hoy;
	return { desde, hasta: sumarDias(sumarMeses(desde, meses), -1) };
}

/**
 * Valor proporcional para activar un add-on a mitad del ciclo y alinearlo con
 * el vencimiento del Core (una sola fecha de pago para el cliente).
 * Base de 30 días; redondea al peso hacia arriba.
 */
export function prorrateoCents(precioMensualCents: number, hoy: string, hasta: string): number {
	const dias = diasEntre(hoy, hasta) + 1;
	if (dias <= 0) return 0;
	const cents = Math.ceil((precioMensualCents * dias) / 30);
	return Math.ceil(cents / 100) * 100;
}

/** Código de restaurante válido: minúsculas, números y guiones simples (3–40). */
export function esCodigoTenant(v: string): boolean {
	return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 40;
}

/** Sugiere un código a partir del nombre ("Pizzería Don Juan" → "pizzeria-don-juan"). */
export function sugerirCodigo(nombre: string): string {
	return nombre
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/g, '');
}
