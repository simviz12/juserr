import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pizzaSabores, pizzaVentas } from '$lib/server/schema';
import { asc, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const sabores = await db
		.select({
			id: pizzaSabores.id,
			nombre: pizzaSabores.nombre,
			precioPorcion: pizzaSabores.precioPorcion,
			precioRueda: pizzaSabores.precioRueda,
			activo: pizzaSabores.activo,
			vendidas: sql<string>`COALESCE((SELECT SUM(${pizzaVentas.cantidadVendida}) FROM ${pizzaVentas} WHERE ${pizzaVentas.saborId} = ${pizzaSabores.id}), 0)`
		})
		.from(pizzaSabores)
		.orderBy(asc(pizzaSabores.nombre));
	return { sabores: sabores.map((s) => ({ ...s, vendidas: Number(s.vendidas) })) };
};

function parse(fd: FormData) {
	const nombre = fd.get('nombre')?.toString().trim().slice(0, 60) ?? '';
	const precioPorcion = parseFloat(fd.get('precioPorcion')?.toString() ?? '');
	const precioRuedaRaw = parseFloat(fd.get('precioRueda')?.toString() ?? '');
	if (!nombre) return { error: 'El nombre es obligatorio.' } as const;
	if (!Number.isFinite(precioPorcion) || precioPorcion <= 0) return { error: 'El precio por porción debe ser mayor a 0.' } as const;
	const precioRueda = Number.isFinite(precioRuedaRaw) && precioRuedaRaw > 0 ? precioRuedaRaw : precioPorcion * 8;
	return { nombre, precioPorcion: precioPorcion.toString(), precioRueda: precioRueda.toString() } as const;
}

export const actions: Actions = {
	create: async ({ request }) => {
		const p = parse(await request.formData());
		if ('error' in p) return fail(400, { error: p.error });
		await db.insert(pizzaSabores).values({ ...p, activo: true });
		return { success: true, message: `Sabor "${p.nombre}" agregado.` };
	},
	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const p = parse(fd);
		if (!id) return fail(400, { error: 'Sabor inválido.' });
		if ('error' in p) return fail(400, { error: p.error });
		await db.update(pizzaSabores).set(p).where(eq(pizzaSabores.id, id));
		return { success: true, message: `Sabor "${p.nombre}" actualizado.` };
	},
	toggle: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Sabor inválido.' });
		const [s] = await db.select().from(pizzaSabores).where(eq(pizzaSabores.id, id));
		if (!s) return fail(404, { error: 'El sabor no existe.' });
		await db.update(pizzaSabores).set({ activo: !s.activo }).where(eq(pizzaSabores.id, id));
		return { success: true, message: `"${s.nombre}" ${s.activo ? 'desactivado' : 'activado'}.` };
	},
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Sabor inválido.' });
		try {
			await db.delete(pizzaSabores).where(eq(pizzaSabores.id, id));
			return { success: true, message: 'Sabor eliminado.' };
		} catch {
			return fail(409, { error: 'Este sabor tiene ventas registradas; desactívalo en lugar de eliminarlo.' });
		}
	}
};
