import { db } from '$lib/server/db';
import { productos, movimientosInventario, categorias } from '$lib/server/schema';
import { desc, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    // 1. Obtener todos los productos con su categoría
    const inv = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            unidadMedida: productos.unidadMedida,
            stockActual: productos.stockActual,
            stockMinimo: productos.stockMinimo,
            precio: productos.precio,
            categoria: categorias.nombre
        })
        .from(productos)
        .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
        .orderBy(productos.nombre);

    // 2. Calcular KPIs del inventario
    let valorTotalInventario = 0;
    inv.forEach(p => {
        valorTotalInventario += (p.stockActual || 0) * Number(p.precio || 0);
    });

    // 3. Obtener últimos movimientos (entradas y salidas) para mostrar actividad reciente
    const ultimosMovimientos = await db
        .select({
            producto: productos.nombre,
            tipo: movimientosInventario.tipo,
            cantidad: movimientosInventario.cantidad,
            fecha: movimientosInventario.fecha,
            unidad: productos.unidadMedida
        })
        .from(movimientosInventario)
        .innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
        .orderBy(desc(movimientosInventario.fecha))
        .limit(6);

    return { 
        inventory: inv,
        kpis: {
            totalProductos: inv.length,
            valorTotalInventario
        },
        movimientos: ultimosMovimientos
    };
};
