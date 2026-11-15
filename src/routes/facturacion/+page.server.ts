import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { normalizeRol } from '$lib/auth/access';
import { pagosDe, suscripcionesDe } from '$lib/billing/server';
import { estadoModulo, totalMensualCents } from '$lib/billing/domain';
import { businessDayKey } from '$lib/features/finance/domain/period';
import { tenantDe } from '$lib/server/tenancy';

/**
 * Accesible para todos los roles (es a donde se redirige cuando el restaurante
 * está bloqueado), pero solo el Jefe ve montos, módulos e historial de pagos.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const tid = tenantDe(locals);
	const motivo = url.searchParams.get('motivo');
	const esJefe = normalizeRol(locals.user?.rol) === 'jefe';
	const moduloVencido = motivo === 'modulo' ? url.searchParams.get('modulo') : null;
	const base = { esJefe, motivo, moduloVencido, tenant: locals.tenant, plan: locals.entitlements };
	if (!esJefe) return { ...base, cuenta: null };

	const [subs, historial] = await Promise.all([suscripcionesDe(tid), pagosDe(tid)]);
	const hoy = businessDayKey(new Date());
	const diasGracia = locals.tenant?.diasGracia ?? 5;

	return {
		...base,
		cuenta: {
			modulos: subs.map((s) => ({ ...s, situacion: estadoModulo(s, hoy, diasGracia) })),
			totalMensualCents: totalMensualCents(subs),
			pagos: historial,
			// Instrucciones de pago configurables por variable de entorno (Nequi, cuenta bancaria, etc.).
			instrucciones: (env.PAGO_INSTRUCCIONES ?? '')
				.split('|')
				.map((l) => l.trim())
				.filter(Boolean),
			contacto: env.SOPORTE_WHATSAPP ?? null
		}
	};
};
