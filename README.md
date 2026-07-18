# Pizza System - Punto de Venta y Gestión

Sistema integral para gestión de inventario fraccionado, ventas de pizzas por porciones, cuadre de caja y reportes gerenciales.

## Tecnologías Utilizadas
- **Framework:** SvelteKit
- **Estilos:** TailwindCSS
- **Base de Datos:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM
- **Autenticación:** Lucia Auth con Argon2id

## Despliegue en Producción (Vercel)

Esta aplicación está optimizada para ser desplegada en Vercel. Sigue estos pasos:

### 1. Preparar la Base de Datos (Neon)
1. Crea una cuenta en [Neon.tech](https://neon.tech).
2. Crea un nuevo proyecto y obtén la **Cadena de Conexión (Connection String)** (Ej: `postgresql://user:password@ep-cool-breeze-123.us-east-2.aws.neon.tech/neondb?sslmode=require`).

### 2. Importar a Vercel
1. Sube este código a un repositorio en GitHub, GitLab o Bitbucket.
2. Inicia sesión en [Vercel](https://vercel.com) y haz clic en **Add New -> Project**.
3. Importa tu repositorio.
4. En la sección **Environment Variables**, debes configurar exactamente esta variable:
   - `DATABASE_URL`: Pega aquí la cadena de conexión que obtuviste en Neon.
5. Haz clic en **Deploy**.

### 3. Ejecutar Migraciones en Producción
Una vez que la aplicación esté corriendo, la base de datos estará vacía (sin tablas).
Debes ejecutar las migraciones de Drizzle apuntando a tu base de datos de producción:
1. En tu máquina local, clona tu repositorio.
2. Crea un archivo `.env` en la raíz (si no existe) y pon tu URL de producción: `DATABASE_URL=tu_url_de_neon`
3. Instala dependencias: `pnpm install`
4. Empuja el esquema: `pnpm drizzle-kit push`

### 4. Credenciales por Defecto
El sistema cuenta con un seeder básico. Si no tienes usuarios, deberás crear el jefe directamente en la base de datos o correr un script de seeder localmente antes de empezar a usar el sistema.

- **Rol Jefe:** Tiene acceso a los `/reportes/financiero` y `cortes semanales`.
- **Rol Empleado:** Acceso a ventas, turnos e inventario.

## Desarrollo Local

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm run dev
```

## Dockerización

Si prefieres ejecutar todo el sistema de manera aislada utilizando contenedores, el proyecto incluye configuración nativa para Docker.

```bash
# Construir e iniciar el contenedor en segundo plano (leerá tu .env)
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener el contenedor
docker-compose down
```
La aplicación estará disponible inmediatamente en `http://localhost:3000`.
