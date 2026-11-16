# 12. Historial de cambios

Qué cambiamos, por qué y dónde quedó. Hay dos grandes entregas, cada una con su commit en GitHub.

---

## Entrega 1 — Estado de Resultados + endurecimiento del código

**Commit `8416f0c`** · rama `feat/estado-resultados`

### Nuevo: módulo Estado de Resultados (`/finanzas/estado-resultados`)

- Cascada contable completa con márgenes ([página 6](06-funciones-del-producto.md#estado-de-resultados-add-on--finanzasestado-resultados)).
- **Dinero en centavos enteros** (`features/finance/domain/money.ts`): `toCents`, `parseMoneyInput` (formato colombiano), `centsToDecimalString`.
- Clasificación automática de gastos por concepto y reasignación manual (nueva columna `gastos.categoria`).
- Tabla `movimientos_contables` para arriendo, nómina, impuestos, devoluciones y otros ingresos; se **anulan**, nunca se borran.
- Comparativos (periodo anterior, año anterior), accesos rápidos de fecha, desglose (drill-down), KPIs, gráfico, exportación a PDF, Excel y CSV.

### Calidad y seguridad (con base en las guías _refactor-architecture_ y _production-readiness-audit_)

- **Freno de fuerza bruta** en el login (5 intentos / 15 min).
- Eliminado código muerto (`requireRole`, que además comparaba el rol sin normalizar), imports sin usar y consultas redundantes.
- **Navegación**: `resolve()` en enlaces y menús, helper `gotoWithQuery` para filtros (valores codificados).
- Svelte 5 idiomático: `$derived` editable en vez de `$state` + `$effect`.
- Scripts `.cjs` → ESM; caracteres invisibles corregidos en el generador de PDF.
- **ESLint pasó de 41 errores a 0.**

---

## Entrega 2 — SaaS multi-restaurante (Plan Core + módulos de pago)

**Commit `36d6a35`** · rama `feat/multitenant` (incluye la entrega 1)

### Por qué

El sistema era **de un solo restaurante**: ninguna tabla sabía de quién era cada dato, la configuración y la "suscripción" eran una sola fila, y la página `/saas/suscripcion` permitía **cambiarse de plan sin pagar**. Para venderlo como SaaS había que aislar clientes, controlar qué paga cada uno y cobrar.

### Base de datos

- **`tenant_id NOT NULL`** en las 21 tablas de negocio, con índices `(tenant_id, fecha)`.
- Unicidades **por restaurante**: usuarios `(tenant_id, lower(nombre))`, líneas `(tenant_id, codigo)` y una configuración por restaurante.
- Tablas de plataforma nuevas: `tenants`, `modulos_catalogo`, `suscripciones_modulo`, `pagos`, `solicitudes_modulo`, `platform_admins`, `platform_sesiones` y `auditoria_plataforma`, con restricciones `CHECK`.
- **`migrations/0001_multitenant.sql`** + **runner con historial y checksum** (`scripts/migrate.mjs`), que reemplaza a los scripts sueltos. Crea el restaurante #1 con todos los datos existentes y le activa Core + add-ons por 30 días.

### Aislamiento

- `src/lib/server/tenancy.ts`: `tenantDe(locals)` y `delTenant(tabla, tid, ...)`.
- **~180 consultas** de 25 archivos refactorizadas; las acciones que reciben ids verifican la propiedad (404).
- Prueba de aislamiento con Postgres real y dos restaurantes (17 páginas y 18 acciones).

### Planes y módulos

- `src/lib/modules/registry.ts`: registro plug-and-play y regla de acceso única para servidor y menú.
- El Estado de Resultados se movió a `src/lib/modules/estado-resultados/` como **módulo de referencia**.
- `hooks.server.ts`: rol → plan → módulo → solo lectura → suspendido.
- `src/lib/billing/`: dominio puro (vigencias, gracia, prorrateo) y casos de uso del servidor.
- Pantallas nuevas: `/facturacion`, `/modulos` y la **consola `/plataforma`** (restaurantes, alta, ficha con pagos y módulos, catálogo, MRR y auditoría). Se eliminó `/saas/suscripcion`.
- Banner de plan (por vencer, gracia, solo lectura, suspendido) y candados 🔒 en el menú.

### Login y sesiones

- **Código de restaurante** + usuario + contraseña; usuarios únicos por restaurante.
- Hash señuelo (tiempo de respuesta constante) y mensaje de error único.
- Sesiones de la consola separadas (cookie `/plataforma`, SameSite=Strict, 12 h).

### Robustez

- **Cierre de turno 100 % atómico**: se reserva el id con `nextval` y todo va en un solo lote (antes insertaba el turno y luego un lote aparte con borrado "compensatorio").
- Los scripts `seed`, `reset-counts`, `seed-4dias` y `demo-data` exigen `--tenant` (y `--confirmar` si borran). **Antes borraban tablas completas**: con varios clientes habrían borrado a todos.

### Operación

- Dockerfile: **Node 22**, pnpm fijado, solo dependencias de producción, **sin root**, `HEALTHCHECK`.
- `GET /health`.
- **CI en GitHub Actions** con control de consultas sin filtro de restaurante.
- `.env.example` con las variables de cobro; scripts `db:migrate`, `db:migrate:estado` y `plataforma:admin`; README reescrito.

### Resultado medible

|                         | Antes                   | Después                                         |
| ----------------------- | ----------------------- | ----------------------------------------------- |
| Pruebas                 | 30                      | **131**                                         |
| Errores de ESLint       | 41                      | **0**                                           |
| Errores de tipos        | 0                       | 0                                               |
| Restaurantes soportados | 1                       | Ilimitados (misma base)                         |
| Cobro                   | Cambio de plan sin pago | Vigencias, gracia, pagos, prorrateo y auditoría |

---

## Entrega 3 — Funciones exclusivas por restaurante

**El modelo:** esqueleto igual para todos + funciones hechas a pedido que son **solo** del restaurante que las pidió.

- `registry.ts`: lista `EXCLUSIVOS` con `exclusivoDe`. Para cualquier otro restaurante, su ruta `/m/<codigo>` responde **404** (vista y POST), no aparece en el menú ni en el catálogo.
- Menú dinámico **"Hecho para ti"**, visible solo para el dueño (con 🔒 si la función venció → Facturación).
- `migrations/0002_modulos_exclusivos.sql`: columna `modulos_catalogo.exclusivo_tenant_id`, un CHECK (un exclusivo no puede ser público ni Core) y un **trigger** que impide suscribir a otro restaurante, incluso por SQL.
- La consola solo ofrece cada exclusivo en la ficha de su dueño (★) y `activarModulo()` lo rechaza para otro restaurante. El catálogo muestra de quién es cada uno.
- **Generador `pnpm modulo:nuevo`**: crea la ficha, el servidor, la página, la migración y la entrada del registro, formateados y listos para programar.
- `0001` ahora solo activa el Core y los módulos públicos al restaurante fundador.
- La prueba de migraciones aplica **todas** las migraciones en orden. Pruebas nuevas de exclusividad en `billing.test.ts` y `migration.test.ts` (**138 pruebas** en total).

## Entrega 4 — Auditoría integral: seguridad, integridad y resiliencia

**Rama `auditoria/endurecimiento`** · commits `6d4a8ba`, `346496a`, `7131e15`, `0fae79a`, `143a064` · detalle completo en [página 14](14-auditoria-2026-11.md)

### Seguridad

- **Crítico corregido:** una URL con `%` codificados (`/pl%61taforma`) saltaba la consola de plataforma y dejaba a cualquier Jefe ver todos los restaurantes; `/finanzas/re%73umen` saltaba el cobro de módulos. El hook ahora decide sobre la ruta decodificada y `route.id`, y cada ruta vuelve a exigir admin o módulo (`guards.ts`).
- El hash de la contraseña ya no viaja al navegador.
- Freno de login en Postgres (atómico, por ip+cuenta, cuenta e ip), segundo factor TOTP para la consola, caducidad absoluta de sesiones (90 días) y caché de 5 s.
- CSP con nonce, HSTS, Permissions-Policy, COOP y `X-Frame-Options: DENY`.

### Integridad de datos (`0003_integridad_y_seguridad.sql`)

- Cierre de turno idempotente, stock por delta y por id, compras de bodega atómicas, comprobantes Nequi únicos en todo el historial, un cierre de caja por día, una solicitud pendiente por módulo, insumos sin nombres repetidos, pagos con bloqueo optimista.
- Cantidades `real` → `numeric(12,3)`; dinero `numeric(10,2)` → `numeric(14,2)`; índices por turno, usuario y producto.

### Resiliencia y observabilidad

- `handleError` con código de soporte, logger JSON, `protegerAcciones()` en las form actions, timeout por consulta y `/health` acotado.

### Migraciones, CI y limpieza

- `0000_base.sql` (base nueva desde cero), runner con candado y checksum independiente de CRLF/LF.
- Eliminados `drizzle/`, `migrate_tables.mjs`, `stress_test.mjs` y `scripts/migrate-*.mjs`.
- Scripts de datos con contraseña aleatoria y bloqueo en producción. Nuevo `pnpm plataforma:totp`.
- CI con `pnpm audit`, cobertura y escaneo de credenciales; Dependabot.

### Rendimiento

- Reportes acotados a 366 días, cargas del cierre en paralelo, historial de turnos en su propio componente, consultas de derechos en paralelo.

|                                            | Antes                    | Después               |
| ------------------------------------------ | ------------------------ | --------------------- |
| Pruebas                                    | 138                      | **170**               |
| Hallazgos críticos abiertos                | 1                        | **0**                 |
| Migraciones necesarias para una base nueva | 4 scripts sueltos + 0001 | **`pnpm db:migrate`** |

## Pendiente de salida a producción

Estado verificado el 16-11-2026 (`pnpm db:migrate:estado` contra producción):

- [x] `0001` y `0002` aplicadas.
- [x] Respaldo completo antes de `0003`: `respaldos/respaldo-produccion-antes-0003-20261116-1916.json` (fuera del repo).
- [ ] Branch de respaldo en Neon.
- [ ] Aplicar `0000` (no hace nada en producción) y `0003`, y **en la misma ventana** unir `auditoria/endurecimiento` a `main` para que Vercel despliegue el código nuevo. El código viejo no es compatible con los tipos de `0003`, y el nuevo necesita sus tablas.
- [ ] **Crear el primer operador de la consola** (hoy no hay ninguno): `pnpm plataforma:admin <correo> "<Nombre>" --totp`, probarlo con `pnpm plataforma:totp --probar` y luego `PLATFORM_REQUIRE_TOTP=1` en Vercel.
- [ ] Actualizar dependencias (`xlsx` desde el CDN de SheetJS, quitar `adapter-auto`) y planificar Kit 3 ([página 14](14-auditoria-2026-11.md#pendiente-requiere-decisión-o-acción-manual)).
