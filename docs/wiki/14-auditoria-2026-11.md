# 14. Auditoría de noviembre 2026 — qué se corrigió y qué queda

Rama `auditoria/endurecimiento`. Auditoría completa de seguridad, datos, rendimiento y arquitectura, y su implementación por bloques.

---

## Bloque 1 — Seguridad urgente

| Hallazgo                                                                                                                        | Corrección                                                                                                                                              | Dónde                                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Crítico.** `/pl%61taforma/__data.json` saltaba la consola de plataforma: cualquier Jefe veía datos de todos los restaurantes. | El hook decide sobre la ruta **decodificada** (la misma que enruta SvelteKit) y sobre `route.id`. Cada load/acción de plataforma vuelve a exigir admin. | `hooks.server.ts`, `auth/access.ts#rutaCanonica`, `server/guards.ts` |
| **Alto.** `/finanzas/re%73umen` usaba módulos de pago sin contratarlos.                                                         | Misma corrección + `exigirModulo()` dentro de cada add-on (y en la plantilla de `pnpm modulo:nuevo`).                                                   | rutas de `finanzas/*`, `reportes/produccion`                         |
| El hash de la contraseña viajaba al navegador en todas las páginas.                                                             | `SessionUser` sin `passwordHash`; el layout envía solo `{ id, nombre, rol }`.                                                                           | `server/auth.ts`, `+layout.server.ts`                                |
| Freno de login en memoria (5 × N instancias, carrera, bloqueo de cuentas ajenas).                                               | Tabla `intentos_login`, UPSERT atómico **antes** de verificar, límites por ip+cuenta (5), cuenta (20) e ip (50).                                        | `server/login-throttle.ts`                                           |
| Consola de plataforma sin segundo factor.                                                                                       | TOTP opcional por admin (`pnpm plataforma:admin <correo> "<Nombre>" --totp`). Con `PLATFORM_REQUIRE_TOTP=1` es obligatorio.                             | `server/totp.ts`, `plataforma/login`                                 |
| Sin CSP/HSTS.                                                                                                                   | CSP con nonce (incluye el script de `app.html`), HSTS, Permissions-Policy, COOP, `X-Frame-Options: DENY`.                                               | `vite.config.ts`, `hooks.server.ts`                                  |
| Revocar un usuario tardaba hasta 60 s; sesiones eternas.                                                                        | Caché de sesión de 5 s (acotada); derechos 10 s; caducidad absoluta de 90 días.                                                                         | `server/auth.ts`, `server/tenancy.ts`                                |

## Bloque 2 — Integridad de datos (migración `0003`)

- **Cierre de turno idempotente:** el formulario lleva una `clave`; un doble envío devuelve el turno ya creado (`turnos_tenant_clave_uq`).
- **Stock por delta y por id:** el cierre descuenta lo usado en vez de fijar un valor (no se pierde una compra hecha mientras se cerraba) y ya no actualiza todos los productos `ILIKE 'Pizza%'`.
- **Compras de bodega** en una sola sentencia con `FOR UPDATE` (dos compras simultáneas suman las dos).
- **Comprobantes Nequi** en `referencias_pago` (PK por restaurante): se revisa todo el historial, no solo los últimos 2000 turnos.
- **Únicos:** un cierre de caja por día, una solicitud pendiente por módulo, insumos sin nombre repetido. Si producción ya tiene duplicados de insumos o cierres, la migración **avisa y omite** ese índice (no borra nada).
- **Pagos** con bloqueo optimista; cambio de estado + auditoría en un mismo lote.
- **Tipos:** cantidades `real` → `numeric(12,3)`; dinero `numeric(10,2)` → `numeric(14,2)`. Índices por turno, usuario, producto y auditoría.

## Bloque 3 — Resiliencia y observabilidad

- `handleError` con **id de soporte** visible en la página de error y log JSON con restaurante, usuario y ruta.
- Logger estructurado (`server/log.ts`, nivel con `LOG_LEVEL`).
- `protegerAcciones()`: un error inesperado en una acción vuelve como `fail(503/500)` con mensaje claro.
- Timeout por consulta a Neon (`DB_TIMEOUT_MS`, 10 s) y `/health` acotado a 2 s, con versión del build.
- `getBusinessConfig({ estricto: true })` en escrituras: ya no inventa una configuración si la base falla.

## Bloque 4 — Migraciones, CI y limpieza

- `0000_base.sql`: una base **vacía** se crea solo con `pnpm db:migrate` (test: base nueva = `schema.ts`).
- Runner con `pg_advisory_lock` y checksum independiente de CRLF/LF.
- Eliminados `drizzle/`, `migrate_tables.mjs`, `stress_test.mjs`, `scripts/migrate-*.mjs`.
- Scripts de datos: contraseña aleatoria (antes `password123`) y bloqueo en `NODE_ENV=production` salvo `--permitir-produccion`.
- CI: `pnpm audit` (crítico bloquea), cobertura, escaneo de credenciales, permisos mínimos. Dependabot semanal.

## Bloque 5 — Rendimiento y estructura (partes seguras)

- Reportes por fechas acotados a 366 días (`acotarRango`).
- Cierre de turno: una sola oleada de consultas en el load; historial extraído a `ShiftHistory.svelte`; la pantalla usa la misma función de dominio que el servidor para las porciones vendidas.
- Nombres especiales ("Masa", "Pizza%") en un solo lugar (`features/shifts/domain/products.ts`).
- Consola: agrupación O(T+S) de suscripciones; derechos con consultas en paralelo.

---

## Pendiente (requiere decisión o acción manual)

1. **Actualizar dependencias** (no se instalaron desde la sesión):
   ```bash
   pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz   # CVE-2023-30533, CVE-2024-22363
   pnpm remove @sveltejs/adapter-auto                               # no se usa
   rm package-lock.json                                             # el proyecto usa pnpm
   ```
   `@sveltejs/kit` solo corrige sus advisories en **3.x** (cambio mayor): planificarlo aparte con pruebas. Los dos más relevantes (redirección en `use:enhance` y XSS en páginas prerenderizadas) tienen exposición baja aquí: no hay páginas prerenderizadas ni remote functions.
2. **Aplicar `0003` en producción:** respaldo → `pnpm db:migrate:estado` → `pnpm db:migrate`. Revisar si aparece algún `WARNING` de duplicados.
3. **Proxy inverso (adapter-node):** definir `ADDRESS_HEADER=X-Forwarded-For` y `XFF_DEPTH=1` para que el freno de login vea la IP real.
4. **Activar TOTP** para cada admin y luego `PLATFORM_REQUIRE_TOTP=1`.
5. **Refactors grandes, a decidir:** pizza como una línea genérica más (migra datos reales), RLS de Postgres como segunda barrera, retirar `saas_suscripciones`, reorganizar carpetas `features/` y `modules/`.
