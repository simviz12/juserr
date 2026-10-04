import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { productos, bebidas } from '$lib/server/schema';
import { lte, sql } from 'drizzle-orm';

export const load: LayoutServerLoad = async (event) => {
    let alertas: { id: string; tipo: 'insumo' | 'bebida' | 'aviso'; titulo: string; detalle: string; nivel: 'urgente' | 'aviso' }[] = [];

    if (event.locals.user) {
        try {
            const [insumosBajos, bebidasAgotadas] = await Promise.all([
                db.select()
                  .from(productos)
                  .where(lte(productos.stockActual, productos.stockMinimo))
                  .limit(10),
                db.select()
                  .from(bebidas)
                  .where(lte(bebidas.stockActual, 2))
                  .limit(10)
            ]);

            for (const item of insumosBajos) {
                const stock = item.stockActual || 0;
                alertas.push({
                    id: `insumo-${item.id}`,
                    tipo: 'insumo',
                    titulo: item.nombre,
                    detalle: stock <= 0 
                        ? `Agotado completamente (0 ${item.unidadMedida})` 
                        : `Stock bajo: Quedan ${stock} ${item.unidadMedida} (mínimo ${item.stockMinimo})`,
                    nivel: stock <= 0 ? 'urgente' : 'aviso'
                });
            }

            for (const b of bebidasAgotadas) {
                const stock = b.stockActual || 0;
                alertas.push({
                    id: `bebida-${b.id}`,
                    tipo: 'bebida',
                    titulo: `Bebida: ${b.nombre}`,
                    detalle: stock <= 0 ? 'Sin stock disponible en refrigerador' : `Solo quedan ${stock} unidades`,
                    nivel: stock <= 0 ? 'urgente' : 'aviso'
                });
            }
        } catch (e) {
            console.error('Error cargando alertas de layout:', e);
        }
    }

    return {
        user: event.locals.user,
        alertas
    };
};
