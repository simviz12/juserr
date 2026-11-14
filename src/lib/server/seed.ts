/**
 * Reinicia UN restaurante con un catálogo inicial vacío (sin historia).
 *
 *   npm run db:seed -- --tenant <código> --confirmar
 *
 * Borra TODOS los datos de ese restaurante (turnos, bodega, usuarios...) y deja
 * un usuario Jefe "Gabo" con contraseña "password123". Nunca toca otros restaurantes.
 */
import { eq } from 'drizzle-orm';
import * as argon2 from '@node-rs/argon2';
import {
	usuarios,
	pizzaSabores,
	bebidas,
	categorias,
	productos,
	movimientosInventario,
	movimientosBebidas,
	pizzaRuedas,
	pizzaSobras,
	pizzaVentas,
	turnos,
	gastos,
	cierresDia,
	cortesSemanales,
	transaccionesTurno,
	cierresLinea,
	ventasItems,
	movimientosContables
} from './schema';
import { borrarSesionesDe, conectar, restauranteObjetivo } from './scripts/tenant-cli';

async function seed() {
	const db = conectar();
	const t = await restauranteObjetivo(db, { destructivo: true });
	const tid = t.id;
	console.log(`Reiniciando "${t.nombre}"...`);

	// Hijos antes que padres (FK)
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
		turnos,
		movimientosBebidas,
		movimientosInventario
	]) {
		await db.delete(tabla).where(eq(tabla.tenantId, tid));
	}
	await borrarSesionesDe(db, tid);
	await db.delete(productos).where(eq(productos.tenantId, tid));
	await db.delete(categorias).where(eq(categorias.tenantId, tid));
	await db.delete(bebidas).where(eq(bebidas.tenantId, tid));
	await db.delete(pizzaSabores).where(eq(pizzaSabores.tenantId, tid));
	await db.delete(usuarios).where(eq(usuarios.tenantId, tid));

	const defaultPassword = await argon2.hash('password123');
	await db.insert(usuarios).values([
		{ tenantId: tid, nombre: 'Gabo', rol: 'jefe', passwordHash: defaultPassword },
		{ tenantId: tid, nombre: 'Empleado 1', rol: 'empleado', passwordHash: defaultPassword }
	]);

	await db.insert(pizzaSabores).values([
		{ tenantId: tid, nombre: 'Hawaiana', precioPorcion: '4500', precioRueda: '35000' },
		{ tenantId: tid, nombre: 'Pepperoni', precioPorcion: '4000', precioRueda: '32000' },
		{ tenantId: tid, nombre: 'Margarita', precioPorcion: '3500', precioRueda: '28000' }
	]);

	await db.insert(bebidas).values([
		{ tenantId: tid, nombre: 'Coca Cola 400ml', precio: '3000', stockActual: 0 },
		{ tenantId: tid, nombre: 'Jugo de Mora', precio: '4000', stockActual: 0 },
		{ tenantId: tid, nombre: 'Agua Manantial', precio: '2500', stockActual: 0 }
	]);

	const cats = await db
		.insert(categorias)
		.values([
			{ tenantId: tid, nombre: 'Lácteos' },
			{ tenantId: tid, nombre: 'Cárnicos' },
			{ tenantId: tid, nombre: 'Vegetales' },
			{ tenantId: tid, nombre: 'Insumos Generales' }
		])
		.returning();

	await db.insert(productos).values([
		{
			tenantId: tid,
			nombre: 'Masas',
			categoriaId: cats[3].id,
			unidadMedida: 'unidad',
			stockActual: 0,
			precio: '0'
		},
		{
			tenantId: tid,
			nombre: 'Queso Mozzarella',
			categoriaId: cats[0].id,
			unidadMedida: 'fraccion',
			stockActual: 0,
			precio: '0'
		},
		{
			tenantId: tid,
			nombre: 'Pechuga de Pollo',
			categoriaId: cats[1].id,
			unidadMedida: 'pechuga',
			stockActual: 0,
			precio: '0'
		},
		{
			tenantId: tid,
			nombre: 'Piña',
			categoriaId: cats[2].id,
			unidadMedida: 'fraccion',
			stockActual: 0,
			precio: '0'
		}
	]);

	console.log(
		`Listo: "${t.nombre}" quedó con el catálogo inicial. Usuario Jefe: Gabo / password123 (cámbiala).`
	);
}

seed().catch((err) => {
	console.error(`✗ ${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
