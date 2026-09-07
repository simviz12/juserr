import { db } from '$lib/server/db';
import { turnos, gastos, pizzaVentas } from '$lib/server/schema';
import { json } from '@sveltejs/kit';

export const GET = async () => {
    const t = await db.select().from(turnos);
    const g = await db.select().from(gastos);
    const pv = await db.select().from(pizzaVentas);
    return json({ turnos: t, gastos: g, pizzaVentas: pv });
};
