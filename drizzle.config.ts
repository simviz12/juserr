import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * drizzle-kit se usa SOLO para inspeccionar (`drizzle-kit check`, `studio`).
 * Las migraciones reales se escriben a mano en migrations/NNNN_*.sql y las
 * aplica scripts/migrate.mjs (`pnpm db:migrate`); tests/migration.test.ts
 * verifica que dejen la base idéntica a schema.ts.
 * Lo que genere `drizzle-kit generate` va a .drizzle/ (ignorado por git) para
 * no crear un segundo historial de migraciones.
 */
export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './.drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!
	},
	verbose: true,
	strict: true
});
