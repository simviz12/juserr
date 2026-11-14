import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	descartarSolicitud,
	ErrorNegocio,
	listarRestaurantes,
	solicitudesPendientes
} from '$lib/billing/server';
import { calcularEntitlements } from '$lib/billing/domain';
import { businessDayKey } from '$lib/features/finance/domain/period';

export const load: PageServerLoad = async () => {
	const [restaurantes, solicitudes] = await Promise.all([
		listarRestaurantes(),
		solicitudesPendientes()
	]);
	const hoy = businessDayKey(new Date());
	const filas = restaurantes.map((r) => {
		const ent = calcularEntitlements(
			r,
			r.coreVigenteHasta
				? [
						{
							modulo: 'core',
							estado: 'activa',
							vigenteHasta: r.coreVigenteHasta,
							precioMensualCents: 0
						}
					]
				: [],
			hoy
		);
		return { ...r, estadoCore: ent.estadoCore, diasParaVencer: ent.diasParaVencer };
	});
	const activos = filas.filter((r) => r.estado === 'activo');
	return {
		restaurantes: filas,
		solicitudes: solicitudes.map((s) => ({ ...s, createdAt: s.createdAt?.toISOString() ?? null })),
		resumen: {
			activos: activos.length,
			// Ingreso recurrente mensual de los restaurantes activos (MRR)
			mrrCents: activos.reduce((a, r) => a + r.mensualCents, 0),
			porVencer: activos.filter(
				(r) => r.diasParaVencer !== null && r.diasParaVencer >= 0 && r.diasParaVencer <= 5
			).length,
			vencidos: activos.filter((r) => r.estadoCore === 'gracia' || r.estadoCore === 'solo-lectura')
				.length
		}
	};
};

export const actions: Actions = {
	descartar: async ({ request, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Solicitud inválida.' });
		try {
			await descartarSolicitud(locals.platformAdmin!.id, id);
			return { success: true, message: 'Solicitud descartada.' };
		} catch (e) {
			if (e instanceof ErrorNegocio) return fail(400, { error: e.message });
			throw e;
		}
	}
};
