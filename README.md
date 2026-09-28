# 🍕 JuanchoPizza POS & ERP System

Sistema integral de Punto de Venta (POS), control de inventario de materia prima, auditoría de turnos, arqueo de caja con desglose digital (Nequi / Daviplata) y reportes gerenciales para pizzerías.

---

## 🏛️ Arquitectura de Software (Clean Architecture)

El sistema está diseñado siguiendo los principios de **Clean Architecture (Arquitectura Limpia)** y **Separación de Responsabilidades (SoC)**, adaptados a la arquitectura de pila completa de SvelteKit:

```
src/
├── lib/
│   ├── server/           # 📦 CAPA DE DATOS E INFRAESTRUCTURA
│   │   ├── schema.ts     # Entidades de dominio y esquemas relacionales (Drizzle ORM)
│   │   ├── db.ts         # Adaptador de conexión a Base de Datos (Neon Serverless PostgreSQL)
│   │   ├── auth.ts       # Casos de uso de autenticación, sesiones y caché en memoria
│   │   └── seed.ts       # Semilla de aprovisionamiento de datos iniciales
│   └── utils/            # ⚙️ CAPA DE DOMINIO Y LÓGICA DE NEGOCIO PURA
│       ├── fractions.ts  # Reglas de negocio para inventario fraccionado (1 masa = 8 porciones)
│       └── date.ts       # Cálculos de rangos temporales (Día, Semana, Mes, Año)
└── routes/               # 🖥️ CAPA DE PRESENTACIÓN Y CONTROLADORES
    ├── +layout.svelte    # Shell de la aplicación, navegación por roles e hidratación SPA
    ├── dashboard/        # Métricas ejecutivas, KPIs, ventas agregadas y top productos
    ├── turnos/cierre/    # Arqueo de caja física, transferencias, mermas y balance
    ├── bodega/           # Entrada de insumos (Sumar) vs Conteo físico real (Sobreescribir)
    ├── finanzas/         # Resumen consolidado, histórico de caja, cortes semanales y exportación PDF
    ├── productos/        # Catálogo maestro de insumos y stock mínimo
    ├── configuracion/    # Gestión de colaboradores y catálogo de sabores
    └── login/ / logout/  # Control de acceso basado en roles (RBAC)
```

### Principios aplicados:
1. **Reglas de Negocio Desacopladas (`src/lib/utils`)**: Los cálculos matemáticos del rendimiento de masa, porciones sobrantes, mermas de pizzas quemadas y conversión fraccionada son funciones puras e independientes de la base de datos o la interfaz.
2. **Control de Acceso Basado en Roles (RBAC en `hooks.server.ts`)**: Las rutas y acciones están protegidas por middleware a nivel de servidor (`jefe`, `cajero`, `bodeguero`, `empleado`).
3. **Caché y Optimización de Consultas**:
   - **Eliminación de N+1**: Consultas de turnos, transacciones y gastos agrupadas en lote (`inArray`) en memoria.
   - **Sesiones en memoria (In-Memory Session Cache)**: Validación de sesiones con TTL de 60 segundos para evitar consultas redundantes a la base de datos en cada navegación.
   - **Consultas concurrentes**: Paralelismo con `Promise.all` para tiempos de carga inferiores a 200 ms.

---

## 🚀 Tecnologías Principales

- **Framework:** [SvelteKit 2](https://kit.svelte.dev/) con **Svelte 5** (Runes reactivos: `$state`, `$derived`, `$props`).
- **Lenguaje:** [TypeScript 5](https://www.typescriptlang.org/) con tipado estricto.
- **Estilos y UI:** [TailwindCSS 4](https://tailwindcss.com/) con diseño adaptado a pantallas táctiles y escritorios.
- **Base de Datos:** [PostgreSQL en Neon Serverless](https://neon.tech/).
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/).
- **Seguridad:** Hash con [Argon2id](https://github.com/napi-rs/node-rs) y tokens criptográficos SHA-256.
- **Reportes:** Generación de PDFs ejecutivos en cliente con `jspdf` y `jspdf-autotable`.
- **Contenedores:** Docker (Multi-stage build ultraliviano con Node.js 20 Alpine).

---

## 🍕 Módulos del Sistema

### 1. Cierre de Turno y Cuadre de Caja (`/turnos/cierre`)
- **Fórmula de Auditoría:** `Porciones Vendidas = (Masas Usadas × 8) + Porciones Ayer - Porciones Sobrantes - Porciones Quemadas (Merma)`.
- **Desglose Multicanal:** Registro de efectivo físico en cajón, Nequi, Daviplata y gastos operativos del turno.
- **Semáforo de Balance:** Alerta inmediata de caja cuadrada (verde), sobrante (azul) o faltante injustificado (rojo).

### 2. Bodega e Insumos (`/bodega`)
- **Modo Compra (Sumar):** Incrementa el stock al recibir pedidos de proveedores y recalcula el costo unitario.
- **Modo Conteo Físico (Sobreescribir):** Ajuste de inventario real tras auditoría en estante o nevera sin recargas de página ni saltos de UI.

### 3. Dashboard Gerencial (`/dashboard`)
- Filtros rápidos: **Hoy (Día)**, **Esta Semana**, **Este Mes** y **Este Año**, además de selector de fecha específica.
- Gráficas de mermas, productos bajo stock mínimo y ranking de sabores más vendidos.

### 4. Finanzas y Exportación (`/finanzas/resumen`)
- Utilidad neta real (Ventas Brutas - Gastos).
- Historial día por día con exportación directa a **informe en PDF**.

---

## 🛠️ Despliegue en Producción

### Opción A: Despliegue 100% Gratuito en Vercel (Recomendado)
El proyecto cuenta con un adaptador híbrido (`@sveltejs/adapter-vercel` + `@sveltejs/adapter-node`) que detecta automáticamente Vercel en la nube.

1. Sube este repositorio a tu cuenta de GitHub.
2. Ingresa a [Vercel](https://vercel.com) y dale a **Add New...** > **Project**.
3. Importa el repositorio `juserr`.
4. En **Environment Variables**, agrega:
   - `DATABASE_URL`: Tu cadena de conexión de Neon PostgreSQL.
5. Clic en **Deploy**. El sitio quedará disponible 24/7 sin suspenderse.

### Opción B: Despliegue con Docker
El proyecto incluye un `Dockerfile` optimizado en 2 etapas:

```bash
# Construir la imagen
docker build -t juancho-pizza .

# Ejecutar el contenedor
docker run -d -p 3000:3000 --env-file .env --restart always --name juancho-pizza juancho-pizza
```

---

## 💻 Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/simviz12/juserr.git
cd juserr

# 2. Instalar dependencias
pnpm install # o npm install

# 3. Configurar variables de entorno (.env)
DATABASE_URL="postgresql://usuario:password@host/neondb?sslmode=require"

# 4. Iniciar servidor de desarrollo
npm run dev
```

---

## 👥 Roles y Permisos de Usuario

| Rol | Dashboard | Cierre Turno | Bodega | Finanzas | Catálogos |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Jefe (Admin)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cajero / Empleado** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Bodeguero** | ❌ | ✅ | ✅ | ❌ | ❌ |
