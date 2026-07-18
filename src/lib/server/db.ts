import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';

import { building } from '$app/environment';

if (!env.DATABASE_URL && !building) {
    throw new Error('DATABASE_URL is not set in the environment variables.');
}

const sql = neon(env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres');
export const db = drizzle(sql);
