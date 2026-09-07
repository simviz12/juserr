import { db } from './db';
import { turnos, pizzaVentas } from './schema';
import { desc } from 'drizzle-orm';
import { config } from 'dotenv';
config();

async function run() {
    console.log("--- RECENT TURNOS ---");
    const t = await db.select().from(turnos).orderBy(desc(turnos.fecha)).limit(5);
    console.log(t);

    console.log("--- RECENT PIZZA VENTAS ---");
    const pv = await db.select().from(pizzaVentas).orderBy(desc(pizzaVentas.fecha)).limit(5);
    console.log(pv);
    process.exit(0);
}
run();
