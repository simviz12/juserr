import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { exigirAdminPlataforma } from '$lib/server/guards';
import { actualizarCatalogo, catalogo, ErrorNegocio } from '$lib/billing/server';
import { parseMoneyInput } from '$lib/features/finance/domain/money';
import { db } from '$lib/server/db';
import { tenants } from '$lib/server/schema';

export const load: PageServerLoad = async ({ locals }) => {
	exigirAdminPlataforma(locals);
	const [mods, ts] = await Promise.all([
		catalogo(),
		db.select({ id: tenants.id, nombre: tenants.nombre }).from(tenants)
	]);
	const nombre = new Map(ts.map((t) => [t.id, t.nombre]));
	return {
		modulos: mods.map((m) => ({
			...m,
			exclusivoDe: m.exclusivoTenantId ? (nombre.get(m.exclusivoTenantId) ?? '—') : null
		}))
	};
};

export const actions: Actions = {
	guardar: async ({ request, locals }) => {
		const admin = exigirAdminPlataforma(locals);
		const fd = await request.formData();
		const codigo = fd.get('codigo')?.toString() ?? '';
		const cents = parseMoneyInput(fd.get('precio')?.toString() ?? '');
		if (cents === null) return fail(400, { error: 'El precio no es válido.' });
		try {
			await actualizarCatalogo(admin.id, codigo, {
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
