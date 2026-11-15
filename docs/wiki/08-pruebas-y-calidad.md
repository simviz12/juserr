# 8. Pruebas y calidad

## El comando que lo verifica todo

```bash
pnpm lint && pnpm check && pnpm vitest run && pnpm build
```

| Paso              | Herramienta               | Qué detecta                                                                |
| ----------------- | ------------------------- | -------------------------------------------------------------------------- |
| `pnpm lint`       | Prettier + ESLint         | Formato, código muerto, malas prácticas de Svelte, enlaces sin `resolve()` |
| `pnpm check`      | svelte-check (TypeScript) | Errores de tipos; por ejemplo, un insert sin `tenantId`                    |
| `pnpm vitest run` | Vitest                    | Las ~131 pruebas (ver abajo)                                               |
| `pnpm build`      | Vite / SvelteKit          | Que la app compile para producción                                         |

El **CI** (`.github/workflows/ci.yml`) corre exactamente esto en cada pull request y en cada push a `main`, más un control que falla si aparece una consulta por id sin filtro de restaurante. **No unas a `main` si el CI está en rojo.**

## Qué prueba cada archivo

| Archivo                                                     | Prueba                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/finance.test.ts`                                     | Métricas del dashboard (pérdidas negativas, food cost, ticket), periodos de negocio Colombia, comparación del mismo tramo, roles                                                                        |
| `tests/income-statement.test.ts`                            | Dinero en centavos (incluye 300 sumas con centavos sin error), lectura de montos colombianos, clasificación de gastos, la cascada completa, márgenes, comparativos, rangos de fecha, CSV seguro, acceso |
| `tests/shifts-business.test.ts`, `tests/line-close.test.ts` | Fórmulas del cierre de turno y de las líneas por inventario                                                                                                                                             |
| `tests/pdf-report.test.ts`                                  | Generación del PDF (paginación, caracteres especiales)                                                                                                                                                  |
| `tests/login-throttle.test.ts`                              | Bloqueo tras 5 fallos, desbloqueo a los 15 minutos, reinicio tras un login correcto                                                                                                                     |
| `tests/billing.test.ts`                                     | Vigencias, gracia, solo lectura, suspendido, extensión de pagos, prorrateo, códigos de restaurante, bloqueo de rutas por módulo                                                                         |
| `tests/migration.test.ts`                                   | Ensaya `0001` sobre la copia del esquema de producción: no pierde datos, asigna todo al restaurante #1, es idempotente y deja la base **idéntica** a `schema.ts`                                        |
| `tests/tenant-isolation.test.ts`                            | **Postgres real con dos restaurantes**: 17 páginas sin fugas, 18 acciones con ids ajenos → 404 sin cambios, cierre de turno que no toca a otro restaurante                                              |

Las pruebas que usan base de datos corren sobre **PGlite** (Postgres real compilado a WebAssembly, en memoria): no necesitan Docker ni conexión, y no tocan Neon.

## Cómo escribir una prueba nueva

- **Lógica pura** (lo ideal): importa la función de `domain/` y prueba entradas → salidas. Es rápido y cubre el 80 % del valor.
- **Página o acción**: sigue el patrón de `tests/tenant-isolation.test.ts`. Se reemplaza `$lib/server/db` por un PGlite con `vi.mock`, se arma `locals` con el usuario y el restaurante, y se llama `load()` o `actions.x()` directamente.

## Prueba manual en el navegador

Antes de cada salida importante, recorre el flujo de la [página 11](11-checklist-salida-y-venta.md), sección "Prueba funcional". Para probar con **datos reales sin tocar producción**:

1. En Neon, crea un **branch** (copia instantánea) de la base de producción.
2. Pon el `DATABASE_URL` de ese branch en tu `.env` local.
3. Ejecuta `pnpm db:migrate`, luego `pnpm plataforma:admin` y por último `pnpm dev`.
