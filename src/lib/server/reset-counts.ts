/**
 * Deja en cero el historial y los inventarios de UN restaurante (conserva su
 * catálogo, usuarios y configuración). Útil para arrancar operación real tras
 * una capacitación con datos de prueba.
 *
 *   npm run db:reset-counts -- --tenant <código> --confirmar
 */
import { eq } from 'drizzle-orm';
import {
	productos,
	bebidas,
	turnos,
	transaccionesTurno,
	pizzaVentas,
	pizzaSobras,
	pizzaRuedas,
	movimientosInventario,
	movimientosBebidas,
	gastos,
	cierresDia,
	cortesSemanales,
	cierresLinea,
	ventasItems,
	movimientosContables
} from './schema';
import { conectar, restauranteObjetivo } from './scripts/tenant-cli';

async function resetStockAndCounts() {
	const db = conectar();
	const t = await restauranteObjetivo(db, { destructivo: true });
	const tid = t.id;
	console.log(`--- Reiniciando historial e inventario de "${t.nombre}" ---`);

	for (const tabla of [
		movimientosContables,
		ventasItems,
		cierresLinea,
		cortesSemanales,
		cierresDia,
		transaccionesTurno,
		gastos,
		pizzaVentas,
		pizzaSobras,
		pizzaRuedas,
		movimientosInventario,
		movimientosBebidas,
		turnos
	]) {
		await db.delete(tabla).where(eq(tabla.tenantId, tid));
	}

	await db
		.update(productos)
		.set({ stockActual: 0, precioCosto: '0' })
		.where(eq(productos.tenantId, tid));
	await db.update(bebidas).set({ stockActual: 0 }).where(eq(bebidas.tenantId, tid));

	console.log(`✅ "${t.nombre}" quedó con historial vacío y stocks en 0.`);
}

resetStockAndCounts().catch((err) => {
	console.error(`✗ ${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
