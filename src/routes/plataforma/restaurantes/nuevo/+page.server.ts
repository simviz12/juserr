import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { catalogo, crearRestaurante, ErrorNegocio } from '$lib/billing/server';

export const load: PageServerLoad = async () => {
	const cat = await catalogo();
	return {
		modulos: cat.map((m) => ({
			codigo: m.codigo,
			nombre: m.nombre,
			esCore: m.esCore,
			precioMensualCents: m.precioMensualCents
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const fd = await request.formData();
		const txt = (k: string, max = 120) => fd.get(k)?.toString().trim().slice(0, max) ?? '';
		const limiteRaw = txt('limite_usuarios', 5);
		const datos = {
			nombre: txt('nombre', 80),
			codigo: txt('codigo', 40).toLowerCase(),
			contactoNombre: txt('contacto_nombre'),
			contactoTelefono: txt('contacto_telefono', 30),
			contactoEmail: txt('contacto_email'),
			jefeUsuario: txt('jefe_usuario', 60),
			jefePassword: fd.get('jefe_password')?.toString() ?? '',
			modulos: fd.getAll('modulos').map(String),
			diasPrueba: Number(txt('dias_prueba', 3) || '15'),
			limiteUsuarios: limiteRaw ? Number(limiteRaw) : null
		};
		const { jefePassword: _omitida, ...valores } = datos;
		void _omitida;

		if (!datos.nombre || !datos.codigo || !datos.jefeUsuario) {
			return fail(400, { error: 'Nombre, código y usuario Jefe son obligatorios.', valores });
		}
		if (
			datos.limiteUsuarios !== null &&
			(!Number.isInteger(datos.limiteUsuarios) || datos.limiteUsuarios < 1)
		) {
			return fail(400, {
				error:
					'El límite de usuarios debe ser un número entero mayor que 0 (o vacío = sin límite).',
				valores
			});
		}

		let id: number;
		try {
			id = await crearRestaurante(locals.platformAdmin!.id, datos);
		} catch (e) {
			if (e instanceof ErrorNegocio) return fail(400, { error: e.message, valores });
			console.error('[plataforma] error al crear restaurante:', e);
			return fail(500, { error: 'No se pudo crear el restaurante.', valores });
		}
		redirect(303, `/plataforma/restaurantes/${id}?creado=1`);
	}
};
