import { db } from '$lib/server/db';
import { productos, movimientosInventario, gastos } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { parseFraction } from '$lib/utils/fractions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const inv = await db.select().from(productos).orderBy(productos.nombre);
    return { inventory: inv };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const productoId = Number(formData.get('productoId'));
        const cantidadStr = formData.get('cantidad')?.toString().trim() || '0';
        const costoStr = formData.get('costo')?.toString();
        
        let cantidad = parseFraction(cantidadStr);

        const costo = parseFloat(costoStr || '0');

        if (!productoId || isNaN(cantidad) || cantidad <= 0) {
            return fail(400, { error: 'Debes seleccionar un producto e ingresar una cantidad válida.' });
        }

        if (isNaN(costo) || costo < 0) {
            return fail(400, { error: 'El costo debe ser un valor válido.' });
        }

        try {
            const [prod] = await db.select().from(productos).where(eq(productos.id, productoId));
            if (!prod) return fail(400, { error: 'Producto no encontrado.' });

            const nuevoStock = (prod.stockActual || 0) + cantidad;

            // 1. Actualizar Stock y Precio Unitario (si hay costo)
            const updateData: any = { stockActual: nuevoStock };
            if (costo > 0 && cantidad > 0) {
                const nuevoPrecioUnitario = (costo / cantidad).toFixed(2);
                updateData.precio = nuevoPrecioUnitario.toString();
            }

            await db.update(productos)
                .set(updateData)
                .where(eq(productos.id, productoId));

            // 2. Registrar Movimiento
            await db.insert(movimientosInventario).values({
                productoId: productoId,
                usuarioId: locals.user.id,
                tipo: 'entrada',
                cantidad: cantidad
            });

            // 3. Registrar Gasto Financiero (Si aplica costo)
            if (costo > 0) {
                await db.insert(gastos).values({
                    descripcion: `Compra de inventario: ${cantidad} ${prod.unidadMedida}s de ${prod.nombre}`,
                    monto: costo.toString()
                });
            }

            return { success: true, message: `Has ingresado ${cantidad} ${prod.unidadMedida}s de ${prod.nombre}. Stock actual: ${nuevoStock}.` + (costo > 0 ? ` Se registró un gasto de $${costo}.` : '') };
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al registrar la compra.' });
        }
    }
};
