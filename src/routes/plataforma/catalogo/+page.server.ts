import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { actualizarCatalogo, catalogo, ErrorNegocio } from '$lib/billing/server';
import { parseMoneyInput } from '$lib/features/finance/domain/money';

export const load: PageServerLoad = async () => ({ modulos: await catalogo() });

export const actions: Actions = {
	guardar: async ({ request, locals }) => {
		const fd = await request.formData();
		const codigo = fd.get('codigo')?.toString() ?? '';
		const cents = parseMoneyInput(fd.get('precio')?.toString() ?? '');
		if (cents === null) return fail(400, { error: 'El precio no es válido.' });
		try {
			await actualizarCatalogo(locals.platformAdmin!.id, codigo, {
				precioMensualCents: cents,
				publico: fd.get('publico') === 'on',
				descripcion: fd.get('descripcion')?.toString().trim().slice(0, 300) ?? ''
			});
			return {
				success: true,
				message:
					'Catálogo actualizado. Aplica a clientes nuevos; los actuales conservan su precio pactado.'
			};
		} catch (e) {
			if (e instanceof ErrorNegocio) return fail(400, { error: e.message });
			throw e;
		}
	}
};
