/**
 * Utilidades para scripts de terminal que operan sobre UN restaurante.
 * Exigen `--tenant <código>` y, si borran datos, `--confirmar`: con varios
 * clientes en la misma base, un script sin restaurante explícito podría borrar
 * la información de todos.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, inArray } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { sesiones, tenants, usuarios } from '../schema';

dotenv.config({ quiet: true });

export function conectar() {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada en .env');
	return drizzle(neon(process.env.DATABASE_URL));
}

export type Db = ReturnType<typeof conectar>;

export function argumento(nombre: string): string | null {
	const i = process.argv.indexOf(`--${nombre}`);
	return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

/** Resuelve el restaurante de `--tenant`. Con `destructivo`, exige además `--confirmar`. */
export async function restauranteObjetivo(db: Db, { destructivo }: { destructivo: boolean }) {
	const codigo = argumento('tenant');
	if (!codigo) {
		throw new Error(
			'Indica el restaurante: --tenant <código>. (Los scripts nunca operan sobre todos los restaurantes).'
		);
	}
	const [t] = await db
		.select({ id: tenants.id, nombre: tenants.nombre })
		.from(tenants)
		.where(eq(tenants.codigo, codigo));
	if (!t) throw new Error(`No existe un restaurante con código "${codigo}".`);
	if (destructivo && !process.argv.includes('--confirmar')) {
		throw new Error(
			`Este script BORRA datos de "${t.nombre}". Vuelve a ejecutarlo con --confirmar si es lo que quieres.`
		);
	}
	return t;
}

/** Cierra las sesiones de los usuarios de un restaurante (antes de borrarlos). */
export async function borrarSesionesDe(db: Db, tenantId: number) {
	await db
		.delete(sesiones)
		.where(
			inArray(
				sesiones.userId,
				db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.tenantId, tenantId))
			)
		);
}
