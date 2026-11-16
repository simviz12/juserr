# 8. Pruebas y calidad

## El comando que lo verifica todo

```bash
pnpm lint && pnpm check && pnpm vitest run && pnpm build
```

| Paso              | Herramienta               | Qué detecta                                                                |
| ----------------- | ------------------------- | -------------------------------------------------------------------------- |
| `pnpm lint`       | Prettier + ESLint         | Formato, código muerto, malas prácticas de Svelte, enlaces sin `resolve()` |
| `pnpm check`      | svelte-check (TypeScript) | Errores de tipos; por ejemplo, un insert sin `tenantId`                    |
| `pnpm vitest run` | Vitest                    | Las ~170 pruebas (ver abajo)                                               |
| `pnpm build`      | Vite / SvelteKit          | Que la app compile para producción                                         |

El **CI** (`.github/workflows/ci.yml`) corre exactamente esto en cada pull request y en cada push a `main`, y además:

- `pnpm audit --prod`: **bloquea** si hay vulnerabilidades críticas; las altas se informan sin bloquear.
- Cobertura de pruebas (`--coverage`), publicada como artefacto "cobertura".
- Un control que falla si aparece una consulta por id sin filtro de restaurante.
- Un escaneo que falla si hay una credencial real (cadena de Neon/AWS, llave de AWS o Stripe) en el código.

**Dependabot** (`.github/dependabot.yml`) abre cada semana PRs agrupados con actualizaciones. **No unas a `main` si el CI está en rojo.**

## Qué prueba cada archivo

| Archivo                                                     | Prueba                                                                                                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/finance.test.ts`                                     | Métricas del dashboard (pérdidas negativas, food cost, ticket), periodos de negocio Colombia, comparación del mismo tramo, roles                                                                         |
| `tests/income-statement.test.ts`                            | Dinero en centavos (incluye 300 sumas con centavos sin error), lectura de montos colombianos, clasificación de gastos, la cascada completa, márgenes, comparativos, rangos de fecha, CSV seguro, acceso  |
| `tests/shifts-business.test.ts`, `tests/line-close.test.ts` | Fórmulas del cierre de turno y de las líneas por inventario                                                                                                                                              |
| `tests/pdf-report.test.ts`                                  | Generación del PDF (paginación, caracteres especiales)                                                                                                                                                   |
| `tests/login-throttle.test.ts`                              | Freno en Postgres: bloqueo de ip+cuenta, intentos en paralelo sin carrera, otra IP no queda bloqueada, reinicio tras un login correcto                                                                   |
| `tests/security-hooks.test.ts`                              | URLs codificadas (`/pl%61taforma`, `/finanzas/re%73umen`) no saltan la consola ni el cobro; guardas de defensa en profundidad; el usuario en sesión no lleva el hash                                     |
| `tests/integridad.test.ts`                                  | Cierre de turno idempotente, un solo producto "Pizza" actualizado, masas por delta, comprobante Nequi repetido, compras de bodega simultáneas, únicos de caja y solicitudes                              |
| `tests/resiliencia.test.ts`                                 | `protegerAcciones` (base caída → 503, bug → 500 con código), redirect intacto, logger JSON                                                                                                               |
| `tests/billing.test.ts`                                     | Vigencias, gracia, solo lectura, suspendido, extensión de pagos, prorrateo, códigos de restaurante, bloqueo de rutas por módulo                                                                          |
| `tests/migration.test.ts`                                   | Ensaya **todas** las migraciones sobre la copia del esquema de producción (no pierde datos, idempotentes, base **idéntica** a `schema.ts`) y sobre una **base vacía**; `0000` no toca una base existente |
| `tests/tenant-isolation.test.ts`                            | **Postgres real con dos restaurantes**: 17 páginas sin fugas, 18 acciones con ids ajenos → 404 sin cambios, cierre de turno que no toca a otro restaurante                                               |

Las pruebas que usan base de datos corren sobre **PGlite** (Postgres real compilado a WebAssembly, en memoria): no necesitan Docker ni conexión, y no tocan Neon.

## Cómo escribir una prueba nueva

- **Lógica pura** (lo ideal): importa la función de `domain/` y prueba entradas → salidas. Es rápido y cubre el 80 % del valor.
- **Página o acción**: sigue el patrón de `tests/tenant-isolation.test.ts`. Se reemplaza `$lib/server/db` por un PGlite con `vi.mock`, se arma `locals` con el usuario y el restaurante, y se llama `load()` o `actions.x()` directamente.

## Observabilidad

- **Logs estructurados** (`src/lib/server/log.ts`): una línea JSON por evento con `t`, `nivel`, `msg` y contexto (`tenantId`, `userId`, `err` con causa y stack). CloudWatch/Vercel los indexan. Nivel mínimo con `LOG_LEVEL` (`debug`/`info`/`warn`/`error`).
- **`handleError`** (`hooks.server.ts`): todo error no controlado se registra con un `errorId`; el usuario ve ese **código de soporte** en la página de error (`+error.svelte`). Para investigar un reporte, busca el código en los logs.
- **`protegerAcciones()`** (`src/lib/server/actions.ts`): envuelve las form actions; si la base no responde devuelve `fail(503)` ("no se guardó nada, intenta de nuevo"), y ante un bug `fail(500)` con código. El usuario no pierde lo que escribió.
- **Timeouts:** cada consulta a Neon tiene un límite (`DB_TIMEOUT_MS`, 10 s por defecto); `/health` responde en ≤ 2 s aunque la base esté colgada e incluye la `version` del build.

## Prueba manual en el navegador

Antes de cada salida importante, recorre el flujo de la [página 11](11-checklist-salida-y-venta.md), sección "Prueba funcional". Para probar con **datos reales sin tocar producción**:

1. En Neon, crea un **branch** (copia instantánea) de la base de producción.
2. Pon el `DATABASE_URL` de ese branch en tu `.env` local.
3. Ejecuta `pnpm db:migrate`, luego `pnpm plataforma:admin` y por último `pnpm dev`.
