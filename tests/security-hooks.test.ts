/**
 * Regresión de seguridad del hook central (hooks.server.ts).
 *
 * Antes, el hook comparaba `url.pathname` SIN decodificar mientras SvelteKit
 * enruta la versión decodificada: `/pl%61taforma` saltaba la consola de
 * plataforma y `/finanzas/re%73umen` saltaba el cobro de módulos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { Entitlements } from '../src/lib/modules/registry';

const estado = vi.hoisted(() => ({
	admin: null as null | { id: number; email: string; nombre: string },
	user: { id: 10, tenantId: 2, nombre: 'jefe-b', rol: 'jefe' }
}));

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/platform-auth', () => ({
	PLATFORM_COOKIE: 'psession',
	validarSesionPlataforma: async () => estado.admin
}));
vi.mock('$lib/server/auth', () => ({
	SESSION_COOKIE_OPTS: { path: '/' },
	validateSessionToken: async () => ({
		session: { id: 's', userId: 10, expiresAt: new Date(Date.now() + 1e9), createdAt: new Date() },
		user: estado.user
	})
}));
const ENT: Entitlements = {
	tenant: 'resto-b',
	estadoCore: 'al-dia',
	modulos: [], // sin add-ons contratados
	coreVigenteHasta: '2099-01-01',
	diasParaVencer: 100,
	diasGraciaRestantes: null
};
vi.mock('$lib/server/tenancy', () => ({
	derechosDe: async () => ({
		info: { id: 2, codigo: 'resto-b', nombre: 'B', estado: 'activo', diasGracia: 5 },
		ent: ENT
	})
}));

const { handle } = await import('../src/hooks.server');
const { rutaCanonica } = await import('../src/lib/auth/access');
const { exigirAdminPlataforma, exigirModulo } = await import('../src/lib/server/guards');

function evento(pathname: string, routeId: string | null = null, method = 'GET') {
	const url = new URL('http://localhost' + pathname);
	return {
		url,
		route: { id: routeId },
		request: new Request(url, { method }),
		cookies: {
			get: (n: string) => (n === 'session' ? 'token' : n === 'psession' ? 'ptoken' : undefined),
			set: () => {},
			delete: () => {}
		},
		locals: {} as App.Locals
	};
}

/** Ejecuta el hook y devuelve 'resuelto' si llegó a la página, o el redirect/error. */
async function correr(pathname: string, routeId: string | null = null, method = 'GET') {
	const e = evento(pathname, routeId, method);
	try {
		await handle({
			event: e as never,
			resolve: async () => new Response('ok')
		});
		return { tipo: 'resuelto' as const, locals: e.locals };
	} catch (err) {
		if (isRedirect(err)) return { tipo: 'redirect' as const, a: err.location };
		if (isHttpError(err)) return { tipo: 'error' as const, status: err.status };
		throw err;
	}
}

beforeEach(() => {
	estado.admin = null;
});

describe('rutaCanonica', () => {
	it('decodifica igual que SvelteKit y respeta %25', () => {
		expect(rutaCanonica('/pl%61taforma')).toBe('/plataforma');
		expect(rutaCanonica('/a%2525b')).toBe('/a%2525b');
		expect(rutaCanonica('/%E0%A4%A')).toBeNull();
	});
});

describe('consola de plataforma: no se salta con % codificados', () => {
	for (const p of [
		'/plataforma',
		'/pl%61taforma',
		'/pl%61taforma/__data.json',
		'/%70lataforma/restaurantes/1'
	]) {
		it(`un usuario de restaurante en ${p} va al login de plataforma`, async () => {
			const r = await correr(p);
			expect(r).toEqual({ tipo: 'redirect', a: '/plataforma/login' });
		});
	}

	it('también decide por route.id aunque la ruta no lo parezca', async () => {
		const r = await correr('/otra-cosa', '/plataforma/restaurantes/[id]');
		expect(r).toEqual({ tipo: 'redirect', a: '/plataforma/login' });
	});

	it('el admin de plataforma sí entra', async () => {
		estado.admin = { id: 1, email: 'a@b.co', nombre: 'A' };
		expect((await correr('/plataforma')).tipo).toBe('resuelto');
	});

	it('guard de defensa en profundidad: sin admin → 404', () => {
		expect(() => exigirAdminPlataforma({ platformAdmin: null } as App.Locals)).toThrow();
	});
});

describe('módulos de pago: no se saltan con % codificados', () => {
	for (const p of [
		'/finanzas/re%73umen',
		'/finanzas/estado-resultad%6fs',
		'/reportes/producci%6fn'
	]) {
		it(`${p} sin contratar redirige a /modulos`, async () => {
			const r = await correr(p);
			expect(r.tipo).toBe('redirect');
			expect((r as { a: string }).a).toMatch(/^\/modulos\?bloqueado=/);
		});
	}

	it('guard dentro de la ruta: sin el módulo → 403', () => {
		try {
			exigirModulo({ user: estado.user, entitlements: ENT } as unknown as App.Locals, 'produccion');
			expect.unreachable();
		} catch (e) {
			expect(isHttpError(e) && e.status).toBe(403);
		}
	});

	it('una ruta del Core sí resuelve y no expone el hash de la contraseña', async () => {
		const r = await correr('/dashboard');
		expect(r.tipo).toBe('resuelto');
		expect(r.tipo === 'resuelto' && 'passwordHash' in (r.locals.user ?? {})).toBe(false);
	});

	it('una ruta mal codificada responde 400', async () => {
		expect(await correr('/%E0%A4%A')).toEqual({ tipo: 'error', status: 400 });
	});
});
