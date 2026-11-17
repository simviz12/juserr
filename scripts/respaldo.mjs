/**
 * Respaldo lógico rápido de TODAS las tablas a un archivo JSON (solo lectura
 * sobre la base). Úsalo justo antes de migrar o de una operación delicada.
 *
 *   node scripts/respaldo.mjs [carpeta]      (por defecto ../respaldos)
 *
 * No reemplaza el PITR ni los branches de Neon ni el pg_dump semanal: es un
 * punto de retorno inmediato y fácil de inspeccionar. El archivo contiene
 * datos de clientes y hashes de contraseñas: guárdalo fuera del repositorio
 * y no lo compartas.
 */
import { neon } from '@neondatabase/serverless';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}
const carpeta = path.resolve(process.argv[2] ?? '../respaldos');
mkdirSync(carpeta, { recursive: true });

const sql = neon(process.env.DATABASE_URL);
const tablas = (
	await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
).map((r) => r.tablename);

const out = { creado: new Date().toISOString(), tablas: {} };
for (const t of tablas) out.tablas[t] = await sql.query(`SELECT * FROM "${t}"`);

const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
const archivo = path.join(carpeta, `respaldo-${sello}.json`);
writeFileSync(archivo, JSON.stringify(out));
console.log(`Respaldo: ${archivo}`);
console.log(
	Object.entries(out.tablas)
		.map(([k, v]) => `${k}:${v.length}`)
		.join(' ')
);
