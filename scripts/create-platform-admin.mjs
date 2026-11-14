/**
 * Crea (o cambia la contraseña de) un operador de la consola /plataforma.
 *
 *   node scripts/create-platform-admin.mjs <correo> "<Nombre>"
 *
 * La contraseña se pide por la terminal (no queda en el historial del shell).
 */
import { neon } from '@neondatabase/serverless';
import { hash } from '@node-rs/argon2';
import { createInterface } from 'node:readline/promises';
import 'dotenv/config';

const [email, nombre] = process.argv.slice(2);
if (!email || !nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
	console.error('Uso: node scripts/create-platform-admin.mjs <correo> "<Nombre>"');
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question('Contraseña (mínimo 12 caracteres): ')).trim();
rl.close();
if (password.length < 12) {
	console.error('La contraseña debe tener al menos 12 caracteres.');
	process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const [row] = await sql`
	INSERT INTO platform_admins (email, nombre, password_hash)
	VALUES (${email.toLowerCase()}, ${nombre}, ${await hash(password)})
	ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash
	RETURNING id`;
// Cierra las sesiones abiertas de ese operador (por si era un cambio de contraseña).
await sql`DELETE FROM platform_sesiones WHERE admin_id = ${row.id}`;
console.log(`Operador ${email} listo. Entra en /plataforma/login.`);
