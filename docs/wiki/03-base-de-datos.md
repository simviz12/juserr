# 3. Base de datos

Todo el esquema está en **`src/lib/server/schema.ts`** (Drizzle). La base es PostgreSQL. Hay tres grupos de tablas.

## Diagrama general

```
PLATAFORMA (sin tenant_id)                       NEGOCIO (todas con tenant_id → tenants.id)
────────────────────────────                     ─────────────────────────────────────────────
tenants ◄────────────────────────────────────────┬─ usuarios ◄── sesiones
  │                                              ├─ rubros_config (1 por restaurante)
  ├── suscripciones_modulo ──► modulos_catalogo  ├─ categorias ◄── productos ◄── movimientos_inventario
  ├── pagos                                      ├─ pizza_sabores ◄── pizza_ruedas / pizza_sobras / pizza_ventas
  ├── solicitudes_modulo ──► modulos_catalogo    ├─ turnos ◄── transacciones_turno, gastos, cierres_linea, ventas_items
  └── auditoria_plataforma ──► platform_admins   ├─ lineas_gastronomicas ◄── items_linea
platform_admins ◄── platform_sesiones            ├─ cierres_dia, cortes_semanales
                                                 ├─ movimientos_contables (Estado de Resultados)
_migraciones (historial del runner)              └─ bebidas ◄── movimientos_bebidas
```

## Tablas de plataforma

| Tabla                                   | Para qué                               | Columnas clave                                                                                                                                |
| --------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants`                               | Cada restaurante cliente               | `codigo` (único, para el login), `estado` (`activo`/`suspendido`/`cancelado`), `dias_gracia`, `limite_usuarios` (null = sin límite), contacto |
| `modulos_catalogo`                      | Lo que se vende                        | `codigo` (PK), `precio_mensual_cents`, `es_core`, `publico` (false = a medida/oculto), `orden`                                                |
| `suscripciones_modulo`                  | Qué tiene cada restaurante             | PK (`tenant_id`, `modulo`), `estado` (`activa`/`cancelada`), `vigente_hasta` (último día pagado), `precio_mensual_cents` (precio pactado)     |
| `pagos`                                 | Pagos recibidos (**solo se insertan**) | `monto_cents`, `detalle` (JSON: módulo, desde, hasta, centavos), `metodo`, `referencia`, `registrado_por`                                     |
| `solicitudes_modulo`                    | Pedidos desde `/modulos`               | `estado` (`pendiente`/`atendida`/`descartada`)                                                                                                |
| `platform_admins` / `platform_sesiones` | Operadores de la consola               | `email` único, hash Argon2                                                                                                                    |
| `auditoria_plataforma`                  | Bitácora de la consola                 | `accion`, `detalle` JSON, quién y cuándo                                                                                                      |
| `_migraciones`                          | Historial del runner                   | `nombre`, `checksum`, `aplicada_en`                                                                                                           |

Restricciones `CHECK` en la base (no solo en el código): el código de restaurante debe ser `minúsculas-números-guiones`, los estados solo aceptan sus valores válidos, y los precios y montos no pueden ser negativos.

## Tablas de negocio (todas con `tenant_id NOT NULL`)

### Usuarios y configuración

| Tabla           | Notas                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usuarios`      | `rol`: `jefe`, `bodeguero`, `cajero`, `empleado`. **Único por restaurante**: índice único `(tenant_id, lower(nombre))`, así dos restaurantes pueden tener cada uno su "admin" |
| `sesiones`      | Id = SHA-256 del token de la cookie (el token nunca se guarda en claro). Se liga al usuario, que ya tiene tenant                                                              |
| `rubros_config` | Una fila por restaurante (índice único `tenant_id`): nombre comercial, tipo de negocio, líneas activas                                                                        |

### Inventario

| Tabla                            | Notas                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `categorias`                     | Agrupan productos                                                                                                              |
| `productos`                      | Insumos. `stock_actual` (real, admite fracciones: ½ masa), `stock_minimo` (alertas), `precio_costo` (costo promedio ponderado) |
| `movimientos_inventario`         | Cada compra (`entrada`) o conteo (`ajuste`): cantidad, costo unitario y total                                                  |
| `bebidas`, `movimientos_bebidas` | Heredadas de una versión anterior; hoy las bebidas se manejan como productos                                                   |

### Operación del turno

| Tabla                                                              | Notas                                                                                                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `turnos`                                                           | Un cierre de turno: `monto` (efectivo contado), `transferencias`, conteos de masas y porciones, `porciones_vendidas_calculado`    |
| `transacciones_turno`                                              | Desglose por plataforma (Nequi) + `referencias` de comprobantes (antifraude)                                                      |
| `gastos`                                                           | Gastos pagados con la caja del turno. `categoria` (null = clasificación automática)                                               |
| `pizza_sabores` / `pizza_ruedas` / `pizza_sobras` / `pizza_ventas` | Control de pizzas por sabor                                                                                                       |
| `lineas_gastronomicas`                                             | Líneas (pizza, chuzo, burger, lasaña, carne). Único `(tenant_id, codigo)`. `producto_control_id` = insumo que se cuenta al cierre |
| `items_linea`                                                      | Platos de cada línea: precio de venta, costo, `unidades_control` (p. ej. 1 pan por hamburguesa)                                   |
| `cierres_linea`                                                    | Conciliación por línea en cada turno (inicial, sobrantes, mermas, consumidas, venta esperada)                                     |
| `ventas_items`                                                     | Desglose opcional de platos vendidos por turno                                                                                    |

### Finanzas

| Tabla                   | Notas                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cierres_dia`           | Cierre de caja diario (consolida turnos de una jornada)                                                                                                                        |
| `cortes_semanales`      | Efectivo esperado vs. contado en un rango, con la diferencia                                                                                                                   |
| `movimientos_contables` | Movimientos manuales del Estado de Resultados (arriendo, nómina, impuestos, devoluciones, otros ingresos). **Se anulan, no se borran** (`estado`, `anulado_por`, `anulado_en`) |

### Heredada

`saas_suscripciones`: tabla de la versión mono-restaurante. Ya no se usa; se conserva hasta confirmar la migración en producción y luego puede borrarse con una migración nueva.

## Índices

Casi toda consulta es "de este restaurante, en este rango de fechas", por eso los índices principales son **`(tenant_id, fecha)`** en `turnos`, `gastos`, `movimientos_inventario`, `transacciones_turno`, `pizza_ventas`, `cierres_dia`, `cortes_semanales`, `cierres_linea`, `ventas_items` y `movimientos_contables`. Los catálogos tienen índice por `tenant_id`.

## Dinero y fechas: reglas de oro

- **Dinero en la base:** `numeric(10,2)` / `numeric(14,2)` (exacto). En la plataforma de cobro: `bigint` en **centavos**.
- **Dinero en el código:** se convierte a centavos enteros con `toCents()` (`features/finance/domain/money.ts`) antes de sumar. `parseMoneyInput()` entiende `1.250.000`, `35000,50` y `$ 12 000`.
- **Fechas:** columnas `timestamp` guardadas en UTC. El **día de negocio** va de 04:00 a 04:00 hora Colombia (UTC-5): un turno cerrado a la 1 a.m. pertenece al día anterior (`businessDayKey()` en `period.ts`).
- **Vigencias de módulos:** columnas `date` ("pagado hasta", inclusive), comparadas con el día de negocio de hoy.

## Migraciones

- Archivos SQL en `migrations/NNNN_nombre.sql`, aplicados con `pnpm db:migrate` (`scripts/migrate.mjs`).
- Cada archivo corre en **una transacción** y se registra con su **checksum**. Si alguien edita una migración ya aplicada, el runner se detiene: **nunca edites una migración aplicada, crea una nueva**.
- `0001_multitenant.sql` es la que convirtió la base de un solo restaurante en multi-restaurante (detalle en [la página 12](12-historial-de-cambios.md)).
- `tests/migration.test.ts` ensaya cada migración sobre `tests/fixtures/legacy-schema.sql` (copia del esquema de producción anterior) y verifica que el resultado sea **idéntico** a `schema.ts`.

### Cómo cambiar el esquema de ahora en adelante

1. Edita `schema.ts`.
2. Escribe `migrations/0002_lo-que-sea.sql` a mano (aditivo e idempotente: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
3. Corre `pnpm vitest run tests/migration.test.ts`. Si el esquema y la migración no coinciden, la prueba lo dice. Para incluir `0002`, la prueba debe aplicar las migraciones en orden (amplíala cuando agregues la primera nueva).
4. En producción: respaldo → `pnpm db:migrate` → despliegue.
