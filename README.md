# MesaCapital — Finanzas para restaurantes

Plataforma SaaS multi-restaurante para el control de caja por turno, inventario de materia prima, auditoría de mermas y reportes gerenciales. Arqueo de caja con desglose digital (Nequi / Daviplata), para pizzerías, puestos de chuzos, hamburgueserías y asaderos.

**Modelo de negocio:** suscripción mensual por restaurante = **Plan Core** + **módulos adicionales** que cada cliente contrata por separado.

> 📚 **Documentación completa:** [`docs/wiki/`](docs/wiki/README.md) — arquitectura, base de datos, seguridad, facturación, fórmulas del producto, cómo agregar módulos, operación diaria y la **guía de despliegue en AWS**.

---

## 💼 Modelo SaaS: Core + módulos

| Módulo                      | Código               | Qué incluye                                                                                                       |
| :-------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Plan Core** (obligatorio) | `core`               | Cierre de turno con arqueo, bodega, productos, líneas y sabores, caja diaria, dashboard, personal y configuración |
| Finanzas avanzadas          | `finanzas-avanzadas` | Resumen financiero por rango, corte semanal, reporte mensual, exportación PDF/Excel                               |
| Estado de Resultados        | `estado-resultados`  | Pérdidas y ganancias en cascada, comparativos, desglose y exportación                                             |
| Reporte de producción       | `produccion`         | Producción y ventas por línea y por plato                                                                         |

Los precios de lista se editan en la consola (`/plataforma/catalogo`). Cada restaurante guarda su **precio pactado**, así puedes dar descuentos o precios a medida sin afectar a los demás.

### Ciclo de cobro

- Cada módulo contratado tiene una fecha **"pagado hasta"**. Registrar un pago de N meses la extiende sin perder días.
- Al vencer, el restaurante tiene **días de gracia** (5 por defecto, configurables por cliente) con un aviso en pantalla.
- **Core vencido y sin gracia → solo lectura:** se puede consultar y exportar, pero no registrar nada. El cliente no pierde su información.
- **Add-on vencido o cancelado:** se bloquean sus pantallas y acciones; el Core sigue funcionando.
- **Suspendido** (decisión manual): solo ve Facturación. **Cancelado**: no puede iniciar sesión.
- Activar un add-on a mitad de ciclo lo alinea con el vencimiento del Core y calcula el **prorrateo**, de modo que el cliente tiene una sola fecha de pago.

### Consola del dueño de la plataforma (`/plataforma`)

Tiene su propio login y sus propias sesiones, independientes de los restaurantes:

- Lista de restaurantes con estado de pago, **MRR** (ingreso mensual recurrente), los que vencen pronto y los vencidos.
- **Nuevo restaurante:** crea la cuenta, el código de acceso, el usuario Jefe, los módulos y los días de prueba en un solo paso atómico.
- Ficha del restaurante: registrar pagos, activar o cancelar módulos (con prorrateo opcional), cambiar precios, editar datos y límite de usuarios, suspender o cancelar.
- Solicitudes de módulos hechas por los clientes desde `/modulos`.
- Bitácora de auditoría de cada acción.

Para crear tu usuario de la consola:

```bash
pnpm plataforma:admin tu@correo.com "Tu Nombre"   # pide la contraseña por la terminal
```

El cobro hoy es **manual**: el cliente paga por transferencia o Nequi y tú registras el pago en la consola. La facturación está separada de cualquier pasarela (`src/lib/billing/`), así que integrar Wompi o Mercado Pago consiste en agregar el webhook que llame a `registrarPago()`.

---

## 🧩 Cómo agregar un módulo (add-on o desarrollo a medida)

El Core no se toca. Un módulo es código desacoplado que se conecta así:

1. Crea su código en `src/lib/modules/<codigo>/` (dominio, servidor, componentes) y sus pantallas en `src/routes/`. Un módulo **solo importa del Core**, nunca de otro módulo.
2. Regístralo en `src/lib/modules/registry.ts` con las rutas que le pertenecen.
3. Agrégalo al catálogo con una migración nueva en `migrations/` (`INSERT INTO modulos_catalogo ...`). Para un desarrollo a medida, márcalo `publico = false`.
4. Actívalo solo a los restaurantes que lo pagan desde la consola.

A partir de ahí, `hooks.server.ts` bloquea automáticamente sus pantallas **y** acciones para quien no lo tenga pagado, y el menú muestra un candado. El módulo de referencia es `src/lib/modules/estado-resultados/`.

---

## 🏛️ Arquitectura

```
src/
├── hooks.server.ts            # Guard central: sesión → rol → plan/módulos → solo lectura
├── lib/
│   ├── server/
│   │   ├── schema.ts          # Tablas (Drizzle). Toda tabla de negocio lleva tenant_id
│   │   ├── tenancy.ts         # tenantDe(locals) + delTenant(): aislamiento por restaurante
│   │   ├── auth.ts            # Sesiones de restaurante (argon2 + SHA-256, caché 60 s)
│   │   └── platform-auth.ts   # Sesiones de la consola de plataforma (separadas)
│   ├── modules/
│   │   ├── registry.ts        # Registro de módulos y regla de acceso (servidor y menú)
│   │   └── estado-resultados/ # Add-on de referencia
│   ├── billing/
│   │   ├── domain.ts          # Vigencias, gracia, prorrateo, totales (puro, probado)
│   │   └── server.ts          # Pagos, activaciones, alta de restaurantes
│   └── features/              # Core: finanzas, turnos, negocio (dominio puro + servidor)
└── routes/
    ├── (Core)                 # dashboard, turnos/cierre, bodega, productos, finanzas/caja, configuracion
    ├── finanzas/*, reportes/* # Add-ons (bloqueados según el plan)
    ├── facturacion/, modulos/ # Plan, pagos y catálogo para el restaurante
    └── plataforma/            # Consola del dueño de la plataforma
migrations/                    # Migraciones SQL con historial (pnpm db:migrate)
```

### Aislamiento entre restaurantes

- Una sola base de datos compartida; **toda** tabla de negocio tiene `tenant_id NOT NULL`.
- El restaurante **siempre** sale de la sesión (`tenantDe(locals)`), nunca del formulario ni de la URL.
- Toda consulta usa `delTenant(tabla, tid, ...)` y todo insert lleva `tenantId`. Los inserts sin `tenantId` no compilan.
- `tests/tenant-isolation.test.ts` levanta Postgres real con dos restaurantes y recorre cada página y acción. Comprueba que ninguno ve ni modifica datos del otro, ni siquiera manipulando ids.
- El CI además falla si aparece un `update`/`delete` por id sin filtro de restaurante.

---

## 🚀 Tecnologías

SvelteKit 2 + Svelte 5 (runes) · TypeScript estricto · TailwindCSS 4 · PostgreSQL (Neon) · Drizzle ORM · Argon2id · jsPDF · Vitest + PGlite (Postgres embebido para pruebas) · Docker (Node 22 Alpine).

---

## 🍕 Funciones

### Core

- **Cierre de turno:** arqueo de efectivo, Nequi y gastos; conciliación por inventario de pizzas y de cada línea. La fórmula es `Vendidas = (Masas usadas × 8) + Vitrina de ayer − Sobrantes − Mermas`. Antifraude de comprobantes repetidos. El cierre se guarda en **un solo lote atómico**.
- **Bodega:** compras (suma stock y recalcula el costo promedio) y conteo físico (ajuste).
- **Dashboard:** KPIs, flujo de caja, food cost, mezcla de cobro y ranking de productos.
- **Caja diaria:** consolidación de turnos por jornada (04:00 a 04:00, hora de Colombia).

### Estado de Resultados (add-on)

| Línea                          | Origen de la cifra                                                                          |
| :----------------------------- | :------------------------------------------------------------------------------------------ |
| (+) Ingresos operacionales     | Cierres de turno (efectivo + transferencias)                                                |
| (−) Devoluciones y descuentos  | Movimientos contables manuales                                                              |
| (−) Costo de ventas            | Compras de Bodega (`movimientos_inventario` tipo `entrada`) + gastos de categoría _Insumos_ |
| (−) Gastos operacionales       | Gastos de caja del turno + gastos manuales, agrupados por categoría                         |
| (+/−) Otros ingresos y egresos | Movimientos manuales y gastos financieros / extraordinarios                                 |
| (−) Impuestos                  | Gastos de categoría _Impuestos y provisiones fiscales_                                      |

Cálculos en centavos enteros (sin errores de coma flotante), clasificación automática de gastos, movimientos manuales que se anulan en vez de borrarse, comparativos y exportación PDF/Excel/CSV. Es un informe **gerencial en base caja**, no un estado financiero bajo NIIF.

---

## 🗄️ Migraciones

```bash
pnpm db:migrate:estado   # muestra cuáles están aplicadas y cuáles pendientes
pnpm db:migrate          # aplica las pendientes de migrations/*.sql
```

- Cada archivo se aplica en **una transacción** y queda registrado con su checksum en `_migraciones`. Nunca edites una migración ya aplicada: crea una nueva.
- `tests/migration.test.ts` ensaya cada migración sobre una copia del esquema de producción con datos, y verifica que la base resultante sea **idéntica** a `schema.ts`.
- `0001_multitenant.sql` convierte la base mono-restaurante: crea el restaurante #1, le asigna todos los datos existentes y le activa el Core y los add-ons por 30 días.
- Los scripts `migrate_tables.mjs` y `scripts/migrate-*.mjs` son históricos (anteriores a `0001`); no se vuelven a usar.

> ⚠️ **Orden al desplegar `0001`:** el código nuevo necesita la base migrada, y el código viejo deja de funcionar con ella. Haz respaldo de la base, aplica la migración y despliega el código nuevo **en la misma ventana**.

---

## 🛠️ Despliegue

### Variables de entorno

| Variable             | Uso                                                                          |
| :------------------- | :--------------------------------------------------------------------------- |
| `DATABASE_URL`       | Conexión a Postgres (Neon)                                                   |
| `PAGO_INSTRUCCIONES` | Pasos de pago que ve cada restaurante en `/facturacion` (separados por `\|`) |
| `SOPORTE_WHATSAPP`   | WhatsApp de cobros/soporte (solo números, con indicativo)                    |

### Vercel (recomendado)

Importa el repositorio en Vercel, configura las variables y despliega. El adaptador se elige solo (`adapter-vercel` en Vercel, `adapter-node` en otros entornos).

### Docker

```bash
docker build -t mesacapital .
docker run -d -p 3000:3000 --env-file .env --restart always --name mesacapital mesacapital
```

La imagen corre sin privilegios de root, solo con dependencias de producción, e incluye un `HEALTHCHECK` contra `/health`.

### Monitoreo

`GET /health` es público y no expone datos: responde `200 {ok:true}` si la app llega a la base y `503` si no. Úsalo en tu monitor de disponibilidad.

---

## 💻 Desarrollo local

```bash
pnpm install
cp .env.example .env              # y completa DATABASE_URL
pnpm db:migrate
pnpm plataforma:admin tu@correo.com "Tu Nombre"
pnpm dev                          # entra a /plataforma/login y crea tu primer restaurante
```

Comprobaciones (las mismas que corre el CI en cada pull request):

```bash
pnpm lint && pnpm check && pnpm vitest run && pnpm build
```

### Datos de prueba (siempre por restaurante)

Los scripts que borran datos exigen `--tenant <código>` **y** `--confirmar`. Nunca tocan otros restaurantes.

```bash
pnpm db:seed -- --tenant <código> --confirmar           # catálogo inicial vacío
pnpm db:reset-counts -- --tenant <código> --confirmar   # historial y stock en cero
node scripts/demo-data.mjs --tenant <código>            # ~70 días de operación demo (reversible con --remove)
```

---

## 👥 Roles dentro de cada restaurante

| Rol                   | Dashboard | Cierre Turno | Bodega | Finanzas | Catálogos |      Facturación      |
| :-------------------- | :-------: | :----------: | :----: | :------: | :-------: | :-------------------: |
| **Jefe (Admin)**      |    ✅     |      ✅      |   ✅   |    ✅    |    ✅     |          ✅           |
| **Bodeguero**         |    ❌     |      ✅      |   ✅   |    ❌    |    ❌     | Solo aviso de bloqueo |
| **Cajero / Empleado** |    ❌     |      ✅      |   ❌   |    ❌    |    ❌     | Solo aviso de bloqueo |

Las pantallas de add-ons solo están disponibles si el restaurante tiene el módulo pagado.
