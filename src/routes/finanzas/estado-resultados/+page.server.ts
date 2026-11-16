import { db } from '$lib/server/db';
import { gastos, movimientosContables } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { protegerAcciones } from '$lib/server/actions';
import { log } from '$lib/server/log';
import { exigirModulo } from '$lib/server/guards';
import { canAccess } from '$lib/auth/access';
import { delTenant, tenantDe } from '$lib/server/tenancy';
import { businessDayKey, isValidDateKey } from '$lib/features/finance/domain/period';
import { centsToDecimalString, parseMoneyInput } from '$lib/features/finance/domain/money';
import {
	CATEGORIAS_GASTO,
	TIPO_MOVIMIENTO_LABELS,
	esCategoriaGasto,
	esTipoMovimiento
} from '$lib/modules/estado-resultados/domain/income-statement';
import {
	parseComparacion,
	resolveRange
} from '$lib/modules/estado-resultados/domain/statement-period';
import {
	ESTADO_ANULADO,
	ESTADO_CONFIRMADO,
	fechaDeMovimiento,
	getIncomeStatement
} from '$lib/modules/estado-resultados/server/income-statement.service';
import { getBusinessConfig } from '$lib/features/business/server/config';

const RUTA = '/finanzas/estado-resultados';
/** Tope por registro: $100.000 millones. Protege de ceros de más al digitar. */
const MONTO_MAXIMO_CENTS = 100_000_000_000 * 100;

export const load: PageServerLoad = async ({ url, locals }) => {
	exigirModulo(locals, 'estado-resultados');
	const tid = tenantDe(locals);
	const hoy = businessDayKey(new Date());
	const rango = resolveRange(url.searchParams.get('inicio'), url.searchParams.get('fin'), hoy);
	const modo = parseComparacion(url.searchParams.get('comparar'));

	const [reporte, config] = await Promise.all([
		getIncomeStatement(tid, rango, modo),
		getBusinessConfig(tid)
	]);

	return {
		negocio: config.nombreNegocio,
		hoy,
		modo,
		...reporte,
		catalogo: CATEGORIAS_GASTO.map((c) => ({
			codigo: c.codigo,
			nombre: c.nombre,
			seccion: c.seccion
		}))
	};
};

/**
 * Defensa en profundidad: el guard central (hooks.server.ts) ya restringe la
 * ruta, pero cada acción vuelve a comprobarlo para no depender de un solo punto.
 */
function autorizar(locals: RequestEvent['locals']) {
	const user = locals.user;
	return user && canAccess(user.rol, RUTA) ? user : null;
}

const idPositivo = (value: FormDataEntryValue | null) => {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
};

export const actions: Actions = protegerAcciones('estado-resultados', {
	/** Registra una devolución, descuento, otro ingreso o un gasto pagado por fuera de la caja. */
	registrar: async ({ request, locals }) => {
		exigirModulo(locals, 'estado-resultados');
		const user = autorizar(locals);
		if (!user)
			return fail(403, { error: 'No tienes permiso para registrar movimientos contables.' });

		const fd = await request.formData();
		const tipo = fd.get('tipo')?.toString() ?? '';
		const categoria = fd.get('categoria')?.toString() ?? '';
		const descripcion = fd.get('descripcion')?.toString().trim().slice(0, 200) ?? '';
		const fecha = fd.get('fecha')?.toString() ?? '';
		const cents = parseMoneyInput(fd.get('monto')?.toString() ?? '');
		const valores = {
			tipo,
			categoria,
			descripcion,
			fecha,
			monto: fd.get('monto')?.toString() ?? ''
		};

		if (!esTipoMovimiento(tipo))
			return fail(400, { error: 'Selecciona el tipo de movimiento.', valores });
		if (tipo === 'gasto' && !esCategoriaGasto(categoria))
			return fail(400, { error: 'Selecciona la categoría del gasto.', valores });
		if (!descripcion) return fail(400, { error: 'Escribe el concepto del movimiento.', valores });
		if (cents === null || cents <= 0)
			return fail(400, { error: 'El valor debe ser un número mayor que cero.', valores });
		if (cents > MONTO_MAXIMO_CENTS)
			return fail(400, { error: 'El valor es demasiado alto. Revisa los ceros.', valores });
		if (!isValidDateKey(fecha))
			return fail(400, { error: 'Selecciona una fecha válida.', valores });
		if (fecha > businessDayKey(new Date()))
			return fail(400, { error: 'No puedes registrar movimientos con fecha futura.', valores });

		try {
			await db.insert(movimientosContables).values({
				tenantId: user.tenantId,
				tipo,
				categoria: tipo === 'gasto' ? categoria : null,
				descripcion,
				monto: centsToDecimalString(cents),
				fecha: fechaDeMovimiento(fecha),
				estado: ESTADO_CONFIRMADO,
				usuarioId: user.id
			});
		} catch (err) {
			log.error('error al registrar movimiento contable', { tenantId: user.tenantId, err });
			return fail(500, { error: 'No se pudo guardar el movimiento. Intenta de nuevo.', valores });
		}

		return {
			success: true,
			message: `${TIPO_MOVIMIENTO_LABELS[tipo]} registrado: ${descripcion}.`
		};
	},

	/** Anula un movimiento manual. No se borra: queda en la base con estado "anulado". */
	anular: async ({ request, locals }) => {
		exigirModulo(locals, 'estado-resultados');
		const user = autorizar(locals);
		if (!user) return fail(403, { error: 'No tienes permiso para anular movimientos contables.' });

		const id = idPositivo((await request.formData()).get('id'));
		if (!id) return fail(400, { error: 'Movimiento inválido.' });

		try {
			// La condición sobre el estado hace la operación idempotente (doble clic, reintentos).
			const anulados = await db
				.update(movimientosContables)
				.set({ estado: ESTADO_ANULADO, anuladoPor: user.id, anuladoEn: new Date() })
				.where(
					and(
						eq(movimientosContables.tenantId, user.tenantId),
						eq(movimientosContables.id, id),
						eq(movimientosContables.estado, ESTADO_CONFIRMADO)
					)
				)
				.returning({ id: movimientosContables.id });
			if (anulados.length === 0)
				return fail(404, { error: 'El movimiento no existe o ya estaba anulado.' });
		} catch (err) {
			log.error('error al anular movimiento contable', { tenantId: user.tenantId, err });
			return fail(500, { error: 'No se pudo anular el movimiento. Intenta de nuevo.' });
		}

		return { success: true, message: 'Movimiento anulado. Ya no cuenta en el informe.' };
	},

	/** Cambia la categoría contable de un gasto de caja (vacío = clasificación automática). */
	categorizar: async ({ request, locals }) => {
		exigirModulo(locals, 'estado-resultados');
		const user = autorizar(locals);
		if (!user) return fail(403, { error: 'No tienes permiso para clasificar gastos.' });

		const fd = await request.formData();
		const id = idPositivo(fd.get('id'));
		const categoria = fd.get('categoria')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Gasto inválido.' });
		if (categoria !== '' && !esCategoriaGasto(categoria))
			return fail(400, { error: 'Categoría inválida.' });

		try {
			const actualizados = await db
				.update(gastos)
				.set({ categoria: categoria || null })
				.where(delTenant(gastos, user.tenantId, eq(gastos.id, id)))
				.returning({ id: gastos.id });
			if (actualizados.length === 0) return fail(404, { error: 'El gasto no existe.' });
		} catch (err) {
			log.error('error al categorizar gasto', { tenantId: user.tenantId, err });
			return fail(500, { error: 'No se pudo cambiar la categoría. Intenta de nuevo.' });
		}

		return { success: true, message: 'Categoría actualizada.' };
	}
});
