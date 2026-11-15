# 2. Arquitectura

## Stack

| Pieza         | Tecnología                                                            | Para qué                                                                    |
| ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Framework     | **SvelteKit 2** + **Svelte 5** (runes `$state`, `$derived`, `$props`) | Páginas, servidor y API en un solo proyecto                                 |
| Lenguaje      | TypeScript estricto                                                   | Errores detectados al compilar (p. ej. un insert sin `tenantId` no compila) |
| Estilos       | TailwindCSS 4 + tokens CSS (modo claro/oscuro)                        | UI consistente                                                              |
| Base de datos | PostgreSQL en **Neon** (driver HTTP serverless)                       | Datos de todos los restaurantes                                             |
| ORM           | **Drizzle**                                                           | Consultas tipadas, esquema en código (`schema.ts`)                          |
| Seguridad     | Argon2id (contraseñas), SHA-256 (sesiones)                            | Autenticación                                                               |
| Reportes      | jsPDF + jspdf-autotable, SheetJS (xlsx)                               | PDF y Excel en el navegador                                                 |
| Gráficos      | Chart.js                                                              | Flujo de caja, comparativos                                                 |
| Pruebas       | Vitest + **PGlite** (Postgres real embebido)                          | Unitarias, aislamiento, ensayo de migraciones                               |
| Despliegue    | Docker (Node 22 Alpine) / Vercel                                      | Ver [página 10](10-despliegue-aws.md)                                       |

## Estructura de carpetas

```
juserr/
├── src/
│   ├── hooks.server.ts              ← PORTERO: toda petición pasa por aquí
│   ├── app.d.ts                     ← Tipos de locals (user, tenant, entitlements, platformAdmin)
│   ├── lib/
│   │   ├── auth/access.ts           ← Política de roles (isomórfica: servidor + menú)
│   │   ├── server/                  ← SOLO servidor (nunca llega al navegador)
│   │   │   ├── db.ts                ← Conexión a Postgres
│   │   │   ├── schema.ts            ← Todas las tablas
│   │   │   ├── tenancy.ts           ← tenantDe() / delTenant() / derechosDe()
│   │   │   ├── auth.ts              ← Sesiones de restaurante
│   │   │   ├── platform-auth.ts     ← Sesiones de la consola del dueño
│   │   │   ├── login-throttle.ts    ← Freno de fuerza bruta
│   │   │   ├── seed*.ts, reset-counts.ts, scripts/tenant-cli.ts  ← Scripts por restaurante
│   │   ├── modules/
│   │   │   ├── registry.ts          ← Qué rutas pertenecen a qué módulo + regla de acceso
│   │   │   └── estado-resultados/   ← Add-on de referencia (dominio, servidor, componentes)
│   │   ├── billing/
│   │   │   ├── domain.ts            ← Reglas de cobro puras (vigencia, gracia, prorrateo)
│   │   │   └── server.ts            ← Pagos, activaciones, alta de restaurantes
│   │   ├── features/                ← CORE por dominio
│   │   │   ├── finance/             ← dinero (money.ts), periodos, métricas, dashboard, PDF
│   │   │   ├── shifts/              ← cierre de turno (dominio puro + acción del servidor)
│   │   │   └── business/            ← configuración del negocio y líneas gastronómicas
│   │   ├── components/              ← UI reutilizable (Card, Badge, DataTable, gráficos…)
│   │   └── utils/                   ← formato, fracciones, exportación, navegación
│   └── routes/                      ← PÁGINAS (cada carpeta = una URL)
│       ├── login/ logout/           ← Entrada de restaurantes
│       ├── dashboard/ turnos/ bodega/ productos/ configuracion/ finanzas/caja   ← CORE
│       ├── finanzas/{resumen,semanal,mensual,estado-resultados}, reportes/produccion  ← ADD-ONS
│       ├── facturacion/ modulos/    ← El restaurante ve su plan y pide módulos
│       ├── plataforma/              ← Consola del dueño (login propio)
│       └── health/                  ← Sonda de salud para AWS
├── migrations/                      ← SQL versionado (0001_multitenant.sql…)
├── scripts/                         ← migrate.mjs, create-platform-admin.mjs, demo-data.mjs
├── tests/                           ← Vitest (unitarias, aislamiento, migración)
├── docs/wiki/                       ← Esta wiki
├── Dockerfile · .github/workflows/ci.yml
```

## Principios de diseño (y por qué)

1. **Dominio puro separado de la infraestructura.** Las reglas de negocio (cuánto se vendió, cuánto se debe cobrar, la cascada contable) viven en archivos `domain/*.ts` que no conocen la base de datos ni la interfaz. Se prueban en milisegundos y no cambian si mañana cambias de base de datos.
   - Ejemplos: `features/shifts/domain/close-shift.ts`, `billing/domain.ts`, `modules/estado-resultados/domain/income-statement.ts`.
2. **Un solo portero.** Toda decisión de acceso pasa por `hooks.server.ts`. Las páginas no tienen que acordarse de verificar permisos (aunque las acciones sensibles vuelven a verificar como defensa en profundidad).
3. **La misma regla en servidor y en pantalla.** `evaluarAcceso()` (registry) y `canAccess()` (roles) se usan en el servidor para bloquear y en el menú para mostrar candados. Nunca hay un enlace visible que luego redirige.
4. **El tenant sale de la sesión, nunca del formulario.** Ver [página 4](04-multi-restaurante-y-seguridad.md).
5. **Dinero en centavos enteros.** `0.1 + 0.2 ≠ 0.3` en coma flotante; en centavos `10 + 20 = 30` siempre. Ver `features/finance/domain/money.ts`.
6. **Escrituras atómicas.** El cierre de turno, la compra de bodega, el alta de un restaurante y un pago se guardan en **un solo lote**: o todo o nada.
7. **Módulos desacoplados.** Un add-on solo importa del Core; el Core nunca importa de un add-on. Así puedes mejorar el Core para todos sin romper desarrollos a medida.

## Recorrido de una petición (de punta a punta)

Ejemplo: el cajero del restaurante B pulsa **"Guardar y cerrar turno"**.

```
Navegador ──POST /turnos/cierre──►  hooks.server.ts
                                     │
   1. Lee la cookie "session" ──────►│ validateSessionToken()  (auth.ts)
                                     │   · busca la sesión por SHA-256 del token
                                     │   · une usuario + restaurante (rechaza si el restaurante está cancelado)
                                     │   · caché en memoria 60 s
   2. ¿Ruta pública? (/login, /health) → no
   3. ¿Hay usuario? → sí
   4. Rol: canAccess('cajero', '/turnos/cierre') → permitido
   5. Plan: derechosDe(tenantId)    (tenancy.ts, caché 30 s)
   │      → calcularEntitlements()   (billing/domain.ts)
   │      → { estadoCore: 'al-dia', modulos: [...] }
   6. evaluarAcceso(ruta, plan, escritura=true)   (modules/registry.ts)
   │      · ¿es ruta de un add-on no pagado? → redirige a /modulos
   │      · ¿Core en solo lectura y es escritura? → redirige a /facturacion
   │      · ¿suspendido? → redirige a /facturacion
   ▼
routes/turnos/cierre/+page.server.ts  →  actions.default = closeShiftAction
   │
   ▼
features/shifts/server/close-shift.action.ts
   · tid = tenantDe(locals)                 ← el restaurante SALE DE LA SESIÓN
   · valida dinero, antifraude de comprobantes Nequi repetidos (solo de ese restaurante)
   · lee masas/porciones de bodega de ESE restaurante (nunca del formulario)
   · calcula vendidas con las reglas puras (domain/close-shift.ts, domain/line-close.ts)
   · reserva el id del turno (nextval) y guarda TODO en un solo db.batch():
       turno + stock + Nequi + gastos + ruedas/sobras/ventas por sabor + cierres por línea + platos
   ▼
Respuesta { success, message } → la página muestra el resultado y el reporte para WhatsApp
```

Las lecturas (`load`) siguen el mismo camino; la diferencia es que en el paso 6 `escritura=false`, por eso un restaurante en solo lectura **sí** puede ver y exportar.

## Dos "mundos" de usuarios

|        | Usuarios de restaurante                  | Operadores de plataforma (tú)                              |
| ------ | ---------------------------------------- | ---------------------------------------------------------- |
| Tabla  | `usuarios` (con `tenant_id`)             | `platform_admins`                                          |
| Login  | `/login` (código + usuario + contraseña) | `/plataforma/login` (correo + contraseña)                  |
| Cookie | `session` (30 días, todo el sitio)       | `psession` (12 horas, solo `/plataforma`, SameSite=Strict) |
| Ven    | Solo su restaurante                      | Todos los restaurantes (datos comerciales, no operativos)  |

Están separados a propósito: comprometer una cuenta de restaurante nunca da acceso a la consola.

## Cachés en memoria (importante para escalar)

| Caché           | Dónde               | Duración | Efecto                                                                                                                           |
| --------------- | ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sesiones        | `auth.ts`           | 60 s     | Un usuario borrado o con rol cambiado se invalida al instante en la instancia que hizo el cambio; en otras instancias hasta 60 s |
| Derechos (plan) | `tenancy.ts`        | 30 s     | Un pago se refleja al instante en la instancia de la consola y en ≤30 s en las demás                                             |
| Freno de login  | `login-throttle.ts` | 15 min   | Cada instancia cuenta sus propios intentos                                                                                       |

Con **1–2 instancias** esto es perfecto. Si creces a muchas instancias, mueve estas cachés a Redis (ElastiCache). Está en el roadmap ([página 11](11-checklist-salida-y-venta.md)).
