/** Manejo de errores en form actions (base caída, bugs) y logger estructurado. */
import { describe, it, expect, vi } from 'vitest';
import { isRedirect, redirect } from '@sveltejs/kit';
import { protegerAcciones } from '../src/lib/server/actions';
import { log } from '../src/lib/server/log';

const evento = { locals: { user: { id: 1, tenantId: 7 } } } as never;

describe('protegerAcciones', () => {
	it('una caída de conexión vuelve como fail(503) y no tumba la página', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const a = protegerAcciones('prueba', {
			guardar: async () => {
				throw new TypeError('fetch failed');
			}
		});
		const r = (await a.guardar(evento)) as { status: number; data: { error: string } };
		expect(r.status).toBe(503);
		expect(r.data.error).toMatch(/base de datos/);
		const linea = JSON.parse(spy.mock.calls[0][0] as string);
		expect(linea).toMatchObject({ nivel: 'error', accion: 'prueba/guardar', tenantId: 7 });
		expect(linea.errorId).toMatch(/^[0-9a-f-]{36}$/);
		spy.mockRestore();
	});

	it('un bug vuelve como fail(500) con código de soporte', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const a = protegerAcciones('prueba', {
			guardar: async () => {
				throw new Error('x is undefined');
			}
		});
		const r = (await a.guardar(evento)) as { status: number; data: { error: string } };
		expect(r.status).toBe(500);
		expect(r.data.error).toMatch(/código [0-9a-f]{8}/);
		spy.mockRestore();
	});

	it('deja pasar redirect() intacto', async () => {
		const a = protegerAcciones('prueba', {
			ir: async () => redirect(303, '/destino')
		});
		await expect(a.ir(evento)).rejects.toSatisfy(isRedirect);
	});
});

describe('logger', () => {
	it('emite una línea JSON con el error serializado', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		log.error('falló', { tenantId: 3, err: new Error('boom', { cause: { code: '23505' } }) });
		const linea = JSON.parse(spy.mock.calls[0][0] as string);
		expect(linea).toMatchObject({ nivel: 'error', msg: 'falló', tenantId: 3 });
		expect(linea.err.message).toBe('boom');
		expect(linea.err.cause.code).toBe('23505');
		spy.mockRestore();
	});
});
