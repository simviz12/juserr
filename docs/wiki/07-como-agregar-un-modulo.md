# 7. Cómo agregar un módulo (tutorial)

Ejemplo real: un cliente te pide un **"Control de domicilios"** (registrar pedidos a domicilio, repartidor y valor del envío) y te lo va a pagar mes a mes. Lo construimos como **add-on**, sin tocar el Core.

## Reglas de oro

1. **Todo el código del módulo vive en su carpeta**: `src/lib/modules/domicilios/` y sus pantallas en `src/routes/domicilios/`.
2. **El módulo solo importa del Core** (`$lib/server/...`, `$lib/features/...`, `$lib/components/...`). **Nunca** de otro módulo, y el Core **nunca** importa del módulo.
3. **Toda tabla nueva lleva `tenant_id`** y toda consulta usa `delTenant`.
4. **Se activa por restaurante** desde la consola. Si nadie lo paga, nadie lo ve.

## Paso 1 — Tabla (si necesita guardar datos)

En `src/lib/server/schema.ts`:

```ts
export const domicilios = pgTable(
	'domicilios',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(), // ← obligatorio
		turnoId: integer('turno_id').references(() => turnos.id),
		cliente: text('cliente').notNull(),
		repartidor: text('repartidor'),
		valorPedido: numeric('valor_pedido', { precision: 12, scale: 2 }).notNull(),
		valorEnvio: numeric('valor_envio', { precision: 12, scale: 2 }).notNull().default('0'),
		fecha: timestamp('fecha').notNull().defaultNow()
	},
	(t) => [index('domicilios_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);
```

Y la migración `migrations/0002_modulo_domicilios.sql`:

```sql
CREATE TABLE IF NOT EXISTS domicilios (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  turno_id integer REFERENCES turnos(id),
  cliente text NOT NULL,
  repartidor text,
  valor_pedido numeric(12, 2) NOT NULL,
  valor_envio numeric(12, 2) NOT NULL DEFAULT 0,
  fecha timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domicilios_tenant_fecha_idx ON domicilios (tenant_id, fecha);

-- El módulo en el catálogo. publico = false si es a medida para un solo cliente.
INSERT INTO modulos_catalogo (codigo, nombre, descripcion, precio_mensual_cents, es_core, publico, orden)
VALUES ('domicilios', 'Control de domicilios', 'Pedidos a domicilio, repartidores y costo de envío.', 1900000, false, true, 40)
ON CONFLICT (codigo) DO NOTHING;
```

## Paso 2 — Lógica pura (con pruebas)

`src/lib/modules/domicilios/domain/domicilios.ts`:

```ts
import { toCents } from '$lib/features/finance/domain/money';

export function resumenDomicilios(
	rows: { valorPedido: string; valorEnvio: string; repartidor: string | null }[]
) {
	const porRepartidor = new Map<string, number>();
	let ventasCents = 0,
		enviosCents = 0;
	for (const r of rows) {
		ventasCents += toCents(r.valorPedido);
		enviosCents += toCents(r.valorEnvio);
		const k = r.repartidor ?? 'Sin asignar';
		porRepartidor.set(k, (porRepartidor.get(k) ?? 0) + 1);
	}
	return { pedidos: rows.length, ventasCents, enviosCents, porRepartidor: [...porRepartidor] };
}
```

Y su prueba en `tests/domicilios.test.ts`.

## Paso 3 — Servidor de la página

`src/routes/domicilios/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { domicilios } from '$lib/server/schema';
import { delTenant, tenantDe } from '$lib/server/tenancy';
import { parseMoneyInput, centsToDecimalString } from '$lib/features/finance/domain/money';
import { resumenDomicilios } from '$lib/modules/domicilios/domain/domicilios';

export const load = async ({ locals }) => {
	const tid = tenantDe(locals); // ← restaurante de la sesión
	const rows = await db
		.select()
		.from(domicilios)
		.where(delTenant(domicilios, tid)) // ← filtro obligatorio
		.orderBy(desc(domicilios.fecha))
		.limit(200);
	return { rows, resumen: resumenDomicilios(rows) };
};

export const actions = {
	registrar: async ({ request, locals }) => {
		const tid = tenantDe(locals);
		const fd = await request.formData();
		const valor = parseMoneyInput(fd.get('valor')?.toString() ?? '');
		if (valor === null || valor <= 0) return fail(400, { error: 'Valor inválido.' });
		await db.insert(domicilios).values({
			tenantId: tid, // ← obligatorio
			cliente: fd.get('cliente')?.toString().trim().slice(0, 120) || 'Cliente',
			repartidor: fd.get('repartidor')?.toString().trim() || null,
			valorPedido: centsToDecimalString(valor)
		});
		return { success: true, message: 'Domicilio registrado.' };
	}
};
```

## Paso 4 — Registrarlo

En `src/lib/modules/registry.ts`, agrega una entrada a `ADDONS`:

```ts
{ codigo: 'domicilios', nombre: 'Control de domicilios', rutas: ['/domicilios'] }
```

**Con esto queda bloqueado automáticamente** (vista y acciones) para quien no lo pague: no hay que tocar `hooks.server.ts`.

## Paso 5 — Menú

En `src/routes/+layout.svelte`, agrega el ítem al grupo que corresponda:

```ts
{ name: 'Domicilios', path: '/domicilios', href: resolve('/domicilios'), icon: Bike }
```

El candado 🔒 aparece solo si el restaurante no lo tiene. Si solo el Jefe debe verlo, no hay que hacer nada (el Jefe tiene `'*'`). Si los cajeros también deben usarlo, agrega `'/domicilios'` a su política en `src/lib/auth/access.ts`.

## Paso 6 — Probar el aislamiento

Agrega la ruta al mapa `RUTAS` de `tests/tenant-isolation.test.ts` (y un intento de acción con ids del otro restaurante si tiene editar/borrar). Corre:

```bash
pnpm lint && pnpm check && pnpm vitest run && pnpm build
```

## Paso 7 — Publicar y vender

1. Respaldo → `pnpm db:migrate` (crea la tabla y lo agrega al catálogo) → despliegue.
2. En la consola → ficha del restaurante → **Activar un módulo** → "Control de domicilios" (con prorrateo si es a mitad de ciclo).
3. Si es **a medida**, márcalo `publico = false`: no aparece en `/modulos` para otros clientes, pero tú puedes activarlo a quien lo pague.

## ¿Y si el cliente quiere cambiar algo del Core?

Pregúntate primero: **¿le sirve a todos?**

- **Sí** → mejóralo en el Core para todos (todos los clientes ganan, tú mantienes una sola versión).
- **No** → hazlo módulo. Si necesita "engancharse" a un flujo del Core (p. ej. al cerrar un turno), el patrón es que el módulo **lea** los datos del Core (turnos, gastos) por su cuenta, no que el Core llame al módulo.
