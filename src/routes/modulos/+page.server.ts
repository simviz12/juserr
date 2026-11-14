import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	catalogo,
	ErrorNegocio,
	solicitarModulo,
	solicitudesPendientes
} from '$lib/billing/server';
import { tenantDe } from '$lib/server/tenancy';

export const load: PageServerLoad = async ({ locals, url }) => {
	const tid = tenantDe(locals);
	const [cat, pendientes] = await Promise.all([catalogo(), solicitudesPendientes(tid)]);
	const activos = new Set(locals.entitlements?.modulos ?? []);
	return {
		bloqueado: url.searchParams.get('bloqueado'),
		modulos: cat
			.filter((m) => !m.esCore && m.publico)
			.map((m) => ({
				codigo: m.codigo,
				nombre: m.nombre,
				descripcion: m.descripcion,
				precioMensualCents: m.precioMensualCents,
				activo: activos.has(m.codigo),
				solicitado: pendientes.some((p) => p.modulo === m.codigo)
			}))
	};
};

export const actions: Actions = {
	solicitar: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const modulo = (await request.formData()).get('modulo')?.toString() ?? '';
		try {
			const nombre = await solicitarModulo(tid, locals.user!.id, modulo);
			return {
				success: true,
				message: `Recibimos tu solicitud de "${nombre}". Te contactaremos para activarlo.`
			};
		} catch (e) {
			if (e instanceof ErrorNegocio) return fail(400, { error: e.message });
			console.error('[modulos] error al solicitar módulo:', e);
			return fail(500, { error: 'No se pudo enviar la solicitud. Intenta de nuevo.' });
		}
	}
};
