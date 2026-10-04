import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { productos, bebidas, turnos, transaccionesTurno, pizzaVentas, pizzaSobras, pizzaRuedas, movimientosInventario, movimientosBebidas, gastos, cierresDia, cortesSemanales } from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está configurada en .env');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function resetStockAndCounts() {
  console.log('--- Reiniciando cantidades de inventario, turnos e historial ---');

  // 1. Eliminar históricos de turnos, cierres y movimientos
  await db.delete(cortesSemanales);
  await db.delete(cierresDia);
  await db.delete(transaccionesTurno);
  await db.delete(gastos);
  await db.delete(pizzaVentas);
  await db.delete(pizzaSobras);
  await db.delete(pizzaRuedas);
  await db.delete(movimientosInventario);
  await db.delete(movimientosBebidas);
  await db.delete(turnos);

  // 2. Reiniciar el stock de todos los productos de insumo (incluyendo Masas) a 0
  await db.update(productos).set({
    stockActual: 0,
    precioCosto: '0'
  });

  // 3. Reiniciar el stock de bebidas a 0
  await db.update(bebidas).set({
    stockActual: 0
  });

  console.log('✅ Base de datos reiniciada con éxito: Todas las cantidades y stocks están en 0.');
}

resetStockAndCounts().catch((err) => {
  console.error('Error al resetear cantidades:', err);
  process.exit(1);
});
