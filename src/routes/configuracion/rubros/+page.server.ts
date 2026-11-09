import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { rubrosConfig, lineasGastronomicas, itemsLinea, productos, ventasItems } from '$lib/server/schema';
import { asc, count, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getBusinessConfig } from '$lib/features/business/server/config';
import { LINE_TOGGLES, isRubro } from '$lib/features/business/domain/lines';
import { ensureControlProducts, lineasActivas } from '$lib/features/shifts/server/lines';

const DEFAULT_LINES = [
	{ codigo: 'pizza', nombre: 'Pizzas y calzones', icono: 'Pizza', unidadPorcion: 'porción', precioPromedio: '7000' },
	{ codigo: 'chuzo', nombre: 'Chuzos y parrilla', icono: 'Flame', unidadPorcion: 'pincho', precioPromedio: '6000' },
	{ codigo: 'burger', nombre: 'Hamburguesas y combos', icono: 'Sandwich', unidadPorcion: 'combo', precioPromedio: '16000' },
	{ codigo: 'lasana', nombre: 'Lasañas al horno', icono: 'Layers', unidadPorcion: 'bandeja', precioPromedio: '18000' },
	{ codigo: 'carne', nombre: 'Carnes y asados', icono: 'Beef', unidadPorcion: 'libra', precioPromedio: '22000' }
];

export const load: PageServerLoad = async () => {
	let lineas = await db.select().from(lineasGastronomicas).orderBy(asc(lineasGastronomicas.id));
	if (lineas.length === 0) {
		await db.insert(lineasGastronomicas).values(DEFAULT_LINES).onConflictDoNothing();
		lineas = await db.select().from(lineasGastronomicas).orderBy(asc(lineasGastronomicas.id));
	}

	const config = await getBusinessConfig();
	// Cada línea activa (no pizza) necesita un insumo de control para el cierre por inventario
	await ensureControlProducts(lineasActivas(config));
	lineas = await db.select().from(lineasGastronomicas).orderBy(asc(lineasGastronomicas.id));

	const [items, insumos] = await Promise.all([
		db.select().from(itemsLinea).orderBy(asc(itemsLinea.nombre)),
		db
			.select({ id: productos.id, nombre: productos.nombre, unidad: productos.unidadMedida, stock: productos.stockActual })
			.from(productos)
			.orderBy(asc(productos.nombre))
	]);

	// Los interruptores de configuración son la fuente de verdad del estado de cada línea
	const activoPorCodigo = new Map(LINE_TOGGLES.map((t) => [t.codigo as string, Boolean(config[t.field] ?? true)]));
	return {
		config,
		lineas: lineas.map((l) => ({ ...l, activo: activoPorCodigo.get(l.codigo) ?? l.activo })),
		items,
		insumos
	};
};

function parseMoney(value: FormDataEntryValue | null): number | null {
	const n = parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseItemForm(formData: FormData) {
	const nombre = formData.get('nombre')?.toString().trim().slice(0, 120) ?? '';
	const precioVenta = parseMoney(formData.get('precio_venta'));
	const precioCosto = parseMoney(formData.get('precio_costo')) ?? 0;
	if (!nombre) return { error: 'El nombre del plato es obligatorio.' } as const;
	if (precioVenta === null || precioVenta <= 0) return { error: 'El precio de venta debe ser mayor a 0.' } as const;
	if (precioCosto > precioVenta) {
		return { error: 'El costo no puede ser mayor que el precio de venta (venderías a pérdida).' } as const;
	}
	const u = parseFloat(formData.get('unidades_control')?.toString() || '1');
	if (!Number.isFinite(u) || u <= 0 || u > 50) return { error: 'Las unidades por venta deben estar entre 0 y 50.' } as const;
	return { nombre, precioVenta, precioCosto, unidadesControl: u } as const;
}

export const actions: Actions = {
	/**
	 * Guarda la identidad del negocio Y aplica los interruptores:
	 *  - nombre → se muestra en el menú lateral, reportes PDF y reporte de WhatsApp.
	 *  - interruptores → activan/desactivan la línea en el catálogo; "Pizzas"
	 *    además muestra u oculta la conciliación de pizzas en el cierre de turno.
	 */
	actualizarRubros: async ({ request }) => {
		const formData = await request.formData();
		const nombreNegocio = formData.get('nombre_negocio')?.toString().trim().slice(0, 80) ?? '';
		const rubroPrincipal = formData.get('rubro_principal')?.toString() ?? 'mixto';

		if (!nombreNegocio) return fail(400, { error: 'El nombre del negocio es obligatorio.' });
		if (!isRubro(rubroPrincipal)) return fail(400, { error: 'Tipo de negocio inválido.' });

		const flags = Object.fromEntries(LINE_TOGGLES.map((t) => [t.field, formData.get(t.form) === 'on'])) as Record<
			(typeof LINE_TOGGLES)[number]['field'],
			boolean
		>;
		if (!Object.values(flags).some(Boolean)) {
			return fail(400, { error: 'Debes dejar al menos una línea activa.' });
		}

		const values = { nombreNegocio, rubroPrincipal, ...flags };
		const [existe] = await db.select({ id: rubrosConfig.id }).from(rubrosConfig).limit(1);

		await db.batch([
			existe
				? db.update(rubrosConfig).set(values).where(eq(rubrosConfig.id, existe.id))
				: db.insert(rubrosConfig).values(values),
			...LINE_TOGGLES.map((t) =>
				db.update(lineasGastronomicas).set({ activo: flags[t.field] }).where(eq(lineasGastronomicas.codigo, t.codigo))
			)
		]);

		await ensureControlProducts(LINE_TOGGLES.filter((t) => t.codigo !== 'pizza' && flags[t.field]).map((t) => t.codigo));
		const activas = LINE_TOGGLES.filter((t) => flags[t.field]).map((t) => t.label);
		return { success: true, message: `Ajustes guardados. Líneas activas: ${activas.join(', ')}.` };
	},

	crearItem: async ({ request }) => {
		const formData = await request.formData();
		const lineaId = parseInt(formData.get('linea_id')?.toString() ?? '', 10);
		if (!Number.isFinite(lineaId)) return fail(400, { error: 'Línea inválida.' });

		const parsed = parseItemForm(formData);
		if ('error' in parsed) return fail(400, { error: parsed.error });

		await db.insert(itemsLinea).values({
			lineaId,
			nombre: parsed.nombre,
			precioVenta: parsed.precioVenta.toString(),
			precioCosto: parsed.precioCosto.toString(),
			unidadesControl: parsed.unidadesControl
		});
		return { success: true, message: `"${parsed.nombre}" agregado al menú.` };
	},

	actualizarItem: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		if (!Number.isFinite(id)) return fail(400, { error: 'Plato inválido.' });

		const parsed = parseItemForm(formData);
		if ('error' in parsed) return fail(400, { error: parsed.error });

		await db
			.update(itemsLinea)
			.set({ nombre: parsed.nombre, precioVenta: parsed.precioVenta.toString(), precioCosto: parsed.precioCosto.toString(), unidadesControl: parsed.unidadesControl })
			.where(eq(itemsLinea.id, id));
		return { success: true, message: `"${parsed.nombre}" actualizado.` };
	},

	toggleItem: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		if (!Number.isFinite(id)) return fail(400, { error: 'Plato inválido.' });
		const [item] = await db.select().from(itemsLinea).where(eq(itemsLinea.id, id));
		if (!item) return fail(404, { error: 'El plato no existe.' });
		await db.update(itemsLinea).set({ activo: !item.activo }).where(eq(itemsLinea.id, id));
		return { success: true, message: `"${item.nombre}" ${item.activo ? 'pausado' : 'reactivado'}.` };
	},

	/** Cambia el insumo que se cuenta en el cierre para controlar una línea. */
	actualizarControl: async ({ request }) => {
		const fd = await request.formData();
		const lineaId = Number(fd.get('linea_id'));
		const productoId = Number(fd.get('producto_control_id'));
		if (!lineaId || !productoId) return fail(400, { error: 'Selecciona un insumo.' });
		const [p] = await db.select({ nombre: productos.nombre }).from(productos).where(eq(productos.id, productoId));
		if (!p) return fail(404, { error: 'El insumo no existe.' });
		await db.update(lineasGastronomicas).set({ productoControlId: productoId }).where(eq(lineasGastronomicas.id, lineaId));
		return { success: true, message: `Ahora el cierre de turno contará "${p.nombre}" para esta línea.` };
	},

	eliminarItem: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		if (!Number.isFinite(id)) return fail(400, { error: 'Plato inválido.' });
		const [{ n }] = await db.select({ n: count() }).from(ventasItems).where(eq(ventasItems.itemId, id));
		if (n > 0) return fail(409, { error: 'Este plato tiene ventas registradas en cierres de turno; páusalo en lugar de eliminarlo.' });
		const [item] = await db.delete(itemsLinea).where(eq(itemsLinea.id, id)).returning({ nombre: itemsLinea.nombre });
		return { success: true, message: item ? `"${item.nombre}" eliminado.` : 'Plato eliminado.' };
	}
};
