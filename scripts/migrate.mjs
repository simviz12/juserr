/**
 * Runner de migraciones con historial.
 *
 *   node scripts/migrate.mjs            aplica las pendientes de migrations/*.sql
 *   node scripts/migrate.mjs --estado   solo muestra cuáles están aplicadas y cuáles no
 *
 * Cada archivo se ejecuta en UNA transacción y se registra en `_migraciones`
 * (nombre + checksum). Un archivo ya aplicado nunca se vuelve a ejecutar; si su
 * contenido cambió después de aplicarse, el runner se detiene en lugar de
 * aplicar algo distinto a lo que corrió en producción.
 *
 * - Un candado (pg_advisory_lock) evita que dos despliegues simultáneos
 *   apliquen la misma migración a la vez.
 * - El checksum ignora la diferencia CRLF/LF: el mismo archivo da el mismo
 *   checksum en Windows y en Linux (se aceptan también los checksums antiguos
 *   calculados sobre el archivo con CRLF).
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// En local se lee .env; en Docker/Vercel las variables ya vienen del entorno (dotenv no se instala).
await import('dotenv/config').catch(() => {});

if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}
if (typeof WebSocket !== 'undefined') neonConfig.webSocketConstructor = WebSocket;

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const archivos = readdirSync(dir)
	.filter((f) => /^\d{4}_.+\.sql$/.test(f))
	.sort();
const soloEstado = process.argv.includes('--estado');
/** Número fijo del candado de migraciones (cualquier entero, igual en todos los despliegues). */
const CANDADO = 727_001;

const sha = (t) => createHash('sha256').update(t).digest('hex');
/** Checksums válidos de un archivo: el canónico (LF) y los de sus variantes de fin de línea. */
function checksums(contenido) {
	const lf = contenido.replace(/\r\n/g, '\n');
	const crlf = lf.replace(/\n/g, '\r\n');
	return { canonico: sha(lf), aceptados: new Set([sha(lf), sha(crlf), sha(contenido)]) };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let codigo = 0;

try {
	await client.query('SELECT pg_advisory_lock($1)', [CANDADO]);
	await client.query(`CREATE TABLE IF NOT EXISTS _migraciones (
		nombre text PRIMARY KEY,
		checksum text NOT NULL,
		aplicada_en timestamptz NOT NULL DEFAULT now()
	)`);
	const { rows } = await client.query('SELECT nombre, checksum FROM _migraciones');
	const aplicadas = new Map(rows.map((r) => [r.nombre, r.checksum]));

	for (const archivo of archivos) {
		const contenido = readFileSync(path.join(dir, archivo), 'utf8');
		const { canonico: checksum, aceptados } = checksums(contenido);
		const previa = aplicadas.get(archivo);

		if (previa) {
			if (!aceptados.has(previa)) {
				throw new Error(
					`${archivo} cambió después de aplicarse. Crea una migración nueva en vez de editarla.`
				);
			}
			console.log(`✓ ${archivo} (ya aplicada)`);
			continue;
		}
		if (soloEstado) {
			console.log(`· ${archivo} (pendiente)`);
			continue;
		}

		console.log(`→ Aplicando ${archivo}…`);
		await client.query('BEGIN');
		try {
			await client.query(contenido);
			await client.query('INSERT INTO _migraciones (nombre, checksum) VALUES ($1, $2)', [
				archivo,
				checksum
			]);
			await client.query('COMMIT');
			console.log(`✓ ${archivo} aplicada`);
		} catch (err) {
			await client.query('ROLLBACK');
			throw new Error(`${archivo} falló y se revirtió completa: ${err.message}`, { cause: err });
		}
	}
} catch (err) {
	console.error(`✗ ${err.message}`);
	codigo = 1;
} finally {
	await client.query('SELECT pg_advisory_unlock($1)', [CANDADO]).catch(() => {});
	client.release();
	await pool.end();
}
process.exit(codigo);
