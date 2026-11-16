/**
 * TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s): segundo factor de la consola de
 * plataforma. Compatible con Google Authenticator, 1Password, Authy, etc.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_S = 30;

export function base32Encode(buf: Uint8Array): string {
	let bits = 0;
	let valor = 0;
	let out = '';
	for (const b of buf) {
		valor = (valor << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += ALFABETO[(valor >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31];
	return out;
}

export function base32Decode(s: string): Buffer {
	const limpio = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
	let bits = 0;
	let valor = 0;
	const out: number[] = [];
	for (const c of limpio) {
		const i = ALFABETO.indexOf(c);
		if (i < 0) throw new Error('Secreto TOTP inválido');
		valor = (valor << 5) | i;
		bits += 5;
		if (bits >= 8) {
			out.push((valor >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export function nuevoSecretoTotp(): string {
	return base32Encode(randomBytes(20));
}

export function codigoTotp(secreto: string, ahoraMs = Date.now()): string {
	const contador = Math.floor(ahoraMs / 1000 / PASO_S);
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(contador));
	const hmac = createHmac('sha1', base32Decode(secreto)).update(msg).digest();
	const off = hmac[hmac.length - 1] & 0xf;
	const bin = (hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
	return bin.toString().padStart(6, '0');
}

/** Acepta el código del paso actual y ±1 (tolerancia de reloj de 30 s). */
export function verificarTotp(secreto: string, codigo: string, ahoraMs = Date.now()): boolean {
	const c = codigo.replace(/\s/g, '');
	if (!/^\d{6}$/.test(c)) return false;
	for (const d of [-1, 0, 1]) {
		const esperado = codigoTotp(secreto, ahoraMs + d * PASO_S * 1000);
		if (timingSafeEqual(Buffer.from(esperado), Buffer.from(c))) return true;
	}
	return false;
}

export function uriTotp(secreto: string, cuenta: string, emisor = 'MesaCapital'): string {
	const e = encodeURIComponent(emisor);
	return `otpauth://totp/${e}:${encodeURIComponent(cuenta)}?secret=${secreto}&issuer=${e}&algorithm=SHA1&digits=6&period=${PASO_S}`;
}
