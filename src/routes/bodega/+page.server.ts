import { db } from '$lib/server/db';
import { productos, movimientosInventario, categorias } from '$lib/server/schema';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseFraction } from '$lib/utils/fractions';

const MASA_NAMES = ['Masa', 'Masas'];

export const load: PageServerLoad = async () => {
	// El cierre de turno necesita el producto "Masa"; se crea solo si no existe.
	// (Antes también se re-creaban bebidas de ejemplo en cada visita.)
	const [masa] = await db.select({ id: productos.id }).from(productos).where(inArray(productos.nombre, MASA_NAMES)).limit(1);
	if (!masa) {
		await db.insert(productos).values({ nombre: 'Masa', unidadMedida: 'unidad', stockActual: 0, precio: '0' });
	}

	const [lista, cats, historial] = await Promise.all([
		db.select().from(productos).orderBy(asc(productos.nombre)),
		db.select().from(categorias),
		db
			.select({
				id: movimientosInventario.id,
				productoNombre: productos.nombre,
				unidadMedida: productos.unidadMedida,
				tipo: movimientosInventario.tipo,
				cantidad: movimientosInventario.cantidad,
				costoUnitario: movimientosInventario.costoUnitario,
				costoTotal: movimientosInventario.costoTotal,
				fecha: movimientosInventario.fecha
			})
			.from(movimientosInventario)
			.innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
			.orderBy(desc(movimientosInventario.fecha))
			.limit(1000)
	]);

	const catName = new Map(cats.map((c) => [c.id, c.nombre]));
	return {
		productos: lista.map((p) => ({ ...p, categoria: p.categoriaId ? (catName.get(p.categoriaId) ?? null) : null })),
		historialMovimientos: historial.map((m) => ({ ...m, fecha: m.fecha ? m.fecha.toISOString() : null }))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'No autorizado' });

		const formData = await request.formData();
		const tipo = formData.get('tipo_operacion')?.toString() === 'ajuste' ? 'ajuste' : 'entrada';
		const productoId = parseInt(formData.get('tipo_insumo')?.toString() ?? '', 10);
		const cantidad = parseFraction(formData.get('cantidad')?.toString() ?? '');
		const precioRaw = parseFloat(formData.get('precioTotalCompra')?.toString() ?? '0');
		const precioTotal = Number.isFinite(precioRaw) && precioRaw > 0 ? precioRaw : 0;

		if (!Number.isFinite(productoId) || productoId <= 0) return fail(400, { error: 'Selecciona un insumo.' });
		if (!Number.isFinite(cantidad) || cantidad < 0) {
			return fail(400, { error: 'Cantidad inválida. Usa un número o fracción (ej: 6 1/4, 2 1/2, 3/4).' });
		}
		if (tipo === 'entrada' && cantidad === 0) return fail(400, { error: 'La cantidad comprada debe ser mayor a 0.' });

		const [p] = await db.select().from(productos).where(eq(productos.id, productoId));
		if (!p) return fail(404, { error: 'El insumo no existe.' });

		const stockActual = p.stockActual ?? 0;
		const costoAnterior = Number(p.precioCosto ?? 0);
		const nuevoStock = tipo === 'entrada' ? stockActual + cantidad : cantidad;
		const movimiento = nuevoStock - stockActual;

		// Costo promedio ponderado solo cambia con compras valorizadas
		const nuevoCosto =
			tipo === 'entrada' && nuevoStock > 0 && precioTotal > 0
				? (stockActual * costoAnterior + precioTotal) / nuevoStock
				: costoAnterior;

		try {
			// Atómico: stock y movimiento se guardan juntos o ninguno
			await db.batch([
				db.update(productos).set({ stockActual: nuevoStock, precioCosto: nuevoCosto.toFixed(2) }).where(eq(productos.id, p.id)),
				db.insert(movimientosInventario).values({
					productoId: p.id,
					usuarioId: locals.user.id,
					tipo,
					cantidad: movimiento,
					costoTotal: tipo === 'entrada' ? precioTotal.toString() : '0',
					costoUnitario: tipo === 'entrada' && cantidad > 0 ? (precioTotal / cantidad).toFixed(2) : '0'
				})
			]);
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Error interno al actualizar el inventario.' });
		}

		const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
		return {
			success: true,
			message:
				tipo === 'entrada'
					? `Compra registrada: +${fmt(cantidad)} ${p.unidadMedida} de ${p.nombre}. Stock: ${fmt(nuevoStock)}.`
					: `Conteo guardado: ${p.nombre} queda en ${fmt(nuevoStock)} ${p.unidadMedida} (${movimiento >= 0 ? '+' : ''}${fmt(movimiento)}).`
		};
	}
};
