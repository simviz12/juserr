const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Creando tablas en Neon PostgreSQL...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS lineas_gastronomicas (
      id serial PRIMARY KEY,
      codigo text NOT NULL UNIQUE,
      nombre text NOT NULL,
      icono text DEFAULT 'UtensilsCrossed',
      unidad_porcion text DEFAULT 'unidad' NOT NULL,
      precio_promedio numeric(10, 2) DEFAULT '0',
      activo boolean DEFAULT true
    );
  `;
  console.log('✓ lineas_gastronomicas OK');

  await sql`
    CREATE TABLE IF NOT EXISTS items_linea (
      id serial PRIMARY KEY,
      linea_id integer REFERENCES lineas_gastronomicas(id),
      nombre text NOT NULL,
      precio_venta numeric(10, 2) DEFAULT '0' NOT NULL,
      precio_costo numeric(10, 2) DEFAULT '0',
      activo boolean DEFAULT true
    );
  `;
  console.log('✓ items_linea OK');

  await sql`
    CREATE TABLE IF NOT EXISTS rubros_config (
      id serial PRIMARY KEY,
      nombre_negocio text DEFAULT 'Mi Gastro-Negocio' NOT NULL,
      rubro_principal text DEFAULT 'mixto' NOT NULL,
      habilitar_pizzas boolean DEFAULT true,
      habilitar_chuzos boolean DEFAULT true,
      habilitar_hamburguesas boolean DEFAULT true,
      habilitar_lasanas boolean DEFAULT true,
      habilitar_carnes boolean DEFAULT true,
      created_at timestamp DEFAULT now()
    );
  `;
  console.log('✓ rubros_config OK');

  await sql`
    CREATE TABLE IF NOT EXISTS saas_suscripciones (
      id serial PRIMARY KEY,
      plan_codigo text DEFAULT 'pro' NOT NULL,
      plan_nombre text DEFAULT 'Pro Gastronómico' NOT NULL,
      monto_mensual numeric(10, 2) DEFAULT '69000' NOT NULL,
      ciclo_facturacion text DEFAULT 'mensual' NOT NULL,
      estado text DEFAULT 'activo' NOT NULL,
      dias_restantes integer DEFAULT 30,
      fecha_renovacion timestamp,
      limite_usuarios integer DEFAULT 3,
      soporte_whatsapp boolean DEFAULT true,
      antifraude_activo boolean DEFAULT true,
      actualizado_en timestamp DEFAULT now()
    );
  `;
  console.log('✓ saas_suscripciones OK');
  console.log('Todas las tablas multi-rubro y saas fueron creadas con éxito.');
}

run().catch(err => {
  console.error('Error al migrar tablas:', err);
  process.exit(1);
});
