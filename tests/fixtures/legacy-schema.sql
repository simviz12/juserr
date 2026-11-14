-- Esquema de PRODUCCIÓN anterior a migrations/0001_multitenant.sql (mono-restaurante).
-- Reproduce la base real: drizzle/0000 + migrate_tables + scripts/migrate-lineas-inventario
-- + scripts/migrate-estado-resultados (mismos nombres de restricciones e índices).
-- Lo usa tests/migration.test.ts para ensayar la migración. No editar.
CREATE TABLE "bebidas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"stock_actual" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cierres_dia" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp DEFAULT now(),
	"total_efectivo" numeric(10, 2) NOT NULL,
	"total_transferencias" numeric(10, 2) DEFAULT '0',
	"total_turnos" numeric(10, 2) DEFAULT '0',
	"total_gastos" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "cierres_linea" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer NOT NULL,
	"linea_id" integer NOT NULL,
	"producto_id" integer,
	"inicial" real NOT NULL,
	"sobrantes" real NOT NULL,
	"mermas" real DEFAULT 0 NOT NULL,
	"consumidas" real NOT NULL,
	"venta_esperada" numeric(12, 2) DEFAULT '0' NOT NULL,
	"desglose_completo" boolean DEFAULT false,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cortes_semanales" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha_corte" timestamp DEFAULT now(),
	"total_calculado" numeric(10, 2) NOT NULL,
	"total_real" numeric(10, 2),
	"efectivo_real" numeric(10, 2),
	"transferencias_reales" numeric(10, 2),
	"diferencia" numeric(10, 2),
	"rango_inicio" timestamp,
	"rango_fin" timestamp
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer,
	"descripcion" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha" timestamp DEFAULT now(),
	"categoria" text
);
--> statement-breakpoint
CREATE TABLE "items_linea" (
	"id" serial PRIMARY KEY NOT NULL,
	"linea_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"precio_venta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"precio_costo" numeric(10, 2) DEFAULT '0',
	"activo" boolean DEFAULT true,
	"unidades_control" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "lineas_gastronomicas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"icono" text DEFAULT 'UtensilsCrossed',
	"unidad_porcion" text DEFAULT 'unidad' NOT NULL,
	"precio_promedio" numeric(10, 2) DEFAULT '0',
	"activo" boolean DEFAULT true,
	"producto_control_id" integer,
	CONSTRAINT "lineas_gastronomicas_codigo_key" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "movimientos_bebidas" (
	"id" serial PRIMARY KEY NOT NULL,
	"bebida_id" integer NOT NULL,
	"usuario_id" integer,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "movimientos_contables" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text,
	"descripcion" text NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"fecha" timestamp NOT NULL,
	"estado" text DEFAULT 'confirmado' NOT NULL,
	"usuario_id" integer,
	"anulado_por" integer,
	"anulado_en" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "movimientos_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"usuario_id" integer,
	"tipo" text NOT NULL,
	"cantidad" real NOT NULL,
	"costo_unitario" numeric(10, 2) DEFAULT '0',
	"costo_total" numeric(10, 2) DEFAULT '0',
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_ruedas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
	"turno_id" integer,
	"cantidad" integer NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_sabores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"precio_porcion" numeric(10, 2) DEFAULT '0',
	"precio_rueda" numeric(10, 2) DEFAULT '0',
	"activo" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "pizza_sobras" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
	"turno_id" integer,
	"cantidad" real NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
	"turno_id" integer,
	"cantidad_vendida" real NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"categoria_id" integer,
	"unidad_medida" text NOT NULL,
	"stock_actual" real DEFAULT 0,
	"stock_minimo" real DEFAULT 5,
	"precio" numeric(10, 2) DEFAULT '0',
	"precio_costo" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "rubros_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_negocio" text DEFAULT 'Mi Gastro-Negocio' NOT NULL,
	"rubro_principal" text DEFAULT 'mixto' NOT NULL,
	"habilitar_pizzas" boolean DEFAULT true,
	"habilitar_chuzos" boolean DEFAULT true,
	"habilitar_hamburguesas" boolean DEFAULT true,
	"habilitar_lasanas" boolean DEFAULT true,
	"habilitar_carnes" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saas_suscripciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_codigo" text DEFAULT 'pro' NOT NULL,
	"plan_nombre" text DEFAULT 'Pro Gastronómico' NOT NULL,
	"monto_mensual" numeric(10, 2) DEFAULT '69000' NOT NULL,
	"ciclo_facturacion" text DEFAULT 'mensual' NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"dias_restantes" integer DEFAULT 30,
	"fecha_renovacion" timestamp,
	"limite_usuarios" integer DEFAULT 3,
	"soporte_whatsapp" boolean DEFAULT true,
	"antifraude_activo" boolean DEFAULT true,
	"actualizado_en" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacciones_turno" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer NOT NULL,
	"plataforma" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"referencias" text,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" serial PRIMARY KEY NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"transferencias" numeric(10, 2) DEFAULT '0',
	"descripcion" text,
	"fecha" timestamp DEFAULT now(),
	"masas_iniciales" real DEFAULT 0,
	"masas_sobrantes" real DEFAULT 0,
	"porciones_ayer" integer DEFAULT 0,
	"porciones_sobrantes" integer DEFAULT 0,
	"porciones_mermadas" integer DEFAULT 0,
	"porciones_vendidas_calculado" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" text DEFAULT 'empleado' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ventas_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"linea_id" integer NOT NULL,
	"cantidad" real NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"costo_unitario" numeric(10, 2) DEFAULT '0',
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cierres_linea" ADD CONSTRAINT "cierres_linea_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_linea" ADD CONSTRAINT "cierres_linea_linea_id_lineas_gastronomicas_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."lineas_gastronomicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_linea" ADD CONSTRAINT "cierres_linea_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_linea" ADD CONSTRAINT "items_linea_linea_id_lineas_gastronomicas_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."lineas_gastronomicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_gastronomicas" ADD CONSTRAINT "lineas_gastronomicas_producto_control_id_productos_id_fk" FOREIGN KEY ("producto_control_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_bebidas" ADD CONSTRAINT "movimientos_bebidas_bebida_id_bebidas_id_fk" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_bebidas" ADD CONSTRAINT "movimientos_bebidas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_anulado_por_usuarios_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ruedas" ADD CONSTRAINT "pizza_ruedas_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ruedas" ADD CONSTRAINT "pizza_ruedas_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_sobras" ADD CONSTRAINT "pizza_sobras_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_sobras" ADD CONSTRAINT "pizza_sobras_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ventas" ADD CONSTRAINT "pizza_ventas_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ventas" ADD CONSTRAINT "pizza_ventas_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones_turno" ADD CONSTRAINT "transacciones_turno_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_item_id_items_linea_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items_linea"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_linea_id_lineas_gastronomicas_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."lineas_gastronomicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_contables_fecha_idx" ON "movimientos_contables" USING btree ("fecha");
--> statement-breakpoint
CREATE INDEX "turnos_fecha_idx" ON "turnos" ("fecha");--> statement-breakpoint
CREATE INDEX "gastos_fecha_idx" ON "gastos" ("fecha");--> statement-breakpoint
CREATE INDEX "movimientos_inventario_fecha_idx" ON "movimientos_inventario" ("fecha");--> statement-breakpoint
CREATE INDEX "cierres_linea_turno_idx" ON "cierres_linea" ("turno_id");--> statement-breakpoint
CREATE INDEX "cierres_linea_fecha_idx" ON "cierres_linea" ("fecha");--> statement-breakpoint
CREATE INDEX "ventas_items_turno_idx" ON "ventas_items" ("turno_id");--> statement-breakpoint
CREATE INDEX "ventas_items_fecha_idx" ON "ventas_items" ("fecha");
