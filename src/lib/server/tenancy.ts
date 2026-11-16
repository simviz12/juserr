/**
 * Aislamiento por restaurante (tenant).
 *
 * REGLA: toda consulta a una tabla de negocio filtra por el tenant del usuario
 * con `delTenant(tabla, tid, ...)` y todo insert lleva `tenantId: tid`.
 * El tenant SIEMPRE sale de la sesión (`tenantDe(locals)`), nunca del formulario
 * ni de la URL. tests/tenant-isolation.test.ts recorre las páginas y acciones
 * con dos restaurantes para comprobar que ninguno ve ni modifica datos del otro.
 */
import { error } from '@sveltejs/kit';
import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { suscripcionesModulo, tenants } from '$lib/server/schema';
import { calcularEntitlements } from '$lib/billing/domain';
import { businessDayKey } from '$lib/features/finance/domain/period';
import type { Entitlements } from '$lib/modules/registry';

/** Id del restaurante del usuario en sesión. Sin sesión → 401. */
export function tenantDe(locals: App.Locals): number {
	const id = locals.user?.tenantId;
	if (!id) error(401, 'Sesión inválida');
	return id;
}

/** Condición `tabla.tenant_id = tid AND ...condiciones`. */
export function delTenant(
	table: { tenantId: AnyPgColumn },
	tenantId: number,
	...condiciones: (SQL | undefined)[]
): SQL {
	return and(eq(table.tenantId, tenantId), ...condiciones) as SQL;
}

// ── Derechos (plan y módulos pagados) ──────────────────────────────────

export interface TenantInfo {
	id: number;
	codigo: string;
	nombre: string;
	estado: string;
	diasGracia: number;
}

const TTL_MS = 10_000;
const cache = new Map<number, { info: TenantInfo; ent: Entitlements; at: number }>();

/**
 * Plan y módulos utilizables hoy por un restaurante. Se cachea 10 s por
 * instancia: un pago registrado en la consola se refleja en ≤10 s (y al
 * instante en la instancia que lo registró, ver `invalidarDerechos`).
 */
export async function derechosDe(
	tenantId: number,
	ahora = new Date()
): Promise<{ info: TenantInfo; ent: Entitlements } | null> {
	const hit = cache.get(tenantId);
	if (hit && ahora.getTime() - hit.at < TTL_MS) return hit;

	// Restaurante y suscripciones en paralelo (antes: dos consultas en serie).
	const [[info], subs] = await Promise.all([
		db
			.select({
				id: tenants.id,
				codigo: tenants.codigo,
				nombre: tenants.nombre,
				estado: tenants.estado,
				diasGracia: tenants.diasGracia
			})
			.from(tenants)
			.where(eq(tenants.id, tenantId)),
		db
			.select({
				modulo: suscripcionesModulo.modulo,
				estado: suscripcionesModulo.estado,
				vigenteHasta: suscripcionesModulo.vigenteHasta,
				precioMensualCents: suscripcionesModulo.precioMensualCents
			})
			.from(suscripcionesModulo)
			.where(eq(suscripcionesModulo.tenantId, tenantId))
	]);
	if (!info) return null;

	const value = {
		info,
		ent: calcularEntitlements(info, subs, businessDayKey(ahora)),
		at: ahora.getTime()
	};
	if (cache.size >= 5_000) {
		const primera = cache.keys().next().value;
		if (primera !== undefined) cache.delete(primera);
	}
	cache.set(tenantId, value);
	return value;
}

export function invalidarDerechos(tenantId?: number): void {
	if (tenantId === undefined) cache.clear();
	else cache.delete(tenantId);
}
