import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pizzaSabores, bebidas, categorias, productos } from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function wipe() {
  console.log('Wiping catalogs...');

  // Limpiar tablas (las demás ya están vacías del paso anterior)
  await db.delete(productos);
  await db.delete(categorias);
  await db.delete(bebidas);
  await db.delete(pizzaSabores);

  console.log('Catalogs wiped successfully!');
}

wipe().catch((err) => {
  console.error('Error wiping database:', err);
  process.exit(1);
});
