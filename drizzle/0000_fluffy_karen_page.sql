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
	"total_turnos" numeric(10, 2) DEFAULT '0',
	"total_gastos" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "cortes_semanales" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha_corte" timestamp DEFAULT now(),
	"total_calculado" numeric(10, 2) NOT NULL,
	"rango_inicio" timestamp,
	"rango_fin" timestamp
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" serial PRIMARY KEY NOT NULL,
	"descripcion" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "movimientos_bebidas" (
	"id" serial PRIMARY KEY NOT NULL,
	"bebida_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "movimientos_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" real NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_ruedas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_sabores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"precio_porcion" numeric(10, 2) DEFAULT '0',
	"precio_rueda" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "pizza_sobras" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
	"cantidad" real NOT NULL,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pizza_ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sabor_id" integer NOT NULL,
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
	"precio" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" serial PRIMARY KEY NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"descripcion" text,
	"fecha" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"rol" text DEFAULT 'empleado' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "movimientos_bebidas" ADD CONSTRAINT "movimientos_bebidas_bebida_id_bebidas_id_fk" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ruedas" ADD CONSTRAINT "pizza_ruedas_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_sobras" ADD CONSTRAINT "pizza_sobras_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pizza_ventas" ADD CONSTRAINT "pizza_ventas_sabor_id_pizza_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."pizza_sabores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;