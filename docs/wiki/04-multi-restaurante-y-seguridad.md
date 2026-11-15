# 4. Multi-restaurante y seguridad

Esta es la página más importante para dormir tranquilo: **un restaurante jamás debe ver ni modificar datos de otro.**

## Modelo de aislamiento: base compartida + `tenant_id`

Todos los restaurantes viven en la misma base de datos. Cada fila de negocio tiene `tenant_id`. Se eligió este modelo (y no "una base por cliente") porque:

|                         | Base compartida + tenant_id (elegido)                  | Una base por cliente              |
| ----------------------- | ------------------------------------------------------ | --------------------------------- |
| Costo por cliente nuevo | ~0                                                     | Una base más que mantener         |
| Actualizar el sistema   | Una migración para todos                               | N migraciones                     |
| Alta de un cliente      | Un formulario en la consola                            | Crear base, desplegar, configurar |
| Riesgo                  | Olvidar un filtro → se mitiga con las 3 capas de abajo | Muy bajo                          |

## Las tres capas que evitan fugas

### Capa 1 — El restaurante sale de la sesión, nunca del usuario

```ts
// src/lib/server/tenancy.ts
export function tenantDe(locals: App.Locals): number {
	const id = locals.user?.tenantId; // ← viene de la sesión validada
	if (!id) error(401, 'Sesión inválida');
	return id;
}
```

Ningún formulario ni URL trae `tenantId`. Aunque alguien manipule el HTML, el servidor usa el restaurante de su sesión.

### Capa 2 — Toda consulta filtra con `delTenant`

```ts
export function delTenant(table, tenantId, ...condiciones) {
	return and(eq(table.tenantId, tenantId), ...condiciones);
}

// Uso típico (productos/+page.server.ts):
const actualizados = await db
	.update(productos)
	.set(p)
	.where(delTenant(productos, tid, eq(productos.id, id))) // ← id Y restaurante
	.returning({ id: productos.id });
if (actualizados.length === 0) return fail(404, { error: 'El producto no existe.' });
```

Patrón clave: **actualizar/borrar por id SIEMPRE junto con el restaurante**, y si no afectó filas responder **404** (no "no tienes permiso": así ni siquiera se revela que ese id existe en otro restaurante). Lo mismo aplica a referencias: al crear un plato se verifica que la **línea** sea del mismo restaurante; al asignar categoría a un producto, que la **categoría** sea del mismo restaurante.

Los **joins** también filtran: `innerJoin(productos, and(eq(...), eq(productos.tenantId, tid)))`.

Los **inserts** sin `tenantId` **no compilan** porque la columna es `NOT NULL` en el esquema de Drizzle.

### Capa 3 — Pruebas y CI que lo verifican

- `tests/tenant-isolation.test.ts` crea **dos restaurantes con datos marcados** ("SECRETO-A") en un Postgres real y, con la sesión del restaurante B:
  - carga **17 páginas** y verifica que ningún rastro de A aparezca;
  - ejecuta **18 acciones** con ids de A (editar, borrar, anular, recategorizar, comprar en bodega, colgar platos en su línea…) y verifica **404 y datos de A intactos**;
  - hace un **cierre de turno** de B y comprueba que el inventario de A no cambió.
- El CI (`.github/workflows/ci.yml`) falla si aparece un `db.update(...)` o `db.delete(...)` filtrado solo por `.id` sin restaurante.

> Regla para cualquier desarrollador nuevo: **si escribes una consulta y no ves `delTenant` o `tenantId`, está mal.**

## Autenticación de restaurantes

`src/routes/login/+page.server.ts` + `src/lib/server/auth.ts`

1. El login pide **código del restaurante + usuario + contraseña**. El código se recuerda en una cookie del dispositivo (solo para prellenar el campo).
2. Se busca el usuario **dentro de ese restaurante** (nombre sin distinguir mayúsculas) y se rechaza si el restaurante está **cancelado**.
3. La contraseña se verifica con **Argon2id**. Si el restaurante o el usuario no existen, igual se verifica contra un **hash señuelo**: el tiempo de respuesta es el mismo y no se puede adivinar qué dato era el correcto. El mensaje de error es siempre el mismo.
4. Se crea un token aleatorio de 160 bits; en la base se guarda solo su **SHA-256**. Cookie `session`: `HttpOnly`, `Secure` en producción, `SameSite=Lax`, 30 días, renovación automática cuando quedan menos de 15.
5. Cambiar el rol o la contraseña de un usuario, o borrarlo, **cierra sus sesiones**. Cancelar un restaurante cierra las de todos sus usuarios.

### Freno de fuerza bruta (`login-throttle.ts`)

- 5 intentos fallidos en 15 minutos → bloqueo de 15 minutos.
- Cuenta por **IP** y por **restaurante + usuario** (bloquear a un usuario no bloquea al mismo nombre en otro restaurante).
- La consola tiene su propio contador por correo.
- ⚠️ **Detrás de un balanceador (AWS) hay que configurar `ADDRESS_HEADER=X-Forwarded-For`**. Si no, todas las peticiones parecen venir de la IP del balanceador y 5 errores de cualquiera bloquearían a todos. Está en la guía de AWS.

## Roles dentro de un restaurante (`src/lib/auth/access.ts`)

| Rol                   | Inicio           | Puede entrar a                                                              |
| --------------------- | ---------------- | --------------------------------------------------------------------------- |
| `jefe`                | `/dashboard`     | Todo (sujeto a los módulos pagados)                                         |
| `bodeguero`           | `/bodega`        | Bodega, Cierre de turno                                                     |
| `cajero` / `empleado` | `/turnos/cierre` | Cierre de turno                                                             |
| Todos                 | —                | `/`, `/logout`, `/facturacion` (los no-jefes ven solo el aviso, sin montos) |

**Denegar por defecto**: un rol desconocido recibe los permisos mínimos (cajero). No puedes quitarle el rol de Jefe al último administrador ni borrarlo.

## Orden de decisión en `hooks.server.ts`

```
1. /plataforma/*  → sesión de plataforma (si no hay → /plataforma/login)
2. Ruta pública (/login, /health) → pasa
3. Sin usuario → /login
4. Rol no permitido → su página de inicio
5. Derechos del restaurante (plan):
     add-on no pagado        → /modulos?bloqueado=<módulo>
     escritura en solo lectura → /facturacion?motivo=solo-lectura
     suspendido               → /facturacion?motivo=suspendido
6. Encabezados de seguridad: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
```

Como las **acciones** (POST de formularios) comparten ruta con las páginas, el mismo control cubre ver y modificar. Las acciones sensibles (Estado de Resultados) vuelven a verificar el rol dentro de la acción como defensa en profundidad.

## Consola de plataforma

- Login propio con correo, Argon2 y freno de fuerza bruta.
- Cookie `psession` limitada a la ruta `/plataforma`, `SameSite=Strict`, **12 horas**.
- Cada acción (crear restaurante, pago, activar/cancelar módulo, cambiar precio o estado) queda en `auditoria_plataforma`.
- Recomendado en producción: **restringir `/plataforma` por IP con AWS WAF** (ver guía de AWS).

## Otras protecciones

- **CSRF**: SvelteKit rechaza POST de formularios desde otro origen (por eso en producción hay que configurar `ORIGIN`).
- **CSV seguro**: las exportaciones neutralizan celdas que empiezan con `= + - @` (inyección de fórmulas en Excel).
- **Antifraude Nequi**: un comprobante ya usado en un turno anterior (del mismo restaurante) bloquea el cierre.
- **Datos ajenos en el servidor**: valores como masas iniciales o porciones de ayer se leen de la base, nunca de campos ocultos del formulario.
- **Scripts destructivos** (`seed`, `reset-counts`, `seed-4dias`) exigen `--tenant` y `--confirmar`: es imposible borrar a todos los clientes por accidente.
