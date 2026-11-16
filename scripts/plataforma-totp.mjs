/**
 * Segundo factor (TOTP) de la consola /plataforma, sin tocar contraseñas.
 *
 *   node scripts/plataforma-totp.mjs --listar
 *       Muestra los operadores y si tienen TOTP.
 *   node scripts/plataforma-totp.mjs --activar [correo]
 *       Genera el secreto para ese operador (o para todos los que no tengan)
 *       e imprime el enlace otpauth:// para la app autenticadora.
 *   node scripts/plataforma-totp.mjs --probar <correo> <código>
 *       Comprueba que la app genera el código correcto ANTES de exigirlo.
 *   node scripts/plataforma-totp.mjs --quitar <correo>
 *       Retira el TOTP de un operador (si perdió el teléfono).
 *
 * Activar el TOTP cierra las sesiones abiertas de ese operador.
 */
import { neon } from '@neondatabase/serverless';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import 'dotenv/config';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
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
function desdeBase32(s) {
	let bits = 0;
	let v = 0;
	const out = [];
	for (const c of s.toUpperCase()) {
		v = (v << 5) | A.indexOf(c);
		bits += 5;
		if (bits >= 8) {
			out.push((v >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}
function codigo(secreto, ms) {
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(Math.floor(ms / 30_000)));
	const h = createHmac('sha1', desdeBase32(secreto)).update(msg).digest();
	const o = h[h.length - 1] & 0xf;
	return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
const uri = (secreto, correo) => {
	const e = encodeURIComponent('MesaCapital');
	return `otpauth://totp/${e}:${encodeURIComponent(correo)}?secret=${secreto}&issuer=${e}&algorithm=SHA1&digits=6&period=30`;
};

if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const [accion, a1, a2] = process.argv.slice(2);

if (accion === '--listar') {
	const filas =
		await sql`SELECT email, nombre, totp_secret IS NOT NULL AS totp FROM platform_admins ORDER BY id`;
	for (const f of filas)
		console.log(`${f.totp ? '✓ TOTP' : '✗ sin TOTP'}  ${f.email}  (${f.nombre})`);
	if (!filas.length) console.log('No hay operadores de plataforma.');
} else if (accion === '--activar') {
	const filas = a1
		? await sql`SELECT id, email FROM platform_admins WHERE lower(email) = lower(${a1})`
		: await sql`SELECT id, email FROM platform_admins WHERE totp_secret IS NULL ORDER BY id`;
	if (!filas.length)
		console.log(a1 ? `No existe el operador ${a1}.` : 'Todos los operadores ya tienen TOTP.');
	for (const f of filas) {
		const secreto = base32(randomBytes(20));
		await sql`UPDATE platform_admins SET totp_secret = ${secreto} WHERE id = ${f.id}`;
		await sql`DELETE FROM platform_sesiones WHERE admin_id = ${f.id}`;
		console.log(`\n${f.email}`);
		console.log(`  Secreto (escríbelo en la app como "clave de configuración"): ${secreto}`);
		console.log(`  Enlace: ${uri(secreto, f.email)}`);
	}
	if (filas.length)
		console.log(
			'\nRegistra el secreto en Google Authenticator / 1Password / Authy y comprueba con --probar <correo> <código>.'
		);
} else if (accion === '--probar' && a1 && a2) {
	const [f] = await sql`SELECT totp_secret FROM platform_admins WHERE lower(email) = lower(${a1})`;
	if (!f?.totp_secret) {
		console.log('Ese operador no tiene TOTP.');
		process.exit(1);
	}
	const ok = [-1, 0, 1].some((d) => {
		const esperado = Buffer.from(codigo(f.totp_secret, Date.now() + d * 30_000));
		const dado = Buffer.from(a2.replace(/\s/g, '').padStart(6, '0').slice(-6));
		return esperado.length === dado.length && timingSafeEqual(esperado, dado);
	});
	console.log(
		ok
			? '✓ Código correcto: la app está bien configurada.'
			: '✗ Código incorrecto (revisa la hora del teléfono).'
	);
	process.exit(ok ? 0 : 1);
} else if (accion === '--quitar' && a1) {
	const r =
		await sql`UPDATE platform_admins SET totp_secret = NULL WHERE lower(email) = lower(${a1}) RETURNING id`;
	console.log(r.length ? `TOTP retirado de ${a1}.` : `No existe el operador ${a1}.`);
} else {
	console.log(
		'Uso: --listar | --activar [correo] | --probar <correo> <código> | --quitar <correo>'
	);
	process.exit(1);
}
