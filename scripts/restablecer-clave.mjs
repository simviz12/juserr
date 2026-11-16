/**
 * Restablece la contraseña de un usuario de un restaurante (p. ej. el Jefe
 * olvidó la suya). Genera una aleatoria, la imprime UNA vez y cierra sus
 * sesiones abiertas. Solo toca ese usuario de ese restaurante.
 *
 *   node scripts/restablecer-clave.mjs --tenant <código> --usuario "<nombre>"
 */
import { neon } from '@neondatabase/serverless';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import 'dotenv/config';

const arg = (n) => {
	const i = process.argv.indexOf(`--${n}`);
	return i > -1 ? process.argv[i + 1] : undefined;
};
const codigo = arg('tenant');
const usuario = arg('usuario');
if (!codigo || !usuario) {
	console.error('Uso: node scripts/restablecer-clave.mjs --tenant <código> --usuario "<nombre>"');
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const clave = randomBytes(9).toString('base64url');
const [u] = await sql`
	UPDATE usuarios u SET password_hash = ${await hash(clave)}
	FROM tenants t
	WHERE u.tenant_id = t.id AND t.codigo = ${codigo} AND lower(u.nombre) = lower(${usuario})
	RETURNING u.id, u.nombre, u.rol`;
if (!u) {
	console.error(`No existe el usuario "${usuario}" en el restaurante "${codigo}".`);
	process.exit(1);
}
await sql`DELETE FROM sesiones WHERE user_id = ${u.id}`;
console.log(`Contraseña restablecida para ${u.nombre} (${u.rol}) en ${codigo}.`);
console.log(`Nueva contraseña (cámbiala en Configuración → Personal): ${clave}`);
