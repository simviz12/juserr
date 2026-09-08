import { db } from '$lib/server/db';
import { productos, movimientosInventario } from '$lib/server/schema';
import { eq, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/');
    }

    const allProducts = await db.select().from(productos);
    
    let masaProduct = allProducts.find(p => p.nombre === 'Masas');
    if (!masaProduct) {
        const [nuevo] = await db.insert(productos).values({
            nombre: 'Masas',
            unidadMedida: 'unidad',
            stockActual: 0,
            precio: '0'
        }).returning();
        masaProduct = nuevo;
        allProducts.push(nuevo);
    }

    // Movimientos recientes con nombre de producto
    const historialMovimientos = await db.select({
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
    .limit(20);

    return { 
        stockMasas: masaProduct.stockActual || 0,
        productos: allProducts,
        historialMovimientos
    };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const tipoOperacion = formData.get('tipo_operacion')?.toString() || 'entrada';
        const productoIdStr = formData.get('tipo_insumo')?.toString();
        const productoId = parseInt(productoIdStr || '0');
        const cantidadStr = formData.get('cantidad')?.toString();
        const cantidad = parseFloat(cantidadStr || '0');
        const precioTotalStr = formData.get('precioTotalCompra')?.toString();
        const precioTotal = isNaN(parseFloat(precioTotalStr || "0")) ? 0 : parseFloat(precioTotalStr || "0");

        if (isNaN(cantidad) || cantidad < 0) {
            return fail(400, { error: 'Cantidad inválida.' });
        }
        if (isNaN(productoId) || productoId <= 0) {
            return fail(400, { error: 'Producto no válido.' });
        }

        const costoUnitario = (cantidad > 0 && tipoOperacion === 'entrada') ? precioTotal / cantidad : 0;

        try {
            let [targetProduct] = await db.select().from(productos).where(eq(productos.id, productoId));
            
            if (!targetProduct) {
                throw new Error("Producto no encontrado.");
            }

            const stockActual = targetProduct.stockActual || 0;
            const precioCostoAnterior = parseFloat(targetProduct.precioCosto?.toString() || '0');
            
            let nuevoStock = 0;
            let cantidadMovimiento = 0;

            if (tipoOperacion === 'entrada') {
                nuevoStock = stockActual + cantidad;
                cantidadMovimiento = cantidad;
            } else {
                // Ajuste físico
                nuevoStock = cantidad;
                cantidadMovimiento = nuevoStock - stockActual; // Puede ser negativo si hay mermas/ventas no registradas
            }

            // Calcular nuevo costo promedio ponderado SOLO si es entrada con compras
            let nuevoPrecioCosto = precioCostoAnterior;
            if (tipoOperacion === 'entrada' && nuevoStock > 0 && precioTotal > 0) {
                const valorInventarioAnterior = stockActual * precioCostoAnterior;
                nuevoPrecioCosto = (valorInventarioAnterior + precioTotal) / nuevoStock;
            }

            // Actualizar stock y costo
            await db.update(productos)
                .set({ 
                    stockActual: nuevoStock,
                    precioCosto: nuevoPrecioCosto.toString()
                })
                .where(eq(productos.id, targetProduct.id));

            // Registrar movimiento
            await db.insert(movimientosInventario).values({
                productoId: targetProduct.id,
                usuarioId: locals.user.id,
                tipo: tipoOperacion === 'entrada' ? 'entrada' : 'ajuste',
                cantidad: cantidadMovimiento, // Registro contable
                costoTotal: tipoOperacion === 'entrada' ? precioTotal.toString() : '0',
                costoUnitario: tipoOperacion === 'entrada' ? costoUnitario.toString() : '0'
            });

            const costoMsg = (tipoOperacion === 'entrada' && precioTotal > 0)
                ? ` | Costo total: $${precioTotal.toLocaleString('es-CO')} | Promedio: $${nuevoPrecioCosto.toLocaleString('es-CO', { maximumFractionDigits: 2 })} / ${targetProduct.unidadMedida}`
                : '';
            
            const accionVisual = tipoOperacion === 'entrada' ? `Se ingresaron ${cantidad}` : `Conteo final actualizado a ${cantidad}`;
            
            return { success: true, message: `${accionVisual} ${targetProduct.nombre}. Nuevo stock: ${nuevoStock}.${costoMsg}` };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al actualizar el inventario.' });
        }
    }
};

