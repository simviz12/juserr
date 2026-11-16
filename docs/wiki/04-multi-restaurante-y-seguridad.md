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
- `tests/security-hooks.test.ts` verifica que **ninguna URL codificada** (`/pl%61taforma`, `/finanzas/re%73umen`…) salte la consola o el cobro de módulos.

> Regla para cualquier desarrollador nuevo: **si escribes una consulta y no ves `delTenant` o `tenantId`, está mal.**

## Autenticación de restaurantes

`src/routes/login/+page.server.ts` + `src/lib/server/auth.ts`

1. El login pide **código del restaurante + usuario + contraseña**. El código se recuerda en una cookie del dispositivo (solo para prellenar el campo).
2. Se busca el usuario **dentro de ese restaurante** (nombre sin distinguir mayúsculas) y se rechaza si el restaurante está **cancelado**.
3. La contraseña se verifica con **Argon2id**. Si el restaurante o el usuario no existen, igual se verifica contra un **hash señuelo**: el tiempo de respuesta es el mismo y no se puede adivinar qué dato era el correcto. El mensaje de error es siempre el mismo.
4. Se crea un token aleatorio de 160 bits; en la base se guarda solo su **SHA-256**. Cookie `session`: `HttpOnly`, `Secure` en producción, `SameSite=Lax`, 30 días, renovación automática cuando quedan menos de 15. **Caducidad absoluta: 90 días** desde el login (`sesiones.created_at`), aunque se use a diario.
5. Cambiar el rol o la contraseña de un usuario, o borrarlo, **cierra sus sesiones**. Cancelar un restaurante cierra las de todos sus usuarios.
6. La sesión se cachea **5 segundos** por instancia (antes 60): un cierre de sesión o un cambio de rol se aplica en todas las instancias en ≤ 5 s.
7. El usuario en sesión (`SessionUser`) **nunca incluye el hash de la contraseña**; al navegador solo llega `{ id, nombre, rol }`.
8. Contraseñas de 8 (Jefe) / mínimo del formulario hasta **256 caracteres** (Argon2 sobre textos enormes es caro).

### Freno de fuerza bruta (`login-throttle.ts`, tabla `intentos_login`)

- Se guarda en **Postgres**, compartido por todas las instancias (antes vivía en la memoria de cada proceso y en Vercel se multiplicaba por N).
- Cada intento se **cuenta antes de verificar** la contraseña con un UPSERT atómico: ráfagas en paralelo no se cuelan.
- Tres contadores en una ventana de 15 minutos:

| Clave       | Límite | Para qué                                                                                   |
| ----------- | ------ | ------------------------------------------------------------------------------------------ |
| IP + cuenta | 5      | Un atacante desde una IP agota rápido sus intentos                                         |
| Cuenta      | 20     | Ataque distribuido contra una cuenta (alto para que bloquear a alguien a propósito cueste) |
| IP          | 50     | Barrido de muchas cuentas (alto porque un restaurante comparte la IP del router)           |

- Un login correcto borra los contadores de la cuenta (el de la IP solo se descuenta).
- La consola usa las mismas reglas con la cuenta `plataforma:<correo>`.
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

Todas las decisiones se toman sobre la ruta **decodificada** (`rutaCanonica()`), que es la misma que usa SvelteKit para enrutar. Antes se comparaba `url.pathname` tal cual: `/pl%61taforma` no "parecía" la consola pero SvelteKit sí la servía. Una ruta mal codificada responde **400**.

```
0. Ruta decodificada (400 si está mal codificada)
1. /plataforma/* (por ruta o por route.id) → sesión de plataforma (si no hay → /plataforma/login)
2. Ruta pública (/login, /health) → pasa
3. Sin usuario → /login
4. Rol no permitido → su página de inicio
5. Derechos del restaurante (plan):
     add-on no pagado        → /modulos?bloqueado=<módulo>
     escritura en solo lectura → /facturacion?motivo=solo-lectura
     suspendido               → /facturacion?motivo=suspendido
6. Encabezados de seguridad (ver abajo)
```

### Defensa en profundidad (`src/lib/server/guards.ts`)

El hook es el control central, pero cada ruta sensible **vuelve a comprobar** sus requisitos, por si un bug de enrutamiento dejara pasar algo:

- `exigirAdminPlataforma(locals)` en **cada load y acción** de `/plataforma/**` (sin admin → 404).
- `exigirModulo(locals, '<código>')` en **cada load y acción** de los add-ons (`finanzas-avanzadas`, `estado-resultados`, `produccion`) y en la plantilla de `pnpm modulo:nuevo` (sin el módulo → 403).

Como las **acciones** (POST de formularios) comparten ruta con las páginas, el mismo control cubre ver y modificar. Las acciones sensibles (Estado de Resultados) vuelven a verificar el rol dentro de la acción como defensa en profundidad.

## Consola de plataforma

- Login propio con correo, Argon2 y freno de fuerza bruta.
- **Segundo factor (TOTP)** con cualquier app autenticadora (Google Authenticator, 1Password, Authy). Se activa por operador:
  - `pnpm plataforma:admin <correo> "<Nombre>" --totp` al crearlo, o
  - `pnpm plataforma:totp --activar <correo>` para uno existente (no toca la contraseña).
  - Con la variable `PLATFORM_REQUIRE_TOTP=1`, un operador **sin** TOTP no puede entrar.
- Cookie `psession` limitada a la ruta `/plataforma`, `SameSite=Strict`, **12 horas**.
- Cada acción (crear restaurante, pago, activar/cancelar módulo, cambiar precio o estado) queda en `auditoria_plataforma`.
- Recomendado en producción: **restringir `/plataforma` por IP con AWS WAF** (ver guía de AWS).

## Encabezados de seguridad

| Encabezado                                  | Valor                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`                   | Scripts solo propios con **nonce** (incluido el del tema en `app.html`); estilos propios + Google Fonts; `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'` |
| `Strict-Transport-Security`                 | 2 años, con subdominios (solo en producción)                                                                                                                                 |
| `X-Frame-Options`                           | `DENY`                                                                                                                                                                       |
| `Permissions-Policy`                        | Sin cámara, micrófono, geolocalización ni pagos                                                                                                                              |
| `Cross-Origin-Opener-Policy`                | `same-origin`                                                                                                                                                                |
| `X-Content-Type-Options`, `Referrer-Policy` | `nosniff`, `strict-origin-when-cross-origin`                                                                                                                                 |

La CSP se configura en `vite.config.ts` (`csp`). Si agregas un script o recurso externo, hay que permitirlo ahí.

## Otras protecciones

- **CSRF**: SvelteKit rechaza POST de formularios desde otro origen (por eso en producción hay que configurar `ORIGIN`).
- **CSV seguro**: las exportaciones neutralizan celdas que empiezan con `= + - @` (inyección de fórmulas en Excel).
- **Antifraude Nequi**: los comprobantes usados se guardan en `referencias_pago` (clave primaria por restaurante). Uno repetido bloquea el cierre, se revisa **todo el historial** (antes solo los últimos 2000 turnos) y ni siquiera dos cierres simultáneos pueden usar el mismo.
- **Datos ajenos en el servidor**: valores como masas iniciales o porciones de ayer se leen de la base, nunca de campos ocultos del formulario.
- **Scripts destructivos** (`seed`, `reset-counts`, `seed-4dias`) exigen `--tenant` y `--confirmar`: es imposible borrar a todos los clientes por accidente. Con `NODE_ENV=production` además exigen `--permitir-produccion`, y crean los usuarios con una **contraseña aleatoria** (antes `password123`).
- **Validación de montos**: efectivo, Nequi y gastos del cierre tienen tope de $10.000 millones; cantidades de bodega hasta 1.000.000; el método de pago de la consola se valida contra la lista permitida.
- **Errores**: nunca se muestran detalles internos. El usuario ve un **código de soporte** y el error completo queda en los logs (ver [página 8](08-pruebas-y-calidad.md#observabilidad)).
- **Credenciales en el código**: el CI falla si encuentra una cadena de conexión real, una llave de AWS o de Stripe en el repositorio.
