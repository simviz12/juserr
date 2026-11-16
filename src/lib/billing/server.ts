/**
 * Casos de uso de facturación y administración de restaurantes.
 * Toda la aritmética vive en ./domain (pura y probada); aquí solo se lee y escribe.
 */
import { db } from '$lib/server/db';
import {
	modulosCatalogo,
	pagos,
	rubrosConfig,
	solicitudesModulo,
	suscripcionesModulo,
	tenants,
	usuarios,
	auditoriaPlataforma
} from '$lib/server/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { businessDayKey } from '$lib/features/finance/domain/period';
import { invalidarDerechos } from '$lib/server/tenancy';
import { invalidateTenantSessions } from '$lib/server/auth';
import { esCodigoPg } from '$lib/server/pg-errors';
import { CORE } from '$lib/modules/registry';
import {
	esCodigoTenant,
	extenderVigencia,
	prorrateoCents,
	sumarDias,
	totalMensualCents
} from './domain';

export const METODOS_PAGO = [
	'transferencia',
	'nequi',
	'daviplata',
	'efectivo',
	'tarjeta',
	'otro'
] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

const hoy = () => businessDayKey(new Date());

export class ErrorNegocio extends Error {}

// ── Lecturas ──────────────────────────────────────────────────────────

export async function catalogo() {
	return db.select().from(modulosCatalogo).orderBy(asc(modulosCatalogo.orden));
}

export async function suscripcionesDe(tenantId: number) {
	return db
		.select({
			modulo: suscripcionesModulo.modulo,
			nombre: modulosCatalogo.nombre,
			esCore: modulosCatalogo.esCore,
			estado: suscripcionesModulo.estado,
			vigenteHasta: suscripcionesModulo.vigenteHasta,
			precioMensualCents: suscripcionesModulo.precioMensualCents
		})
		.from(suscripcionesModulo)
		.innerJoin(modulosCatalogo, eq(suscripcionesModulo.modulo, modulosCatalogo.codigo))
		.where(eq(suscripcionesModulo.tenantId, tenantId))
		.orderBy(asc(modulosCatalogo.orden));
}

export async function pagosDe(tenantId: number, limite = 24) {
	const rows = await db
		.select()
		.from(pagos)
		.where(eq(pagos.tenantId, tenantId))
		.orderBy(desc(pagos.createdAt))
		.limit(limite);
	return rows.map((p) => ({ ...p, createdAt: p.createdAt?.toISOString() ?? null }));
}

export async function solicitudesPendientes(tenantId?: number) {
	return db
		.select({
			id: solicitudesModulo.id,
			tenantId: solicitudesModulo.tenantId,
			tenant: tenants.nombre,
			modulo: solicitudesModulo.modulo,
			nombreModulo: modulosCatalogo.nombre,
			createdAt: solicitudesModulo.createdAt
		})
		.from(solicitudesModulo)
		.innerJoin(tenants, eq(solicitudesModulo.tenantId, tenants.id))
		.innerJoin(modulosCatalogo, eq(solicitudesModulo.modulo, modulosCatalogo.codigo))
		.where(
			tenantId === undefined
				? eq(solicitudesModulo.estado, 'pendiente')
				: and(eq(solicitudesModulo.estado, 'pendiente'), eq(solicitudesModulo.tenantId, tenantId))
		)
		.orderBy(desc(solicitudesModulo.createdAt));
}

/** Resumen de todos los restaurantes para la consola. */
export async function listarRestaurantes() {
	const [lista, subs, usuariosPorTenant] = await Promise.all([
		db.select().from(tenants).orderBy(asc(tenants.nombre)),
		db.select().from(suscripcionesModulo),
		db
			.select({ tenantId: usuarios.tenantId, n: sql<number>`count(*)::int` })
			.from(usuarios)
			.groupBy(usuarios.tenantId)
	]);
	const nUsuarios = new Map(usuariosPorTenant.map((u) => [u.tenantId, u.n]));
	return lista.map((t) => {
		const propias = subs.filter((s) => s.tenantId === t.id);
		const core = propias.find((s) => s.modulo === CORE);
		return {
			...t,
			createdAt: t.createdAt?.toISOString() ?? null,
			usuarios: nUsuarios.get(t.id) ?? 0,
			modulos: propias.filter((s) => s.estado === 'activa').map((s) => s.modulo),
			coreVigenteHasta: core?.vigenteHasta ?? null,
			mensualCents: totalMensualCents(propias)
		};
	});
}

// ── Acciones del restaurante ──────────────────────────────────────────

export async function solicitarModulo(tenantId: number, usuarioId: number, modulo: string) {
	const [m] = await db.select().from(modulosCatalogo).where(eq(modulosCatalogo.codigo, modulo));
	if (!m || m.esCore || !m.publico) throw new ErrorNegocio('Ese módulo no está disponible.');
	const [ya] = await db
		.select({ id: solicitudesModulo.id })
		.from(solicitudesModulo)
		.where(
			and(
				eq(solicitudesModulo.tenantId, tenantId),
				eq(solicitudesModulo.modulo, modulo),
				eq(solicitudesModulo.estado, 'pendiente')
			)
		);
	const yaPedido = () =>
		new ErrorNegocio(`Ya pediste "${m.nombre}". Te contactaremos para activarlo.`);
	if (ya) throw yaPedido();
	// El índice único parcial (una pendiente por módulo) cubre el doble clic simultáneo.
	const nueva = await db
		.insert(solicitudesModulo)
		.values({ tenantId, modulo, solicitadoPor: usuarioId })
		.onConflictDoNothing()
		.returning({ id: solicitudesModulo.id });
	if (nueva.length === 0) throw yaPedido();
	return m.nombre;
}

// ── Acciones de la consola de plataforma ──────────────────────────────

export interface NuevoRestaurante {
	nombre: string;
	codigo: string;
	contactoNombre?: string;
	contactoTelefono?: string;
	contactoEmail?: string;
	jefeUsuario: string;
	jefePassword: string;
	modulos: string[];
	diasPrueba: number;
	limiteUsuarios: number | null;
}

/** Crea el restaurante, su configuración, su usuario Jefe y sus módulos en un solo lote atómico. */
export async function crearRestaurante(adminId: number, d: NuevoRestaurante): Promise<number> {
	if (!esCodigoTenant(d.codigo))
		throw new ErrorNegocio(
			'El código debe tener 3 a 40 caracteres: minúsculas, números y guiones.'
		);
	if (d.jefePassword.length < 8 || d.jefePassword.length > 256)
		throw new ErrorNegocio('La contraseña del Jefe debe tener entre 8 y 256 caracteres.');
	if (!Number.isInteger(d.diasPrueba) || d.diasPrueba < 1 || d.diasPrueba > 90)
		throw new ErrorNegocio('Los días de prueba deben estar entre 1 y 90.');
	const [existe] = await db
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.codigo, d.codigo));
	if (existe) throw new ErrorNegocio(`El código "${d.codigo}" ya está en uso.`);

	const cat = await catalogo();
	// Al crear un restaurante solo se ofrecen Core y módulos generales (nunca exclusivos de otro).
	const elegidos = cat.filter(
		(m) => m.esCore || (m.exclusivoTenantId === null && d.modulos.includes(m.codigo))
	);
	const vigenteHasta = sumarDias(hoy(), d.diasPrueba - 1);

	const reservado = await db.execute<{ id: number }>(
		sql`SELECT nextval(pg_get_serial_sequence('tenants', 'id'))::int AS id`
	);
	const id = Number(reservado.rows[0].id);

	await db.batch([
		db.insert(tenants).values({
			id,
			codigo: d.codigo,
			nombre: d.nombre,
			contactoNombre: d.contactoNombre || null,
			contactoTelefono: d.contactoTelefono || null,
			contactoEmail: d.contactoEmail || null,
			limiteUsuarios: d.limiteUsuarios
		}),
		db.insert(rubrosConfig).values({ tenantId: id, nombreNegocio: d.nombre }),
		db.insert(usuarios).values({
			tenantId: id,
			nombre: d.jefeUsuario,
			passwordHash: await hash(d.jefePassword),
			rol: 'jefe'
		}),
		db.insert(suscripcionesModulo).values(
			elegidos.map((m) => ({
				tenantId: id,
				modulo: m.codigo,
				vigenteHasta,
				precioMensualCents: m.precioMensualCents
			}))
		),
		db.insert(auditoriaPlataforma).values({
			adminId,
			tenantId: id,
			accion: 'crear-restaurante',
			detalle: {
				codigo: d.codigo,
				modulos: elegidos.map((m) => m.codigo),
				diasPrueba: d.diasPrueba
			}
		})
	]);
	return id;
}

export interface PagoInput {
	modulos: string[];
	meses: number;
	metodo: MetodoPago;
	referencia?: string;
	nota?: string;
	/** Monto realmente recibido (centavos). Si se omite, el valor calculado. */
	recibidoCents?: number;
}

/** Registra un pago y extiende la vigencia de los módulos que cubre. */
export async function registrarPago(adminId: number, tenantId: number, p: PagoInput) {
	if (!Number.isInteger(p.meses) || p.meses < 1 || p.meses > 24)
		throw new ErrorNegocio('Los meses deben estar entre 1 y 24.');
	if (!(METODOS_PAGO as readonly string[]).includes(p.metodo))
		throw new ErrorNegocio('Método de pago inválido.');

	const subs = (await suscripcionesDe(tenantId)).filter(
		(s) => s.estado === 'activa' && p.modulos.includes(s.modulo)
	);
	if (subs.length === 0) throw new ErrorNegocio('Selecciona al menos un módulo activo.');

	const fecha = hoy();
	const detalle = subs.map((s) => {
		const { desde, hasta } = extenderVigencia(s.vigenteHasta, fecha, p.meses);
		return { modulo: s.modulo, desde, hasta, cents: s.precioMensualCents * p.meses };
	});
	const calculado = detalle.reduce((a, d) => a + d.cents, 0);
	const recibido = p.recibidoCents ?? calculado;
	if (!Number.isSafeInteger(recibido) || recibido < 0)
		throw new ErrorNegocio('Monto recibido inválido.');

	try {
		await db.batch([
			db.insert(auditoriaPlataforma).values({
				adminId,
				tenantId,
				accion: 'registrar-pago',
				detalle: { recibido, calculado, detalle }
			}),
			// Bloqueo optimista: solo se extiende si la vigencia sigue siendo la que se
			// leyó. Si otro pago la cambió entretanto, 1/0 aborta TODO el lote (no queda
			// un pago registrado sin su extensión, ni una extensión contada dos veces).
			...detalle.map((d) => {
				const leida = subs.find((s) => s.modulo === d.modulo)!.vigenteHasta;
				return db.execute(sql`
				WITH u AS (
					UPDATE suscripciones_modulo SET vigente_hasta = ${d.hasta}, updated_at = now()
					WHERE tenant_id = ${tenantId} AND modulo = ${d.modulo} AND vigente_hasta = ${leida}
					RETURNING 1
				)
				SELECT 1 / (SELECT count(*) FROM u)::int AS ok`);
			}),
			db.insert(pagos).values({
				tenantId,
				montoCents: recibido,
				detalle,
				metodo: p.metodo,
				referencia: p.referencia || null,
				nota: p.nota || (recibido !== calculado ? `Valor calculado: ${calculado / 100}` : null),
				registradoPor: adminId
			})
		]);
	} catch (err) {
		if (esCodigoPg(err, '22012'))
			throw new ErrorNegocio(
				'Otro pago de este restaurante se registró al mismo tiempo. Recarga la página y revisa antes de volver a registrar.'
			);
		throw err;
	}
	invalidarDerechos(tenantId);
	return { recibido, calculado, detalle };
}

/**
 * Activa (o reactiva) un add-on alineado con el vencimiento del Core, para que
 * el restaurante tenga una sola fecha de pago. Si `cobrar`, registra el pago del
 * prorrateo; si no, queda como cortesía hasta el próximo ciclo.
 */
export async function activarModulo(
	adminId: number,
	tenantId: number,
	modulo: string,
	opts: { precioMensualCents?: number; cobrar: boolean; metodo?: MetodoPago; referencia?: string }
) {
	const [m] = await db.select().from(modulosCatalogo).where(eq(modulosCatalogo.codigo, modulo));
	if (!m || m.esCore) throw new ErrorNegocio('Módulo inválido.');
	// Un módulo exclusivo solo se activa a su dueño (la base de datos también lo impide).
	if (m.exclusivoTenantId !== null && m.exclusivoTenantId !== tenantId) {
		throw new ErrorNegocio(`"${m.nombre}" es exclusivo de otro restaurante.`);
	}
	const subs = await suscripcionesDe(tenantId);
	const core = subs.find((s) => s.modulo === CORE);
	const fecha = hoy();
	const hasta = core && core.vigenteHasta >= fecha ? core.vigenteHasta : sumarDias(fecha, 29);
	const precio = opts.precioMensualCents ?? m.precioMensualCents;
	if (!Number.isSafeInteger(precio) || precio < 0) throw new ErrorNegocio('Precio inválido.');
	const prorrateo = prorrateoCents(precio, fecha, hasta);

	await db.batch([
		db
			.insert(suscripcionesModulo)
			.values({
				tenantId,
				modulo,
				estado: 'activa',
				vigenteHasta: hasta,
				precioMensualCents: precio
			})
			.onConflictDoUpdate({
				target: [suscripcionesModulo.tenantId, suscripcionesModulo.modulo],
				set: {
					estado: 'activa',
					vigenteHasta: hasta,
					precioMensualCents: precio,
					updatedAt: new Date()
				}
			}),
		db
			.update(solicitudesModulo)
			.set({ estado: 'atendida' })
			.where(
				and(
					eq(solicitudesModulo.tenantId, tenantId),
					eq(solicitudesModulo.modulo, modulo),
					eq(solicitudesModulo.estado, 'pendiente')
				)
			),
		...(opts.cobrar
			? [
					db.insert(pagos).values({
						tenantId,
						montoCents: prorrateo,
						detalle: [{ modulo, desde: fecha, hasta, cents: prorrateo }],
						metodo: opts.metodo ?? 'transferencia',
						referencia: opts.referencia || null,
						nota: 'Prorrateo por activación a mitad de ciclo',
						registradoPor: adminId
					})
				]
			: []),
		db.insert(auditoriaPlataforma).values({
			adminId,
			tenantId,
			accion: 'activar-modulo',
			detalle: { modulo, hasta, precio, prorrateo: opts.cobrar ? prorrateo : 0 }
		})
	]);
	invalidarDerechos(tenantId);
	return { nombre: m.nombre, hasta, prorrateo: opts.cobrar ? prorrateo : 0 };
}

/** Cancela un add-on: deja de facturarse y se bloquea (el Core no se puede cancelar aquí). */
export async function cancelarModulo(adminId: number, tenantId: number, modulo: string) {
	if (modulo === CORE)
		throw new ErrorNegocio('El Plan Core no se cancela; suspende el restaurante si es necesario.');
	const r = await db
		.update(suscripcionesModulo)
		.set({ estado: 'cancelada', updatedAt: new Date() })
		.where(and(eq(suscripcionesModulo.tenantId, tenantId), eq(suscripcionesModulo.modulo, modulo)))
		.returning({ modulo: suscripcionesModulo.modulo });
	if (r.length === 0) throw new ErrorNegocio('El restaurante no tiene ese módulo.');
	await db
		.insert(auditoriaPlataforma)
		.values({ adminId, tenantId, accion: 'cancelar-modulo', detalle: { modulo } });
	invalidarDerechos(tenantId);
}

export async function cambiarPrecioModulo(
	adminId: number,
	tenantId: number,
	modulo: string,
	precioMensualCents: number
) {
	if (!Number.isSafeInteger(precioMensualCents) || precioMensualCents < 0)
		throw new ErrorNegocio('Precio inválido.');
	const r = await db
		.update(suscripcionesModulo)
		.set({ precioMensualCents, updatedAt: new Date() })
		.where(and(eq(suscripcionesModulo.tenantId, tenantId), eq(suscripcionesModulo.modulo, modulo)))
		.returning({ modulo: suscripcionesModulo.modulo });
	if (r.length === 0) throw new ErrorNegocio('El restaurante no tiene ese módulo.');
	await db.insert(auditoriaPlataforma).values({
		adminId,
		tenantId,
		accion: 'cambiar-precio',
		detalle: { modulo, precioMensualCents }
	});
}

export const ESTADOS_TENANT = ['activo', 'suspendido', 'cancelado'] as const;

export async function cambiarEstadoRestaurante(
	adminId: number,
	tenantId: number,
	estado: (typeof ESTADOS_TENANT)[number]
) {
	if (!(ESTADOS_TENANT as readonly string[]).includes(estado))
		throw new ErrorNegocio('Estado inválido.');
	// Estado y auditoría juntos o ninguno (antes iban en dos escrituras separadas).
	await db.batch([
		db.update(tenants).set({ estado }).where(eq(tenants.id, tenantId)),
		db
			.insert(auditoriaPlataforma)
			.values({ adminId, tenantId, accion: 'cambiar-estado', detalle: { estado } })
	]);
	invalidarDerechos(tenantId);
	if (estado === 'cancelado') await invalidateTenantSessions(tenantId);
}

export async function actualizarRestaurante(
	adminId: number,
	tenantId: number,
	d: {
		nombre: string;
		contactoNombre: string;
		contactoTelefono: string;
		contactoEmail: string;
		limiteUsuarios: number | null;
		diasGracia: number;
	}
) {
	if (!d.nombre) throw new ErrorNegocio('El nombre es obligatorio.');
	if (!Number.isInteger(d.diasGracia) || d.diasGracia < 0 || d.diasGracia > 60)
		throw new ErrorNegocio('Los días de gracia deben estar entre 0 y 60.');
	if (d.limiteUsuarios !== null && (!Number.isInteger(d.limiteUsuarios) || d.limiteUsuarios < 1))
		throw new ErrorNegocio('Límite de usuarios inválido.');
	await db
		.update(tenants)
		.set({
			nombre: d.nombre,
			contactoNombre: d.contactoNombre || null,
			contactoTelefono: d.contactoTelefono || null,
			contactoEmail: d.contactoEmail || null,
			limiteUsuarios: d.limiteUsuarios,
			diasGracia: d.diasGracia
		})
		.where(eq(tenants.id, tenantId));
	await db
		.insert(auditoriaPlataforma)
		.values({ adminId, tenantId, accion: 'editar-restaurante', detalle: d });
	invalidarDerechos(tenantId);
}

export async function actualizarCatalogo(
	adminId: number,
	codigo: string,
	d: { precioMensualCents: number; publico: boolean; descripcion: string }
) {
	if (!Number.isSafeInteger(d.precioMensualCents) || d.precioMensualCents < 0)
		throw new ErrorNegocio('Precio inválido.');
	const r = await db
		.update(modulosCatalogo)
		.set({
			precioMensualCents: d.precioMensualCents,
			// Un exclusivo nunca se vuelve público (también lo impide un CHECK de la base).
			publico: sql`CASE WHEN ${modulosCatalogo.exclusivoTenantId} IS NULL THEN ${d.publico} ELSE false END`,
			descripcion: d.descripcion
		})
		.where(eq(modulosCatalogo.codigo, codigo))
		.returning({ codigo: modulosCatalogo.codigo });
	if (r.length === 0) throw new ErrorNegocio('Módulo inválido.');
	await db
		.insert(auditoriaPlataforma)
		.values({ adminId, accion: 'editar-catalogo', detalle: { codigo, ...d } });
}

export async function descartarSolicitud(adminId: number, id: number) {
	const r = await db
		.update(solicitudesModulo)
		.set({ estado: 'descartada' })
		.where(and(eq(solicitudesModulo.id, id), eq(solicitudesModulo.estado, 'pendiente')))
		.returning({ tenantId: solicitudesModulo.tenantId });
	if (r.length === 0) throw new ErrorNegocio('La solicitud no existe o ya fue atendida.');
	await db
		.insert(auditoriaPlataforma)
		.values({ adminId, tenantId: r[0].tenantId, accion: 'descartar-solicitud', detalle: { id } });
}
