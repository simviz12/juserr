# 7. Funciones exclusivas: el corazón del modelo

## El modelo

> **El esqueleto (Core) es igual para todos. Cuando un restaurante pide una función, se la construyes y esa función es SOLO de él.**

|                                    | Core    | Add-on general            | **Función exclusiva**                                                   |
| ---------------------------------- | ------- | ------------------------- | ----------------------------------------------------------------------- |
| Quién la tiene                     | Todos   | Quien la contrate         | **Solo el restaurante que la pidió**                                    |
| Aparece en el catálogo `/modulos`  | —       | Sí, para todos            | Solo para su dueño ("Hecho para tu restaurante")                        |
| Aparece en el menú                 | Sí      | Sí (con 🔒 si no la paga) | Solo para su dueño, en **"Hecho para ti"**                              |
| Si otro restaurante escribe la URL | —       | Lo manda a contratarla    | **404: para él no existe**                                              |
| ¿Se le puede activar a otro?       | —       | Sí                        | **No.** Lo impide la consola y también un _trigger_ de la base de datos |
| Ruta                               | Fija    | Fija                      | `/m/<codigo>`                                                           |
| Se cobra                           | Mensual | Mensual                   | Mensual, con **precio pactado con ese cliente**                         |

## Flujo completo: un cliente pide algo

```
1. El restaurante te pide la función        → acuerdas alcance y precio mensual
2. pnpm modulo:nuevo ...                     → se genera toda la estructura
3. Programas la función                      → solo dentro de su carpeta
4. pnpm lint && pnpm check && pnpm vitest run
5. Subes a GitHub → despliegas → pnpm db:migrate
6. Consola → ficha del restaurante → Activar un módulo → "★ Nombre"
7. El cliente la ve en su menú, en "Hecho para ti". Nadie más la ve.
```

## Paso 2 — Generar la función (un solo comando)

```bash
pnpm modulo:nuevo domicilios-donjuan --para pizzeria-don-juan --nombre "Domicilios" --precio 39000 --icono truck
```

| Parámetro            | Qué es                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `domicilios-donjuan` | Código del módulo (minúsculas, números y guiones). Conviene incluir el cliente en el nombre             |
| `--para`             | **Código del restaurante dueño** (el mismo que usa para iniciar sesión)                                 |
| `--nombre`           | Nombre que verá en el menú                                                                              |
| `--precio`           | Precio mensual en pesos (queda como su precio pactado)                                                  |
| `--icono`            | `puzzle`, `truck`, `calendar`, `clipboard`, `chart`, `users`, `star`, `receipt`, `package` o `utensils` |

El comando crea:

| Archivo                                                  | Para qué                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/modules/<codigo>/README.md`                     | Ficha del desarrollo: qué pidió el cliente, alcance y datos. **Llénala**: es tu memoria de lo acordado |
| `src/lib/modules/<codigo>/server/datos.ts`               | Lógica del servidor, ya con el filtro por restaurante (`delTenant`)                                    |
| `src/routes/m/<codigo>/+page.server.ts` y `+page.svelte` | La página, ya funcionando (con un ejemplo de datos del restaurante)                                    |
| `migrations/NNNN_modulo_<codigo>.sql`                    | Lo agrega al catálogo como **exclusivo** del restaurante                                               |
| `src/lib/modules/registry.ts`                            | Lo registra en `EXCLUSIVOS` con su entrada de menú                                                     |

Además verifica que el código no exista, valida los parámetros y deja el código formateado.

## Paso 3 — Programar la función

Trabaja **solo** dentro de `src/lib/modules/<codigo>/` y `src/routes/m/<codigo>/`. Reglas:

0. **Exige el módulo** al inicio de cada `load` y de cada acción: `exigirModulo(locals, '<codigo>');` (la plantilla ya lo trae en el `load`). El hook ya controla el acceso; esto es la segunda barrera.
1. **El restaurante sale de la sesión**: `const tid = tenantDe(locals);`
2. **Toda consulta filtra por restaurante**: `.where(delTenant(tabla, tid, ...))`
3. **Todo insert lleva** `tenantId: tid`
4. **Solo importa del Core** (`$lib/server/...`, `$lib/features/...`, `$lib/components/...`). Nunca de otro módulo.
5. **Dinero en centavos**: `toCents()`, `parseMoneyInput()` y `centsToDecimalString()`.
6. **Envuelve las acciones** con `protegerAcciones('<codigo>', { ... })` (`$lib/server/actions`) para que un error de base de datos no tumbe la página.
7. **Nada de `console.log`**: usa `log.info/warn/error` de `$lib/server/log` con `tenantId` en el contexto.
8. **Cantidades** con `numeric` (nunca `real`); si algo no debe duplicarse, ponle un **índice único** y atrapa la violación con `esViolacionUnica()`.

### Si la función necesita guardar datos (tabla nueva)

En `src/lib/server/schema.ts`:

```ts
export const domiciliosDonjuan = pgTable(
	'domicilios_donjuan',
	{
		id: serial('id').primaryKey(),
		tenantId: tenantId(), // ← obligatorio
		cliente: text('cliente').notNull(),
		valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
		fecha: timestamp('fecha').notNull().defaultNow()
	},
	(t) => [index('domicilios_donjuan_tenant_fecha_idx').on(t.tenantId, t.fecha)]
);
```

Y en la migración generada (`migrations/NNNN_modulo_<codigo>.sql`) agrega el `CREATE TABLE IF NOT EXISTS ...` con las mismas columnas. `tests/migration.test.ts` comprueba que la tabla de la migración y la de `schema.ts` sean idénticas.

### Acción de ejemplo (guardar un registro)

```ts
// src/routes/m/domicilios-donjuan/+page.server.ts
export const actions = protegerAcciones('domicilios-donjuan', {
	registrar: async ({ request, locals }) => {
		exigirModulo(locals, 'domicilios-donjuan');
		const tid = tenantDe(locals);
		const fd = await request.formData();
		const valor = parseMoneyInput(fd.get('valor')?.toString() ?? '');
		if (valor === null || valor <= 0) return fail(400, { error: 'Valor inválido.' });
		await db.insert(domiciliosDonjuan).values({
			tenantId: tid,
			cliente: fd.get('cliente')?.toString().trim().slice(0, 120) || 'Cliente',
			valor: centsToDecimalString(valor)
		});
		return { success: true, message: 'Domicilio registrado.' };
	}
});
```

No tienes que agregar permisos ni candados: `hooks.server.ts` usa el registro y bloquea vista y acciones solo con ver la ruta `/m/<codigo>`.

## Pasos 5 y 6 — Publicar y activar

1. Haz commit y push; espera el CI en verde y despliega.
2. Toma un branch de respaldo en Neon y ejecuta `pnpm db:migrate` (crea la tabla y lo agrega al catálogo).
3. Consola → **ficha del restaurante dueño** → _Activar un módulo_ → aparece como **"★ Domicilios"** (solo en la ficha de ese restaurante).
   - Si quieres cobrar desde ya, marca "Registrar el cobro del prorrateo".
4. Desde ahí se cobra como cualquier módulo: aparece en su `/facturacion` y vence y se renueva igual. Si deja de pagar, **solo esa función** se bloquea; el Core sigue funcionando.

## Cuatro capas que garantizan la exclusividad

| Capa               | Dónde                             | Qué impide                                                                                                                                        |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Registro        | `registry.ts` → `exclusivoDe`     | La ruta responde **404** a cualquier otro restaurante (vista y POST) y no aparece en su menú                                                      |
| 2. Catálogo        | `/modulos` y fichas de la consola | No se le lista ni ofrece a nadie más                                                                                                              |
| 3. Lógica de cobro | `activarModulo()`                 | Rechaza activarlo a otro restaurante aunque se manipule el formulario                                                                             |
| 4. Base de datos   | Migración `0002`: CHECK + trigger | **Aunque alguien lo intente por SQL o un script**, Postgres rechaza suscribir a otro restaurante, mover la suscripción o volver público el módulo |

Probado en `tests/billing.test.ts` (reglas de acceso y menú) y en `tests/migration.test.ts` (_trigger_ de la base).

## ¿Y si después otro cliente quiere lo mismo?

Tienes dos caminos:

- **Venderle uno igual** como exclusivo suyo: generas otro módulo y copias la lógica (cada cliente evoluciona por su lado).
- **Volverlo un add-on general**: mueve su entrada de `EXCLUSIVOS` a `ADDONS`, cambia la ruta a una fija y, con una migración, quita `exclusivo_tenant_id` y márcalo `publico = true`. El primer cliente lo conserva con su precio pactado.

## ¿Y si el cliente quiere cambiar algo del esqueleto (Core)?

Primero pregúntate: **¿le sirve a todos?**

- **Sí** → mejóralo en el Core, para todos. Mantienes una sola versión y todos ganan.
- **No** → hazlo función exclusiva. Si necesita datos del Core (turnos, gastos, inventario), la función **los lee** por su cuenta. El Core **nunca** depende de una función exclusiva, por eso actualizar el esqueleto no rompe lo que hiciste a medida.
