/**
 * Crea (o cambia la contraseña de) un operador de la consola /plataforma.
 *
 *   node scripts/create-platform-admin.mjs <correo> "<Nombre>" [--totp]
 *
 * La contraseña se pide por la terminal (no queda en el historial del shell).
 * Con --totp genera un secreto de segundo factor e imprime el enlace
 * otpauth:// para registrarlo en la app autenticadora (Google Authenticator,
 * 1Password, Authy...). Desde entonces el login exige el código de 6 dígitos.
 */
import { neon } from '@neondatabase/serverless';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import 'dotenv/config';

const args = process.argv.slice(2);
const conTotp = args.includes('--totp');
const [email, nombre] = args.filter((a) => !a.startsWith('--'));
if (!email || !nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
	console.error('Uso: node scripts/create-platform-admin.mjs <correo> "<Nombre>" [--totp]');
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question('Contraseña (12 a 256 caracteres): ')).trim();
rl.close();
if (password.length < 12 || password.length > 256) {
	console.error('La contraseña debe tener entre 12 y 256 caracteres.');
	process.exit(1);
}

function base32(buf) {
	const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = 0;
	let v = 0;
	let out = '';
	for (const b of buf) {
		v = (v << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += A[(v >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += A[(v << (5 - bits)) & 31];
	return out;
}
const totp = conTotp ? base32(randomBytes(20)) : null;

const sql = neon(process.env.DATABASE_URL);
const [row] = await sql`
	INSERT INTO platform_admins (email, nombre, password_hash, totp_secret)
	VALUES (${email.toLowerCase()}, ${nombre}, ${await hash(password)}, ${totp})
	ON CONFLICT (email) DO UPDATE SET
		nombre = EXCLUDED.nombre,
		password_hash = EXCLUDED.password_hash,
		totp_secret = COALESCE(EXCLUDED.totp_secret, platform_admins.totp_secret)
	RETURNING id`;
// Cierra las sesiones abiertas de ese operador (por si era un cambio de contraseña).
await sql`DELETE FROM platform_sesiones WHERE admin_id = ${row.id}`;
console.log(`Operador ${email} listo. Entra en /plataforma/login.`);
if (totp) {
	const e = encodeURIComponent('MesaCapital');
	console.log(
		'\nSegundo factor activado. Registra este enlace (o el secreto) en tu app autenticadora:'
	);
	console.log(
		`  otpauth://totp/${e}:${encodeURIComponent(email)}?secret=${totp}&issuer=${e}&period=30&digits=6`
	);
	console.log(`  Secreto: ${totp}`);
}
