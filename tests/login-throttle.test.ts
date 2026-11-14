import { describe, it, expect } from 'vitest';
import { limpiarFallos, minutosBloqueo, registrarFallo } from '../src/lib/server/login-throttle';

describe('freno de fuerza bruta del login', () => {
	it('bloquea tras 5 fallos y libera al vencer la ventana', () => {
		const claves = ['ip:test-1', 'user:test-1'];
		const t0 = 1_000_000;
		for (let i = 0; i < 4; i++) registrarFallo(claves, t0);
		expect(minutosBloqueo(claves, t0)).toBe(0);
		registrarFallo(claves, t0);
		expect(minutosBloqueo(claves, t0)).toBe(15);
		expect(minutosBloqueo(['ip:otra', 'user:test-1'], t0 + 60_000)).toBe(14);
		expect(minutosBloqueo(claves, t0 + 16 * 60_000)).toBe(0);
	});

	it('un ingreso correcto reinicia el contador', () => {
		const claves = ['ip:test-2', 'user:test-2'];
		for (let i = 0; i < 4; i++) registrarFallo(claves);
		limpiarFallos(claves);
		registrarFallo(claves);
		expect(minutosBloqueo(claves)).toBe(0);
	});
});
