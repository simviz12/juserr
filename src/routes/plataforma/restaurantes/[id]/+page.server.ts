import { error, fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { exigirAdminPlataforma } from '$lib/server/guards';
import { log } from '$lib/server/log';
import { db } from '$lib/server/db';
import { auditoriaPlataforma, tenants } from '$lib/server/schema';
import {
	activarModulo,
	actualizarRestaurante,
	cambiarEstadoRestaurante,
	cambiarPrecioModulo,
	cancelarModulo,
	catalogo,
	ErrorNegocio,
	ESTADOS_TENANT,
	METODOS_PAGO,
	pagosDe,
	registrarPago,
	solicitudesPendientes,
	suscripcionesDe,
	type MetodoPago
} from '$lib/billing/server';
import { calcularEntitlements, estadoModulo, totalMensualCents } from '$lib/billing/domain';
import { parseMoneyInput } from '$lib/features/finance/domain/money';
import { businessDayKey } from '$lib/features/finance/domain/period';

function idDe(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Restaurante no encontrado');
	return id;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	exigirAdminPlataforma(locals);
	const id = idDe(params);
	const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
	if (!t) error(404, 'Restaurante no encontrado');

	const [subs, historial, solicitudes, cat, auditoria] = await Promise.all([
		suscripcionesDe(id),
		pagosDe(id, 50),
		solicitudesPendientes(id),
		catalogo(),
		db
			.select()
			.from(auditoriaPlataforma)
			.where(eq(auditoriaPlataforma.tenantId, id))
			.orderBy(desc(auditoriaPlataforma.createdAt))
			.limit(20)
	]);
	const hoy = businessDayKey(new Date());
	const contratados = new Set(subs.map((s) => s.modulo));

	return {
		creado: url.searchParams.has('creado'),
		restaurante: { ...t, createdAt: t.createdAt?.toISOString() ?? null },
		plan: calcularEntitlements(t, subs, hoy),
		modulos: subs.map((s) => ({ ...s, situacion: estadoModulo(s, hoy, t.diasGracia) })),
		totalMensualCents: totalMensualCents(subs),
		disponibles: cat
			// Generales + los exclusivos de ESTE restaurante (nunca los de otro).
			.filter(
				(m) =>
					!m.esCore &&
					!contratados.has(m.codigo) &&
					(m.exclusivoTenantId === null || m.exclusivoTenantId === id)
			)
			.map((m) => ({
				codigo: m.codigo,
				nombre: m.nombre,
				precioMensualCents: m.precioMensualCents,
				exclusivo: m.exclusivoTenantId !== null
			})),
		pagos: historial,
		solicitudes: solicitudes.map((s) => s.modulo),
		auditoria: auditoria.map((a) => ({
			id: a.id,
			accion: a.accion,
			createdAt: a.createdAt?.toISOString() ?? null
		})),
		metodos: [...METODOS_PAGO]
	};
};

/** Ejecuta una acción de la consola traduciendo errores de negocio a mensajes. */
async function ejecutar(
	e: RequestEvent,
	fn: (adminId: number, tenantId: number, fd: FormData) => Promise<string>
) {
	const admin = exigirAdminPlataforma(e.locals);
	const tenantId = idDe(e.params);
	const fd = await e.request.formData();
	try {
		return { success: true, message: await fn(admin.id, tenantId, fd) };
	} catch (err) {
		if (err instanceof ErrorNegocio) return fail(400, { error: err.message });
		log.error('error en acción de plataforma', { tenantId, adminId: admin.id, err });
		return fail(500, { error: 'No se pudo completar la acción.' });
	}
}

const pesos = (cents: number) => '$' + Math.round(cents / 100).toLocaleString('es-CO');
const metodoDe = (fd: FormData): MetodoPago => {
	const m = fd.get('metodo')?.toString() || 'transferencia';
	if (!(METODOS_PAGO as readonly string[]).includes(m))
		throw new ErrorNegocio('Método de pago inválido.');
	return m as MetodoPago;
};

export const actions: Actions = {
	pagar: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			const recibidoRaw = fd.get('recibido')?.toString().trim() ?? '';
			const recibidoCents = recibidoRaw ? parseMoneyInput(recibidoRaw) : undefined;
			if (recibidoCents === null) throw new ErrorNegocio('El monto recibido no es válido.');
			const r = await registrarPago(adminId, tenantId, {
				modulos: fd.getAll('modulos').map(String),
				meses: Number(fd.get('meses')),
				metodo: metodoDe(fd),
				referencia: fd.get('referencia')?.toString().trim().slice(0, 120),
				nota: fd.get('nota')?.toString().trim().slice(0, 300),
				recibidoCents
			});
			const hasta = r.detalle
				.map((d) => d.hasta)
				.sort()
				.at(-1);
			return `Pago de ${pesos(r.recibido)} registrado. Vigente hasta ${hasta}.`;
		}),

	activar: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			const precioRaw = fd.get('precio')?.toString().trim() ?? '';
			const precio = precioRaw ? parseMoneyInput(precioRaw) : undefined;
			if (precio === null) throw new ErrorNegocio('El precio no es válido.');
			const r = await activarModulo(adminId, tenantId, fd.get('modulo')?.toString() ?? '', {
				precioMensualCents: precio,
				cobrar: fd.get('cobrar') === 'on',
				metodo: metodoDe(fd),
				referencia: fd.get('referencia')?.toString().trim().slice(0, 120)
			});
			return `"${r.nombre}" activo hasta ${r.hasta}${r.prorrateo ? ` (prorrateo cobrado: ${pesos(r.prorrateo)})` : ' (cortesía hasta el próximo ciclo)'}.`;
		}),

	cancelar: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			await cancelarModulo(adminId, tenantId, fd.get('modulo')?.toString() ?? '');
			return 'Módulo cancelado: deja de facturarse y se bloquea para el restaurante.';
		}),

	precio: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			const cents = parseMoneyInput(fd.get('precio')?.toString() ?? '');
			if (cents === null) throw new ErrorNegocio('El precio no es válido.');
			await cambiarPrecioModulo(adminId, tenantId, fd.get('modulo')?.toString() ?? '', cents);
			return `Precio actualizado a ${pesos(cents)}/mes. Aplica desde el próximo pago.`;
		}),

	estado: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			const estado = fd.get('estado')?.toString() ?? '';
			if (!(ESTADOS_TENANT as readonly string[]).includes(estado))
				throw new ErrorNegocio('Estado inválido.');
			await cambiarEstadoRestaurante(adminId, tenantId, estado as (typeof ESTADOS_TENANT)[number]);
			return `Restaurante ${estado}.`;
		}),

	editar: (e) =>
		ejecutar(e, async (adminId, tenantId, fd) => {
			const txt = (k: string, max = 120) => fd.get(k)?.toString().trim().slice(0, max) ?? '';
			const limite = txt('limite_usuarios', 5);
			await actualizarRestaurante(adminId, tenantId, {
				nombre: txt('nombre', 80),
				contactoNombre: txt('contacto_nombre'),
				contactoTelefono: txt('contacto_telefono', 30),
				contactoEmail: txt('contacto_email'),
				limiteUsuarios: limite ? Number(limite) : null,
				diasGracia: Number(txt('dias_gracia', 3))
			});
			return 'Datos del restaurante actualizados.';
		})
};
