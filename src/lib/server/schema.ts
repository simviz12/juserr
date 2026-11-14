import { sql } from 'drizzle-orm';
import {
	pgTable,
	serial,
	text,
	integer,
	bigint,
	timestamp,
	numeric,
	boolean,
	real,
	date,
	index,
	uniqueIndex,
	primaryKey,
	jsonb,
	check
} from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════════════
// PLATAFORMA (multi-restaurante). Estas tablas NO llevan tenant_id: son de
// MesaCapital, no de un restaurante.
// ═══════════════════════════════════════════════════════════════════════

/** Cada restaurante cliente de la plataforma. */
export const tenants = pgTable(
	'tenants',
	{
		id: serial('id').primaryKey(),
		/** Código con el que el restaurante inicia sesión (minúsculas, números y guiones). */
		codigo: text('codigo').notNull().unique(),
		nombre: text('nombre').notNull(),
		/** 'activo' | 'suspendido' | 'cancelado' (decisión manual del dueño de la plataforma). */
		estado: text('estado').notNull().default('activo'),
		/** Días de gracia tras vencer el Core antes de pasar a solo lectura. */
		diasGracia: integer('dias_gracia').notNull().default(5),
		/** Máximo de usuarios del restaurante (null = sin límite). */
		limiteUsuarios: integer('limite_usuarios'),
		contactoNombre: text('contacto_nombre'),
		contactoTelefono: text('contacto_telefono'),
		contactoEmail: text('contacto_email'),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		check('tenants_codigo_check', sql`${t.codigo} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
		check('tenants_estado_check', sql`${t.estado} IN ('activo', 'suspendido', 'cancelado')`),
		check('tenants_dias_gracia_check', sql`${t.diasGracia} BETWEEN 0 AND 60`),
		check('tenants_limite_usuarios_check', sql`${t.limiteUsuarios} > 0`)
	]
);

/** Catálogo de módulos que se venden (Core + add-ons). */
export const modulosCatalogo = pgTable(
	'modulos_catalogo',
	{
		codigo: text('codigo').primaryKey(),
		nombre: text('nombre').notNull(),
		descripcion: text('descripcion').notNull().default(''),
		/** Precio de lista mensual en centavos de COP. */
		precioMensualCents: bigint('precio_mensual_cents', { mode: 'number' }).notNull(),
		esCore: boolean('es_core').notNull().default(false),
		/** false = no se ofrece a clientes nuevos (módulos a medida o retirados). */
		publico: boolean('publico').notNull().default(true),
		orden: integer('orden').notNull().default(100)
	},
	(t) => [check('modulos_catalogo_precio_check', sql`${t.precioMensualCents} >= 0`)]
);

/** Módulos contratados por cada restaurante y hasta cuándo están pagados. */
export const suscripcionesModulo = pgTable(
	'suscripciones_modulo',
	{
		tenantId: integer('tenant_id')
			.notNull()
			.references(() => tenants.id),
		modulo: text('modulo')
			.notNull()
			.references(() => modulosCatalogo.codigo),
		/** 'activa' | 'cancelada'. Cancelada = no se renueva ni se factura. */
		estado: text('estado').notNull().default('activa'),
		/** Último día (inclusive, día de negocio Colombia) cubierto por pagos. */
		vigenteHasta: date('vigente_hasta', { mode: 'string' }).notNull(),
		/** Precio pactado con este cliente (permite descuentos o precios a medida). */
		precioMensualCents: bigint('precio_mensual_cents', { mode: 'number' }).notNull(),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.tenantId, t.modulo] }),
		check('suscripciones_modulo_estado_check', sql`${t.estado} IN ('activa', 'cancelada')`),
		check('suscripciones_modulo_precio_check', sql`${t.precioMensualCents} >= 0`)
	]
);

/** Pagos recibidos. Solo se insertan: nunca se editan ni se borran. */
export const pagos = pgTable(
	'pagos',
	{
		id: serial('id').primaryKey(),
		tenantId: integer('tenant_id')
			.notNull()
			.references(() => tenants.id),
		montoCents: bigint('monto_cents', { mode: 'number' }).notNull(),
		/** Módulos que cubre este pago y hasta qué fecha quedaron. */
		detalle: jsonb('detalle')
			.$type<{ modulo: string; desde: string; hasta: string; cents: number }[]>()
			.notNull(),
		/** 'transferencia' | 'nequi' | 'efectivo' | 'wompi' | 'mercadopago' | 'otro' */
		metodo: text('metodo').notNull(),
		referencia: text('referencia'),
		nota: text('nota'),
		registradoPor: integer('registrado_por').references(() => platformAdmins.id),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		index('pagos_tenant_idx').on(t.tenantId, t.createdAt),
		check('pagos_monto_check', sql`${t.montoCents} >= 0`)
	]
);

/** Solicitudes de activación de módulos hechas desde el restaurante. */
export const solicitudesModulo = pgTable(
	'solicitudes_modulo',
	{
		id: serial('id').primaryKey(),
		tenantId: integer('tenant_id')
			.notNull()
			.references(() => tenants.id),
		modulo: text('modulo')
			.notNull()
			.references(() => modulosCatalogo.codigo),
		/** 'pendiente' | 'atendida' | 'descartada' */
		estado: text('estado').notNull().default('pendiente'),
		solicitadoPor: integer('solicitado_por'),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		check(
			'solicitudes_modulo_estado_check',
			sql`${t.estado} IN ('pendiente', 'atendida', 'descartada')`
		)
	]
);

/** Dueños/operadores de la plataforma (consola /plataforma). */
export const platformAdmins = pgTable('platform_admins', {
	id: serial('id').primaryKey(),
	email: text('email').notNull().unique(),
	nombre: text('nombre').notNull(),
	passwordHash: text('password_hash').notNull(),
	createdAt: timestamp('created_at').defaultNow()
});

export const platformSesiones = pgTable('platform_sesiones', {
	id: text('id').primaryKey(),
	adminId: integer('admin_id')
		.notNull()
		.references(() => platformAdmins.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

/** Bitácora de acciones de la consola (quién activó/suspendió/registró qué). */
export const auditoriaPlataforma = pgTable('auditoria_plataforma', {
	id: serial('id').primaryKey(),
	adminId: integer('admin_id').references(() => platformAdmins.id),
	tenantId: integer('tenant_id').references(() => tenants.id),
	accion: text('accion').notNull(),
	detalle: jsonb('detalle'),
	createdAt: timestamp('created_at').defaultNow()
});

// ═══════════════════════════════════════════════════════════════════════
// NEGOCIO. Toda tabla lleva tenant_id: un restaurante nunca ve datos de otro.
// ═══════════════════════════════════════════════════════════════════════

const tenantId = () =>
	integer('tenant_id')
		.notNull()
		.references(() => tenants.id);

export const usuarios = pgTable(
	'usuarios',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		nombre: text('nombre').notNull(),
		passwordHash: text('password_hash').notNull(),
		rol: text('rol').notNull().default('empleado'), // jefe, bodeguero, cajero, empleado
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [uniqueIndex('usuarios_tenant_nombre_uq').on(t.tenantId, sql`lower(${t.nombre})`)]
);

export const sesiones = pgTable('sesiones', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => usuarios.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const categorias = pgTable(
	'categorias',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		nombre: text('nombre').notNull()
	},
	(t) => [index('categorias_tenant_idx').on(t.tenantId)]
);

export const productos = pgTable(
	'productos',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		nombre: text('nombre').notNull(),
		categoriaId: integer('categoria_id').references(() => categorias.id),
		unidadMedida: text('unidad_medida').notNull(), // fraccion, unidad, pechuga
		stockActual: real('stock_actual').default(0),
		stockMinimo: real('stock_minimo').default(5),
		precio: numeric('precio', { precision: 10, scale: 2 }).default('0'),
		precioCosto: numeric('precio_costo', { precision: 10, scale: 2 }).default('0')
	},
	(t) => [index('productos_tenant_idx').on(t.tenantId)]
);

export const movimientosInventario = pgTable(
	'movimientos_inventario',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		productoId: integer('producto_id')
			.references(() => productos.id)
			.notNull(),
		usuarioId: integer('usuario_id').references(() => usuarios.id), // Permite null por si hay movimientos antiguos
		tipo: text('tipo').notNull(), // entrada, salida, ajuste
		cantidad: real('cantidad').notNull(),
		costoUnitario: numeric('costo_unitario', { precision: 10, scale: 2 }).default('0'),
		costoTotal: numeric('costo_total', { precision: 10, scale: 2 }).default('0'),
		fecha: timestamp('fecha').defaultNow()
	},
	(t) => [index('movimientos_inventario_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

export const bebidas = pgTable('bebidas', {
	id: serial('id').primaryKey(),
	tenantId: tenantId(),
	nombre: text('nombre').notNull(),
	precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
	stockActual: integer('stock_actual').default(0)
});

export const movimientosBebidas = pgTable('movimientos_bebidas', {
	id: serial('id').primaryKey(),
	tenantId: tenantId(),
	bebidaId: integer('bebida_id')
		.references(() => bebidas.id)
		.notNull(),
	usuarioId: integer('usuario_id').references(() => usuarios.id),
	tipo: text('tipo').notNull(), // entrada, salida, venta
	cantidad: integer('cantidad').notNull(),
	fecha: timestamp('fecha').defaultNow()
});

export const pizzaSabores = pgTable(
	'pizza_sabores',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		nombre: text('nombre').notNull(),
		precioPorcion: numeric('precio_porcion', { precision: 10, scale: 2 }).default('0'),
		precioRueda: numeric('precio_rueda', { precision: 10, scale: 2 }).default('0'),
		activo: boolean('activo').default(true)
	},
	(t) => [index('pizza_sabores_tenant_idx').on(t.tenantId)]
);

export const pizzaRuedas = pgTable('pizza_ruedas', {
	id: serial('id').primaryKey(),
	tenantId: tenantId(),
	saborId: integer('sabor_id')
		.references(() => pizzaSabores.id)
		.notNull(),
	turnoId: integer('turno_id').references(() => turnos.id),
	cantidad: integer('cantidad').notNull(),
	fecha: timestamp('fecha').defaultNow()
});

export const pizzaSobras = pgTable('pizza_sobras', {
	id: serial('id').primaryKey(),
	tenantId: tenantId(),
	saborId: integer('sabor_id')
		.references(() => pizzaSabores.id)
		.notNull(),
	turnoId: integer('turno_id').references(() => turnos.id),
	cantidad: real('cantidad').notNull(), // Puede sobrar media pizza
	fecha: timestamp('fecha').defaultNow()
});

export const pizzaVentas = pgTable(
	'pizza_ventas',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		saborId: integer('sabor_id')
			.references(() => pizzaSabores.id)
			.notNull(),
		turnoId: integer('turno_id').references(() => turnos.id),
		cantidadVendida: real('cantidad_vendida').notNull(),
		fecha: timestamp('fecha').defaultNow()
	},
	(t) => [index('pizza_ventas_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

export const turnos = pgTable(
	'turnos',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
		transferencias: numeric('transferencias', { precision: 10, scale: 2 }).default('0'), // total calculado
		descripcion: text('descripcion'),
		fecha: timestamp('fecha').defaultNow(),
		// Campos para modelo de inventario
		masasIniciales: real('masas_iniciales').default(0),
		masasSobrantes: real('masas_sobrantes').default(0),
		porcionesAyer: integer('porciones_ayer').default(0),
		porcionesSobrantes: integer('porciones_sobrantes').default(0),
		porcionesMermadas: integer('porciones_mermadas').default(0),
		porcionesVendidasCalculado: integer('porciones_vendidas_calculado').default(0)
	},
	(t) => [index('turnos_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

// Desglose de medios de pago por turno (Nequi, Daviplata, Bold/Tarjeta)
export const transaccionesTurno = pgTable(
	'transacciones_turno',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		turnoId: integer('turno_id')
			.references(() => turnos.id)
			.notNull(),
		plataforma: text('plataforma').notNull(), // 'nequi' | 'daviplata' | 'bold'
		monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
		referencias: text('referencias'), // Lista de referencias de pago importantes (opcional)
		fecha: timestamp('fecha').defaultNow()
	},
	(t) => [index('transacciones_turno_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

export const gastos = pgTable(
	'gastos',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		turnoId: integer('turno_id').references(() => turnos.id),
		descripcion: text('descripcion').notNull(),
		monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
		fecha: timestamp('fecha').defaultNow(),
		// Categoría contable para el estado de resultados. null = se clasifica sola por el concepto.
		categoria: text('categoria')
	},
	(t) => [index('gastos_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

export const cierresDia = pgTable(
	'cierres_dia',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		fecha: timestamp('fecha').defaultNow(),
		totalEfectivo: numeric('total_efectivo', { precision: 10, scale: 2 }).notNull(),
		totalTransferencias: numeric('total_transferencias', { precision: 10, scale: 2 }).default('0'),
		totalTurnos: numeric('total_turnos', { precision: 10, scale: 2 }).default('0'),
		totalGastos: numeric('total_gastos', { precision: 10, scale: 2 }).default('0')
	},
	(t) => [index('cierres_dia_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

export const cortesSemanales = pgTable(
	'cortes_semanales',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		fechaCorte: timestamp('fecha_corte').defaultNow(),
		totalCalculado: numeric('total_calculado', { precision: 10, scale: 2 }).notNull(),
		totalReal: numeric('total_real', { precision: 10, scale: 2 }),
		efectivoReal: numeric('efectivo_real', { precision: 10, scale: 2 }),
		transferenciasReales: numeric('transferencias_reales', { precision: 10, scale: 2 }),
		diferencia: numeric('diferencia', { precision: 10, scale: 2 }),
		rangoInicio: timestamp('rango_inicio'),
		rangoFin: timestamp('rango_fin')
	},
	(t) => [index('cortes_semanales_tenant_fecha_idx').on(t.tenantId, t.fechaCorte)]
);

// ── SISTEMA MULTI-RUBRO INTEGRADO (Chuzos, Asaderos, Hamburgueserías, Pizzerías, Lasañas) ──
export const rubrosConfig = pgTable(
	'rubros_config',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		nombreNegocio: text('nombre_negocio').notNull().default('Mi Gastro-Negocio'),
		rubroPrincipal: text('rubro_principal').notNull().default('mixto'), // chuzos, hamburguesas, pizzas, lasanas, carnes, mixto
		habilitarPizzas: boolean('habilitar_pizzas').default(true),
		habilitarChuzos: boolean('habilitar_chuzos').default(true),
		habilitarHamburguesas: boolean('habilitar_hamburguesas').default(true),
		habilitarLasanas: boolean('habilitar_lasanas').default(true),
		habilitarCarnes: boolean('habilitar_carnes').default(true),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [uniqueIndex('rubros_config_tenant_uq').on(t.tenantId)]
);

export const lineasGastronomicas = pgTable(
	'lineas_gastronomicas',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		codigo: text('codigo').notNull(), // 'chuzo', 'pizza', 'burger', 'lasana', 'carne' (único por restaurante)
		nombre: text('nombre').notNull(), // Ej: 'Parrilla & Chuzos', 'Pizzas Artesanales', 'Hamburguesas & Combos', 'Lasañas al Horno'
		icono: text('icono').default('UtensilsCrossed'),
		unidadPorcion: text('unidad_porcion').notNull().default('unidad'), // pincho, porcion, combo, bandeja, libra
		precioPromedio: numeric('precio_promedio', { precision: 10, scale: 2 }).default('0'),
		activo: boolean('activo').default(true),
		// Insumo que se cuenta en el cierre de turno para controlar la línea (pan, chuzo armado, porción...)
		productoControlId: integer('producto_control_id').references(() => productos.id)
	},
	(t) => [uniqueIndex('lineas_gastronomicas_tenant_codigo_uq').on(t.tenantId, t.codigo)]
);

export const itemsLinea = pgTable(
	'items_linea',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		lineaId: integer('linea_id')
			.references(() => lineasGastronomicas.id)
			.notNull(),
		nombre: text('nombre').notNull(), // Ej: 'Chuzo de Pollo y Tocineta', 'Hamburguesa Clásica Artesanal', 'Lasaña Mixta Especial'
		precioVenta: numeric('precio_venta', { precision: 10, scale: 2 }).notNull().default('0'),
		precioCosto: numeric('precio_costo', { precision: 10, scale: 2 }).default('0'),
		activo: boolean('activo').default(true),
		// Unidades del insumo de control que consume una venta de este plato (p. ej. 1 pan)
		unidadesControl: real('unidades_control').default(1)
	},
	(t) => [index('items_linea_tenant_idx').on(t.tenantId)]
);

// Conciliación por inventario de cada línea en un cierre de turno (puestos callejeros)
export const cierresLinea = pgTable(
	'cierres_linea',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		turnoId: integer('turno_id')
			.references(() => turnos.id)
			.notNull(),
		lineaId: integer('linea_id')
			.references(() => lineasGastronomicas.id)
			.notNull(),
		productoId: integer('producto_id').references(() => productos.id),
		inicial: real('inicial').notNull(),
		sobrantes: real('sobrantes').notNull(),
		mermas: real('mermas').notNull().default(0),
		consumidas: real('consumidas').notNull(),
		ventaEsperada: numeric('venta_esperada', { precision: 12, scale: 2 }).notNull().default('0'),
		desgloseCompleto: boolean('desglose_completo').default(false),
		fecha: timestamp('fecha').defaultNow()
	},
	(t) => [
		index('cierres_linea_tenant_fecha_idx').on(t.tenantId, t.fecha),
		index('cierres_linea_turno_idx').on(t.turnoId)
	]
);

// Platos vendidos por turno (desglose opcional del cierre)
export const ventasItems = pgTable(
	'ventas_items',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		turnoId: integer('turno_id')
			.references(() => turnos.id)
			.notNull(),
		itemId: integer('item_id')
			.references(() => itemsLinea.id)
			.notNull(),
		lineaId: integer('linea_id')
			.references(() => lineasGastronomicas.id)
			.notNull(),
		cantidad: real('cantidad').notNull(),
		precioUnitario: numeric('precio_unitario', { precision: 10, scale: 2 }).notNull(),
		costoUnitario: numeric('costo_unitario', { precision: 10, scale: 2 }).default('0'),
		fecha: timestamp('fecha').defaultNow()
	},
	(t) => [
		index('ventas_items_tenant_fecha_idx').on(t.tenantId, t.fecha),
		index('ventas_items_turno_idx').on(t.turnoId)
	]
);

// ── ESTADO DE RESULTADOS (movimientos contables que no pasan por la caja del turno) ──
// Devoluciones/descuentos en ventas, otros ingresos no operacionales y gastos pagados
// por fuera del turno (arriendo, nómina, impuestos, comisiones bancarias...).
// Nunca se borran: se anulan (estado = 'anulado') para conservar la trazabilidad.
export const movimientosContables = pgTable(
	'movimientos_contables',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(),
		tipo: text('tipo').notNull(), // 'devolucion' | 'descuento' | 'otro_ingreso' | 'gasto'
		categoria: text('categoria'), // solo para tipo 'gasto' (ver CATEGORIAS_GASTO)
		descripcion: text('descripcion').notNull(),
		monto: numeric('monto', { precision: 14, scale: 2 }).notNull(),
		fecha: timestamp('fecha').notNull(), // mediodía (Colombia) del día de negocio al que pertenece
		estado: text('estado').notNull().default('confirmado'), // 'confirmado' | 'anulado'
		usuarioId: integer('usuario_id').references(() => usuarios.id),
		anuladoPor: integer('anulado_por').references(() => usuarios.id),
		anuladoEn: timestamp('anulado_en'),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [index('movimientos_contables_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);

/**
 * Tabla de la versión mono-restaurante. Ya no se usa (la reemplaza
 * suscripciones_modulo); se conserva hasta confirmar la migración en producción.
 * @deprecated
 */
export const saasSuscripciones = pgTable('saas_suscripciones', {
	id: serial('id').primaryKey(),
	planCodigo: text('plan_codigo').notNull().default('pro'),
	planNombre: text('plan_nombre').notNull().default('Pro Gastronómico'),
	montoMensual: numeric('monto_mensual', { precision: 10, scale: 2 }).notNull().default('69000'),
	cicloFacturacion: text('ciclo_facturacion').notNull().default('mensual'),
	estado: text('estado').notNull().default('activo'),
	diasRestantes: integer('dias_restantes').default(30),
	fechaRenovacion: timestamp('fecha_renovacion'),
	limiteUsuarios: integer('limite_usuarios').default(3),
	soporteWhatsApp: boolean('soporte_whatsapp').default(true),
	antiFraudeActivo: boolean('antifraude_activo').default(true),
	actualizadoEn: timestamp('actualizado_en').defaultNow()
});
