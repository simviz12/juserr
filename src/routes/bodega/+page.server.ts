import { db } from '$lib/server/db';
import { productos, movimientosInventario, categorias } from '$lib/server/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { protegerAcciones } from '$lib/server/actions';
import { parseFraction } from '$lib/utils/fractions';
import { delTenant, tenantDe } from '$lib/server/tenancy';
import { asegurarMasa } from '$lib/features/shifts/server/products';
import { log } from '$lib/server/log';

/** Topes por registro (protegen de ceros de más al digitar). */
const CANTIDAD_MAXIMA = 1_000_000;
const PRECIO_MAXIMO = 10_000_000_000;

export const load: PageServerLoad = async ({ locals }) => {
	const tid = tenantDe(locals);

	// El cierre de turno necesita el producto "Masa"; se crea solo si no existe.
	await asegurarMasa(tid);

	const [lista, cats, historial] = await Promise.all([
		db.select().from(productos).where(delTenant(productos, tid)).orderBy(asc(productos.nombre)),
		db.select().from(categorias).where(delTenant(categorias, tid)),
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
			.innerJoin(
				productos,
				and(eq(movimientosInventario.productoId, productos.id), eq(productos.tenantId, tid))
			)
			.where(delTenant(movimientosInventario, tid))
			.orderBy(desc(movimientosInventario.fecha))
			.limit(1000)
	]);

	const catName = new Map(cats.map((c) => [c.id, c.nombre]));
	return {
		productos: lista.map((p) => ({
			...p,
			categoria: p.categoriaId ? (catName.get(p.categoriaId) ?? null) : null
		})),
		historialMovimientos: historial.map((m) => ({
			...m,
			fecha: m.fecha ? m.fecha.toISOString() : null
		}))
	};
};

export const actions: Actions = protegerAcciones('bodega', {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'No autorizado' });
		const tid = tenantDe(locals);

		const formData = await request.formData();
		const tipo = formData.get('tipo_operacion')?.toString() === 'ajuste' ? 'ajuste' : 'entrada';
		const productoId = parseInt(formData.get('tipo_insumo')?.toString() ?? '', 10);
		const cantidad = parseFraction(formData.get('cantidad')?.toString() ?? '');
		const precioRaw = parseFloat(formData.get('precioTotalCompra')?.toString() ?? '0');
		const precioTotal = Number.isFinite(precioRaw) && precioRaw > 0 ? precioRaw : 0;
		if (precioTotal > PRECIO_MAXIMO)
			return fail(400, { error: 'El precio de la compra no es válido.' });

		if (!Number.isFinite(productoId) || productoId <= 0)
			return fail(400, { error: 'Selecciona un insumo.' });
		if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > CANTIDAD_MAXIMA) {
			return fail(400, {
				error: 'Cantidad inválida. Usa un número o fracción (ej: 6 1/4, 2 1/2, 3/4).'
			});
		}
		if (tipo === 'entrada' && cantidad === 0)
			return fail(400, { error: 'La cantidad comprada debe ser mayor a 0.' });

		const [p] = await db
			.select({ id: productos.id, nombre: productos.nombre, unidadMedida: productos.unidadMedida })
			.from(productos)
			.where(delTenant(productos, tid, eq(productos.id, productoId)));
		if (!p) return fail(404, { error: 'El insumo no existe.' });

		const entrada = tipo === 'entrada';
		const costoUnitario = entrada && cantidad > 0 ? (precioTotal / cantidad).toFixed(2) : '0';
		let nuevoStock: number;
		let movimiento: number;
		try {
			// UNA sentencia: bloquea la fila, calcula sobre el stock vigente en ese
			// instante y registra el movimiento. Antes se leía el stock, se sumaba en
			// JS y se escribía el total: dos compras (o una compra y un cierre de
			// turno) simultáneas se pisaban y una se perdía.
			const r = await db.execute<{ nuevo: string; anterior: string }>(sql`
				WITH antes AS (
					SELECT id, coalesce(stock_actual, 0) AS stock, coalesce(precio_costo, 0) AS costo
					FROM productos WHERE tenant_id = ${tid} AND id = ${p.id} FOR UPDATE
				), upd AS (
					UPDATE productos AS pr SET
						stock_actual = CASE WHEN ${entrada} THEN antes.stock + ${cantidad}::numeric ELSE ${cantidad}::numeric END,
						precio_costo = CASE
							WHEN ${entrada} AND ${precioTotal}::numeric > 0 AND antes.stock + ${cantidad}::numeric > 0
								THEN round((antes.stock * antes.costo + ${precioTotal}::numeric) / (antes.stock + ${cantidad}::numeric), 2)
							ELSE antes.costo END
					FROM antes WHERE pr.id = antes.id
					RETURNING pr.stock_actual AS nuevo, antes.stock AS anterior
				), mov AS (
					INSERT INTO movimientos_inventario
						(tenant_id, producto_id, usuario_id, tipo, cantidad, costo_total, costo_unitario)
					SELECT ${tid}, ${p.id}, ${locals.user.id}, ${tipo}, upd.nuevo - upd.anterior,
						${entrada ? precioTotal.toString() : '0'}::numeric, ${costoUnitario}::numeric
					FROM upd
				)
				SELECT nuevo, anterior FROM upd`);
			const fila = r.rows[0];
			if (!fila) return fail(404, { error: 'El insumo no existe.' });
			nuevoStock = Number(fila.nuevo);
			movimiento = nuevoStock - Number(fila.anterior);
		} catch (err) {
			log.error('error al actualizar inventario', { tenantId: tid, productoId: p.id, err });
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
});
