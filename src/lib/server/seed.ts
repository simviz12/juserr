import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { usuarios, pizzaSabores, bebidas, categorias, productos, movimientosInventario, movimientosBebidas, pizzaRuedas, pizzaSobras, pizzaVentas, turnos, gastos, cierresDia, cortesSemanales, sesiones } from './schema';
import * as dotenv from 'dotenv';
import * as argon2 from '@node-rs/argon2';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seed() {
  console.log('Seeding database...');

  // Limpiar tablas en orden inverso a sus dependencias (FK)
  console.log('Clearing existing data...');
  await db.delete(cortesSemanales);
  await db.delete(cierresDia);
  await db.delete(gastos);
  await db.delete(turnos);
  await db.delete(pizzaVentas);
  await db.delete(pizzaSobras);
  await db.delete(pizzaRuedas);
  await db.delete(movimientosBebidas);
  await db.delete(movimientosInventario);
  await db.delete(sesiones);
  await db.delete(productos);
  await db.delete(categorias);
  await db.delete(bebidas);
  await db.delete(pizzaSabores);
  await db.delete(usuarios);

  // Insertar Usuarios
  console.log('Inserting users...');
  const defaultPassword = await argon2.hash('password123');
  await db.insert(usuarios).values([
    { nombre: 'Gabo', rol: 'jefe', passwordHash: defaultPassword },
    { nombre: 'Empleado 1', rol: 'empleado', passwordHash: defaultPassword },
  ]);

  // Insertar Sabores de Pizza
  console.log('Inserting pizza flavors...');
  await db.insert(pizzaSabores).values([
    { nombre: 'Hawaiana', precioPorcion: '4500', precioRueda: '35000' },
    { nombre: 'Pepperoni', precioPorcion: '4000', precioRueda: '32000' },
    { nombre: 'Margarita', precioPorcion: '3500', precioRueda: '28000' },
  ]);

  // Insertar Bebidas
  console.log('Inserting beverages...');
  await db.insert(bebidas).values([
    { nombre: 'Coca Cola 400ml', precio: '3000', stockActual: 24 },
    { nombre: 'Jugo de Mora', precio: '4000', stockActual: 10 },
    { nombre: 'Agua Manantial', precio: '2500', stockActual: 15 },
  ]);

  // Insertar Categorias
  console.log('Inserting categories...');
  const catInserted = await db.insert(categorias).values([
    { nombre: 'Lácteos' },
    { nombre: 'Cárnicos' },
    { nombre: 'Vegetales' },
    { nombre: 'Insumos Generales' }
  ]).returning();

  // Insertar Productos de Prueba
  console.log('Inserting sample products...');
  await db.insert(productos).values([
    { nombre: 'Queso Mozzarella', categoriaId: catInserted[0].id, unidadMedida: 'fraccion', stockActual: 5, precio: '0' },
    { nombre: 'Pechuga de Pollo', categoriaId: catInserted[1].id, unidadMedida: 'pechuga', stockActual: 10, precio: '0' },
    { nombre: 'Piña', categoriaId: catInserted[2].id, unidadMedida: 'fraccion', stockActual: 2, precio: '0' },
  ]);

  console.log('Database seeding completed successfully!');
}

seed().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
