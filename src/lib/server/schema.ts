import { pgTable, serial, text, integer, timestamp, numeric, boolean, real } from 'drizzle-orm/pg-core';

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  passwordHash: text('password_hash').notNull(),
  rol: text('rol').notNull().default('empleado'), // empleado, jefe
  createdAt: timestamp('created_at').defaultNow(),
});

export const sesiones = pgTable('sesiones', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usuarios.id),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
});

export const productos = pgTable('productos', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  categoriaId: integer('categoria_id').references(() => categorias.id),
  unidadMedida: text('unidad_medida').notNull(), // fraccion, unidad, pechuga
  stockActual: real('stock_actual').default(0),
  stockMinimo: real('stock_minimo').default(5),
  precio: numeric('precio', { precision: 10, scale: 2 }).default('0'),
});

export const movimientosInventario = pgTable('movimientos_inventario', {
  id: serial('id').primaryKey(),
  productoId: integer('producto_id').references(() => productos.id).notNull(),
  usuarioId: integer('usuario_id').references(() => usuarios.id), // Permite null por si hay movimientos antiguos
  tipo: text('tipo').notNull(), // entrada, salida, ajuste
  cantidad: real('cantidad').notNull(),
  fecha: timestamp('fecha').defaultNow(),
});

export const bebidas = pgTable('bebidas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
  stockActual: integer('stock_actual').default(0),
});

export const movimientosBebidas = pgTable('movimientos_bebidas', {
  id: serial('id').primaryKey(),
  bebidaId: integer('bebida_id').references(() => bebidas.id).notNull(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  tipo: text('tipo').notNull(), // entrada, salida, venta
  cantidad: integer('cantidad').notNull(),
  fecha: timestamp('fecha').defaultNow(),
});

export const pizzaSabores = pgTable('pizza_sabores', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  precioPorcion: numeric('precio_porcion', { precision: 10, scale: 2 }).default('0'),
  precioRueda: numeric('precio_rueda', { precision: 10, scale: 2 }).default('0'),
  activo: boolean('activo').default(true),
});

export const pizzaRuedas = pgTable('pizza_ruedas', {
  id: serial('id').primaryKey(),
  saborId: integer('sabor_id').references(() => pizzaSabores.id).notNull(),
  cantidad: integer('cantidad').notNull(),
  fecha: timestamp('fecha').defaultNow(),
});

export const pizzaSobras = pgTable('pizza_sobras', {
  id: serial('id').primaryKey(),
  saborId: integer('sabor_id').references(() => pizzaSabores.id).notNull(),
  cantidad: real('cantidad').notNull(), // Puede sobrar media pizza
  fecha: timestamp('fecha').defaultNow(),
});

export const pizzaVentas = pgTable('pizza_ventas', {
  id: serial('id').primaryKey(),
  saborId: integer('sabor_id').references(() => pizzaSabores.id).notNull(),
  cantidadVendida: real('cantidad_vendida').notNull(),
  fecha: timestamp('fecha').defaultNow(),
});

export const turnos = pgTable('turnos', {
  id: serial('id').primaryKey(),
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  transferencias: numeric('transferencias', { precision: 10, scale: 2 }).default('0'),
  descripcion: text('descripcion'),
  fecha: timestamp('fecha').defaultNow(),
});

export const gastos = pgTable('gastos', {
  id: serial('id').primaryKey(),
  turnoId: integer('turno_id').references(() => turnos.id),
  descripcion: text('descripcion').notNull(),
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  fecha: timestamp('fecha').defaultNow(),
});

export const cierresDia = pgTable('cierres_dia', {
  id: serial('id').primaryKey(),
  fecha: timestamp('fecha').defaultNow(),
  totalEfectivo: numeric('total_efectivo', { precision: 10, scale: 2 }).notNull(),
  totalTransferencias: numeric('total_transferencias', { precision: 10, scale: 2 }).default('0'),
  totalTurnos: numeric('total_turnos', { precision: 10, scale: 2 }).default('0'),
  totalGastos: numeric('total_gastos', { precision: 10, scale: 2 }).default('0'),
});

export const cortesSemanales = pgTable('cortes_semanales', {
  id: serial('id').primaryKey(),
  fechaCorte: timestamp('fecha_corte').defaultNow(),
  totalCalculado: numeric('total_calculado', { precision: 10, scale: 2 }).notNull(),
  totalReal: numeric('total_real', { precision: 10, scale: 2 }),
  efectivoReal: numeric('efectivo_real', { precision: 10, scale: 2 }),
  transferenciasReales: numeric('transferencias_reales', { precision: 10, scale: 2 }),
  diferencia: numeric('diferencia', { precision: 10, scale: 2 }),
  rangoInicio: timestamp('rango_inicio'),
  rangoFin: timestamp('rango_fin'),
});
