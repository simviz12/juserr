import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { rubrosConfig, lineasGastronomicas, itemsLinea } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
    // 1. Obtener o inicializar configuración del negocio
    let [config] = await db.select().from(rubrosConfig).limit(1);
    if (!config) {
        const [nuevo] = await db.insert(rubrosConfig).values({
            nombreNegocio: 'ChuzoOS GastroFlow Gourmet',
            rubroPrincipal: 'mixto',
            habilitarPizzas: true,
            habilitarChuzos: true,
            habilitarHamburguesas: true,
            habilitarLasanas: true,
            habilitarCarnes: true
        }).returning();
        config = nuevo;
    }

    // 2. Obtener o inicializar las líneas gastronómicas disponibles
    let lineas = await db.select().from(lineasGastronomicas);
    if (lineas.length === 0) {
        await db.insert(lineasGastronomicas).values([
            { codigo: 'chuzo', nombre: 'Parrilla & Chuzos', icono: 'Flame', unidadPorcion: 'pincho', precioPromedio: '6000' },
            { codigo: 'pizza', nombre: 'Pizzas & Calzones', icono: 'Pizza', unidadPorcion: 'porcion', precioPromedio: '7000' },
            { codigo: 'burger', nombre: 'Hamburguesas & Combos', icono: 'UtensilsCrossed', unidadPorcion: 'combo', precioPromedio: '16000' },
            { codigo: 'lasana', nombre: 'Lasañas al Horno', icono: 'Layers', unidadPorcion: 'bandeja', precioPromedio: '18000' },
            { codigo: 'carne', nombre: 'Cortes & Asados', icono: 'Beef', unidadPorcion: 'libra', precioPromedio: '22000' }
        ]);
        lineas = await db.select().from(lineasGastronomicas);
    }

    // 3. Obtener items por línea
    const items = await db.select().from(itemsLinea);

    return {
        config,
        lineas,
        items
    };
};

export const actions: Actions = {
    actualizarRubros: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const nombreNegocio = formData.get('nombre_negocio')?.toString() || 'ChuzoOS Gourmet';
        const rubroPrincipal = formData.get('rubro_principal')?.toString() || 'mixto';

        const habilitarPizzas = formData.get('habilitar_pizzas') === 'on';
        const habilitarChuzos = formData.get('habilitar_chuzos') === 'on';
        const habilitarHamburguesas = formData.get('habilitar_hamburguesas') === 'on';
        const habilitarLasanas = formData.get('habilitar_lasanas') === 'on';
        const habilitarCarnes = formData.get('habilitar_carnes') === 'on';

        const [existe] = await db.select().from(rubrosConfig).limit(1);
        if (existe) {
            await db.update(rubrosConfig)
                .set({
                    nombreNegocio,
                    rubroPrincipal,
                    habilitarPizzas,
                    habilitarChuzos,
                    habilitarHamburguesas,
                    habilitarLasanas,
                    habilitarCarnes
                })
                .where(eq(rubrosConfig.id, existe.id));
        } else {
            await db.insert(rubrosConfig).values({
                nombreNegocio,
                rubroPrincipal,
                habilitarPizzas,
                habilitarChuzos,
                habilitarHamburguesas,
                habilitarLasanas,
                habilitarCarnes
            });
        }

        return { success: true, message: 'Configuración multi-rubro guardada exitosamente.' };
    },

    crearItem: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const lineaId = parseInt(formData.get('linea_id')?.toString() || '0');
        const nombre = formData.get('nombre')?.toString().trim() || '';
        const precioVenta = formData.get('precio_venta')?.toString() || '0';
        const precioCosto = formData.get('precio_costo')?.toString() || '0';

        if (!lineaId || !nombre) {
            return fail(400, { error: 'Todos los campos son obligatorios.' });
        }

        await db.insert(itemsLinea).values({
            lineaId,
            nombre,
            precioVenta,
            precioCosto
        });

        return { success: true, message: `Producto "${nombre}" agregado a la línea.` };
    }
};
