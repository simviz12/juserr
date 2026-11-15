import { describe, it, expect } from 'vitest';
import {
	calcularEntitlements,
	diasEntre,
	esCodigoTenant,
	estadoModulo,
	extenderVigencia,
	prorrateoCents,
	sugerirCodigo,
	sumarMeses,
	totalMensualCents,
	type SuscripcionModulo
} from '../src/lib/billing/domain';
import {
	evaluarAcceso,
	menuModulos,
	moduloDeRuta,
	rutaDisponible,
	validarRegistro,
	type ModuleDef,
	type Entitlements
} from '../src/lib/modules/registry';

const sub = (
	modulo: string,
	vigenteHasta: string,
	precio = 1_000_000,
	estado = 'activa'
): SuscripcionModulo => ({
	modulo,
	estado,
	vigenteHasta,
	precioMensualCents: precio
});
const tenant = { estado: 'activo', diasGracia: 5 };
const HOY = '2026-11-14';

describe('vigencia de módulos', () => {
	it('vigente hasta el último día pagado inclusive', () => {
		expect(estadoModulo(sub('core', '2026-11-14'), HOY, 5)).toBe('vigente');
		expect(estadoModulo(sub('core', '2026-11-30'), HOY, 5)).toBe('vigente');
	});

	it('entra en gracia al vencer y luego vence', () => {
		expect(estadoModulo(sub('core', '2026-11-13'), HOY, 5)).toBe('gracia'); // 1 día vencido
		expect(estadoModulo(sub('core', '2026-11-09'), HOY, 5)).toBe('gracia'); // 5 días: último de gracia
		expect(estadoModulo(sub('core', '2026-11-08'), HOY, 5)).toBe('vencido'); // 6 días
		expect(estadoModulo(sub('core', '2026-11-13'), HOY, 0)).toBe('vencido'); // sin gracia
	});

	it('un módulo cancelado no da acceso aunque esté pagado', () => {
		expect(estadoModulo(sub('produccion', '2026-12-31', 1, 'cancelada'), HOY, 5)).toBe('vencido');
	});
});

describe('derechos del restaurante', () => {
	it('Core al día + add-ons pagados', () => {
		const e = calcularEntitlements(
			tenant,
			[
				sub('core', '2026-12-01'),
				sub('produccion', '2026-12-01'),
				sub('estado-resultados', '2026-11-01')
			],
			HOY
		);
		expect(e.estadoCore).toBe('al-dia');
		expect(e.modulos).toEqual(['produccion']); // estado-resultados venció hace 13 días
		expect(e.diasParaVencer).toBe(17);
		expect(e.coreVigenteHasta).toBe('2026-12-01');
	});

	it('Core en gracia informa los días que quedan', () => {
		const e = calcularEntitlements(tenant, [sub('core', '2026-11-12')], HOY);
		expect(e.estadoCore).toBe('gracia');
		expect(e.diasGraciaRestantes).toBe(3);
		expect(e.diasParaVencer).toBe(-2);
	});

	it('Core vencido pasa a solo lectura (no se bloquea ni se pierden datos)', () => {
		expect(calcularEntitlements(tenant, [sub('core', '2026-10-01')], HOY).estadoCore).toBe(
			'solo-lectura'
		);
	});

	it('sin suscripción al Core = solo lectura', () => {
		expect(calcularEntitlements(tenant, [], HOY).estadoCore).toBe('solo-lectura');
	});

	it('suspendido por la plataforma anula todo, aunque esté pagado', () => {
		const e = calcularEntitlements(
			{ estado: 'suspendido', diasGracia: 5 },
			[sub('core', '2027-01-01'), sub('produccion', '2027-01-01')],
			HOY
		);
		expect(e.estadoCore).toBe('suspendido');
		expect(e.modulos).toEqual([]);
	});

	it('un add-on impago no afecta al Core', () => {
		const e = calcularEntitlements(
			tenant,
			[sub('core', '2026-12-01'), sub('produccion', '2026-10-01')],
			HOY
		);
		expect(e.estadoCore).toBe('al-dia');
		expect(e.modulos).toEqual([]);
	});
});

describe('pagos', () => {
	it('suma meses calendario sin desbordar el mes', () => {
		expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
		expect(sumarMeses('2024-01-31', 1)).toBe('2024-02-29');
		expect(sumarMeses('2026-11-14', 12)).toBe('2027-11-14');
	});

	it('pagar estando al día extiende desde el vencimiento (no se pierden días)', () => {
		expect(extenderVigencia('2026-11-30', HOY, 1)).toEqual({
			desde: '2026-12-01',
			hasta: '2026-12-31'
		});
	});

	it('pagar estando vencido arranca desde hoy', () => {
		expect(extenderVigencia('2026-10-01', HOY, 1)).toEqual({
			desde: '2026-11-14',
			hasta: '2026-12-13'
		});
		expect(extenderVigencia(null, HOY, 3)).toEqual({ desde: '2026-11-14', hasta: '2027-02-13' });
	});

	it('total mensual solo de los módulos activos', () => {
		expect(
			totalMensualCents([
				sub('core', HOY, 6_900_000),
				sub('produccion', HOY, 1_500_000),
				sub('x', HOY, 999, 'cancelada')
			])
		).toBe(8_400_000);
	});

	it('prorrateo proporcional a los días hasta el vencimiento del Core, redondeado al peso', () => {
		expect(prorrateoCents(3_000_000, HOY, '2026-11-28')).toBe(1_500_000); // 15 de 30 días
		expect(prorrateoCents(2_900_000, HOY, '2026-11-14')).toBe(96_700); // 1 día → $966,67 → $967
		expect(prorrateoCents(2_900_000, HOY, '2026-11-13')).toBe(0);
		expect(diasEntre('2026-11-14', '2026-12-14')).toBe(30);
	});
});

describe('códigos de restaurante', () => {
	it('sugiere un código limpio desde el nombre', () => {
		expect(sugerirCodigo('Pizzería Don Juan')).toBe('pizzeria-don-juan');
		expect(sugerirCodigo('  ¡Chuzos & Más #2!  ')).toBe('chuzos-mas-2');
	});

	it('valida el formato', () => {
		expect(esCodigoTenant('pizzeria-don-juan')).toBe(true);
		for (const malo of [
			'ab',
			'Mayus',
			'con espacio',
			'-inicio',
			'fin-',
			'doble--guion',
			'x'.repeat(41)
		]) {
			expect(esCodigoTenant(malo), malo).toBe(false);
		}
	});
});

describe('bloqueo de rutas por módulo', () => {
	const ent = (p: Partial<Entitlements>): Entitlements => ({
		tenant: 'resto-b',
		estadoCore: 'al-dia',
		modulos: [],
		coreVigenteHasta: '2026-12-01',
		diasParaVencer: 17,
		diasGraciaRestantes: null,
		...p
	});

	it('reconoce a qué módulo pertenece cada ruta', () => {
		expect(moduloDeRuta('/finanzas/estado-resultados')?.codigo).toBe('estado-resultados');
		expect(moduloDeRuta('/finanzas/resumen')?.codigo).toBe('finanzas-avanzadas');
		expect(moduloDeRuta('/reportes/produccion')?.codigo).toBe('produccion');
		expect(moduloDeRuta('/finanzas/caja')).toBeNull(); // Core
		expect(moduloDeRuta('/turnos/cierre')).toBeNull();
		expect(moduloDeRuta('/finanzas/resumenes')).toBeNull(); // no confunde prefijos
	});

	it('bloquea vista y acciones de un add-on no contratado, sin tocar el Core', () => {
		expect(evaluarAcceso('/finanzas/estado-resultados', ent({}), false).tipo).toBe(
			'modulo-no-contratado'
		);
		expect(evaluarAcceso('/finanzas/estado-resultados', ent({}), true).tipo).toBe(
			'modulo-no-contratado'
		);
		expect(
			evaluarAcceso('/finanzas/estado-resultados', ent({ modulos: ['estado-resultados'] }), true)
				.tipo
		).toBe('ok');
		expect(evaluarAcceso('/turnos/cierre', ent({}), true).tipo).toBe('ok');
	});

	it('en solo lectura deja ver y exportar pero no escribir', () => {
		const e = ent({ estadoCore: 'solo-lectura', modulos: ['produccion'] });
		expect(evaluarAcceso('/turnos/cierre', e, false).tipo).toBe('ok');
		expect(evaluarAcceso('/turnos/cierre', e, true).tipo).toBe('solo-lectura');
		expect(evaluarAcceso('/reportes/produccion', e, false).tipo).toBe('ok');
	});

	it('suspendido: solo facturación, módulos y salir', () => {
		const e = ent({ estadoCore: 'suspendido' });
		expect(evaluarAcceso('/dashboard', e, false).tipo).toBe('suspendido');
		expect(evaluarAcceso('/facturacion', e, false).tipo).toBe('ok');
		expect(evaluarAcceso('/modulos', e, true).tipo).toBe('ok');
		expect(evaluarAcceso('/logout', e, true).tipo).toBe('ok');
	});

	it('el menú usa la misma regla', () => {
		expect(rutaDisponible('/reportes/produccion', ent({}))).toBe(false);
		expect(rutaDisponible('/reportes/produccion', ent({ modulos: ['produccion'] }))).toBe(true);
		expect(rutaDisponible('/bodega', ent({}))).toBe(true);
	});
});

describe('funciones exclusivas (hechas a pedido de un restaurante)', () => {
	// Simula lo que hace `pnpm modulo:nuevo`: un módulo exclusivo de "resto-a".
	const exclusivo: ModuleDef = {
		codigo: 'domicilios-resto-a',
		nombre: 'Domicilios',
		rutas: ['/m/domicilios-resto-a'],
		exclusivoDe: 'resto-a',
		menu: { nombre: 'Domicilios', ruta: '/m/domicilios-resto-a', icono: 'truck' }
	};
	const base: Entitlements = {
		tenant: 'resto-a',
		estadoCore: 'al-dia',
		modulos: [],
		coreVigenteHasta: '2026-12-01',
		diasParaVencer: 17,
		diasGraciaRestantes: null
	};

	it('el registro actual es válido', () => {
		expect(validarRegistro()).toEqual([]);
	});

	it('detecta errores de configuración del registro', () => {
		const malo: ModuleDef = { ...exclusivo, rutas: ['/finanzas/caja-especial'] };
		expect(validarRegistro([malo]).join(' ')).toMatch(/debe vivir bajo \/m\//);
		expect(validarRegistro([exclusivo, exclusivo]).join(' ')).toMatch(/Código repetido/);
		expect(
			validarRegistro([{ ...exclusivo, menu: { nombre: 'x', ruta: '/otra' } }]).join(' ')
		).toMatch(/menú apunta fuera/);
	});

	it('para el dueño funciona como un módulo pagado', () => {
		// evaluarAcceso usa el registro real; aquí se prueba la regla con la entrada simulada.
		expect(
			evaluarAcceso('/m/domicilios-resto-a', { ...base, modulos: ['domicilios-resto-a'] }, true, [
				exclusivo
			]).tipo
		).toBe('ok');
		// Vencido: no se borra, pero se bloquea (el dueño va a Facturación)
		expect(evaluarAcceso('/m/domicilios-resto-a', base, false, [exclusivo]).tipo).toBe(
			'modulo-no-contratado'
		);
	});

	it('para cualquier otro restaurante NO EXISTE (404), aunque esté suspendido o lo "tenga"', () => {
		const otro = { ...base, tenant: 'resto-b' };
		expect(evaluarAcceso('/m/domicilios-resto-a', otro, false, [exclusivo]).tipo).toBe(
			'no-encontrado'
		);
		expect(evaluarAcceso('/m/domicilios-resto-a/editar', otro, true, [exclusivo]).tipo).toBe(
			'no-encontrado'
		);
		expect(
			evaluarAcceso('/m/domicilios-resto-a', { ...otro, estadoCore: 'suspendido' }, false, [
				exclusivo
			]).tipo
		).toBe('no-encontrado');
		expect(
			evaluarAcceso('/m/domicilios-resto-a', { ...otro, modulos: ['domicilios-resto-a'] }, false, [
				exclusivo
			]).tipo
		).toBe('no-encontrado');
	});

	it('solo aparece en el menú de su dueño', () => {
		expect(menuModulos({ ...base, modulos: ['domicilios-resto-a'] }, [exclusivo])).toEqual([
			{
				codigo: 'domicilios-resto-a',
				nombre: 'Domicilios',
				ruta: '/m/domicilios-resto-a',
				icono: 'truck',
				exclusivo: true,
				bloqueado: false
			}
		]);
		expect(menuModulos(base, [exclusivo])[0].bloqueado).toBe(true); // vencido: con candado
		expect(menuModulos({ ...base, tenant: 'resto-b' }, [exclusivo])).toEqual([]);
	});

	it('el registro real no expone menús propios a quien no corresponde', () => {
		expect(menuModulos({ ...base, tenant: 'cualquiera' }).every((m) => !m.exclusivo)).toBe(true);
	});
});
