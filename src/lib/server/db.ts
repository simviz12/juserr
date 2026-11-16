import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';

import { building } from '$app/environment';

if (!env.DATABASE_URL && !building) {
	throw new Error('DATABASE_URL is not set in the environment variables.');
}

/**
 * Tiempo máximo por consulta HTTP a Neon. Sin esto, una consulta colgada
 * mantiene abierta la función (y al usuario esperando) hasta el timeout de la
 * plataforma. Configurable con DB_TIMEOUT_MS.
 */
const TIMEOUT_MS = Number(env.DB_TIMEOUT_MS) > 0 ? Number(env.DB_TIMEOUT_MS) : 10_000;

neonConfig.fetchFunction = (url: string, init: RequestInit = {}) => {
	const limite = AbortSignal.timeout(TIMEOUT_MS);
	const signal = init.signal ? AbortSignal.any([init.signal, limite]) : limite;
	return fetch(url, { ...init, signal });
};

// Durante `vite build` no hay base de datos: se usa una URL de marcador que
// nunca se consulta (no hay credenciales reales en el código).
const sql = neon(env.DATABASE_URL || 'postgres://build:build@build.invalid/build');
export const db = drizzle(sql);
