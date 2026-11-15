# 5. Planes, módulos y facturación

## Las tres piezas

```
modulos_catalogo          suscripciones_modulo                 registry.ts
(lo que se vende)         (lo que tiene cada restaurante)      (qué pantallas son de qué módulo)
──────────────────        ─────────────────────────────        ──────────────────────────────────
core       $69.000        tenant 1 · core       hasta 14-dic    finanzas-avanzadas → /finanzas/resumen,
produccion $15.000        tenant 1 · produccion hasta 14-dic                         /finanzas/semanal,
...                       tenant 4 · core       hasta 28-dic                         /finanzas/mensual
                                                                estado-resultados  → /finanzas/estado-resultados
                                                                produccion         → /reportes/produccion
                                                                (todo lo demás = Core)
```

## Tres tipos de módulo

- **Core**: el esqueleto, para todos.
- **ADDONS** (add-ons generales): cualquier restaurante los puede contratar.
- **EXCLUSIVOS**: hechos a pedido de un restaurante; solo existen para él. Ver [página 7](07-como-agregar-un-modulo.md).

## Registro de módulos (`src/lib/modules/registry.ts`)

```ts
export const ADDONS = [
	{
		codigo: 'finanzas-avanzadas',
		nombre: 'Finanzas avanzadas',
		rutas: ['/finanzas/resumen', '/finanzas/semanal', '/finanzas/mensual']
	},
	{
		codigo: 'estado-resultados',
		nombre: 'Estado de Resultados',
		rutas: ['/finanzas/estado-resultados']
	},
	{ codigo: 'produccion', nombre: 'Reporte de producción', rutas: ['/reportes/produccion'] }
];
```

- `moduloDeRuta(path)` → a qué add-on pertenece una ruta (respeta límites: `/finanzas/resumenes` **no** es `/finanzas/resumen`).
- `evaluarAcceso(path, entitlements, escritura)` → `ok` | `modulo-no-contratado` | `solo-lectura` | `suspendido`.
- `rutaDisponible(path, entitlements)` → la misma regla, usada por el menú para el candado 🔒.

## Derechos del restaurante ("entitlements")

`calcularEntitlements(tenant, suscripciones, hoy)` en `src/lib/billing/domain.ts` devuelve:

```ts
{
  estadoCore: 'al-dia' | 'gracia' | 'solo-lectura' | 'suspendido',
  modulos: ['produccion', ...],     // add-ons utilizables hoy
  coreVigenteHasta: '2026-12-28',
  diasParaVencer: 14,               // negativo = vencido
  diasGraciaRestantes: null         // solo en 'gracia'
}
```

### Estado de cada módulo

```
           vigente_hasta                   vigente_hasta + días de gracia
                 │                                      │
  ── VIGENTE ────┤──────────── GRACIA ──────────────────┤──────── VENCIDO ────────►  tiempo
                 │  (funciona, con aviso ámbar)         │
```

- **Core vigente** → `al-dia`. **Core en gracia** → `gracia` (todo funciona, banner con días restantes).
- **Core vencido** → `solo-lectura`: puede ver y exportar, no registrar. **Nunca se borran datos.**
- **Sin suscripción al Core** → `solo-lectura`.
- **Restaurante suspendido/cancelado** por la plataforma → `suspendido`, sin módulos (gana sobre cualquier pago).
- **Add-on** vigente o en gracia → incluido en `modulos`; vencido o cancelado → bloqueado. **Un add-on impago nunca afecta al Core.**

## Reglas de dinero (todas puras y probadas en `tests/billing.test.ts`)

| Función                               | Regla                                                                                               | Ejemplo                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `extenderVigencia(hasta, hoy, meses)` | Si está al día, extiende **desde el vencimiento** (no se pierden días); si ya venció, **desde hoy** | Al día hasta 30-nov + 1 mes → 1-dic a 31-dic. Vencido + 1 mes desde 14-nov → hasta 13-dic |
| `sumarMeses`                          | Meses calendario; 31-ene + 1 mes = 28/29-feb                                                        |                                                                                           |
| `prorrateoCents(precio, hoy, hasta)`  | `precio × días / 30`, redondeado **hacia arriba al peso**                                           | $15.000 por 15 días → $7.500                                                              |
| `totalMensualCents(subs)`             | Suma de los módulos **activos** (precio pactado)                                                    | Core 69.000 + Producción 15.000 = $84.000                                                 |

## Casos de uso del servidor (`src/lib/billing/server.ts`)

| Función                    | Qué hace (siempre en un lote atómico + auditoría)                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `crearRestaurante`         | Valida el código, crea tenant + configuración + usuario Jefe + suscripciones (Core + elegidos) con N días de prueba                      |
| `registrarPago`            | Extiende la vigencia de los módulos elegidos por N meses, guarda el pago (monto recibido y calculado)                                    |
| `activarModulo`            | Activa o reactiva un add-on **alineado con el vencimiento del Core**; opcionalmente cobra el prorrateo; marca la solicitud como atendida |
| `cancelarModulo`           | Deja de facturarse y se bloquea (el Core no se cancela: se suspende el restaurante)                                                      |
| `cambiarPrecioModulo`      | Precio pactado de un cliente (aplica desde el próximo pago)                                                                              |
| `cambiarEstadoRestaurante` | `activo` / `suspendido` / `cancelado` (cancelar cierra todas sus sesiones)                                                               |
| `actualizarRestaurante`    | Nombre, contacto, límite de usuarios, días de gracia                                                                                     |
| `actualizarCatalogo`       | Precio de lista, descripción y visibilidad de un módulo                                                                                  |
| `solicitarModulo`          | (desde el restaurante) Crea una solicitud pendiente                                                                                      |

Después de cada cambio se llama `invalidarDerechos(tenantId)` para que el cambio se vea de inmediato.

## Pantallas

### Del restaurante

- **`/facturacion`**: módulos con su estado ("Al día", "En gracia", "Vencido"), precio, "pagado hasta", total mensual, **instrucciones de pago** (variable `PAGO_INSTRUCCIONES`), botón de WhatsApp (`SOPORTE_WHATSAPP`) con mensaje prellenado e historial de pagos. Los roles no-jefe ven solo el aviso.
- **`/modulos`**: catálogo de add-ons públicos con precio y botón **"Solicitar activación"**. Si llegó por intentar abrir un módulo bloqueado, ese módulo aparece resaltado.
- **Banner global** (`components/billing/PlanBanner.svelte`): plan por vencer (≤5 días), en gracia, solo lectura o suspendido.

### De la consola (`/plataforma`)

- **Restaurantes**: KPIs (activos, **MRR**, por vencer, vencidos), solicitudes pendientes, tabla con buscador.
- **Nuevo restaurante**: el código se sugiere a partir del nombre, total mensual en vivo.
- **Ficha del restaurante**: módulos (cambiar precio, cancelar/reactivar), activar módulo con prorrateo, registrar pago (por defecto todos los módulos activos × 1 mes; "monto recibido" opcional para descuentos), historial de pagos, datos, estado del servicio, actividad reciente.
- **Catálogo y precios**: editar precio de lista, descripción y visibilidad.

## Flujo comercial típico

```
1. Prospecto → creas el restaurante con 15 días de prueba (Core + lo que quiera probar)
2. Le entregas: código, usuario Jefe y contraseña inicial
3. Día 15: vence → 5 días de gracia con aviso → cobras por Nequi/transferencia
4. Registras el pago en la consola → "pagado hasta" +1 mes
5. Pide un add-on desde /modulos → aparece en tu consola → lo activas con prorrateo
6. Cada mes: revisa "Vencen en ≤5 días" y cobra
```

## Conectar una pasarela de pago (siguiente paso)

Hoy el cobro es manual. Para cobro automático (Wompi, Mercado Pago, PayU):

1. Crea en la pasarela un **link de pago o una suscripción** por el total mensual del restaurante e incluye su `codigo` como referencia.
2. Agrega una ruta `src/routes/api/webhooks/<pasarela>/+server.ts` que:
   - **verifique la firma** del webhook con el secreto de la pasarela (nunca confíes en el cuerpo sin verificar);
   - sea **idempotente** (guarda el id del evento; si llega dos veces, no registra dos pagos);
   - busque el restaurante por la referencia y llame a `registrarPago()` con `metodo: 'wompi'` (o la que corresponda).
3. Agrega `'wompi'` (o la pasarela) a `METODOS_PAGO` en `billing/server.ts` y la ruta del webhook a `PUBLIC_PATHS` en `access.ts`.
4. `registrarPago()` recibe hoy un `adminId`: para pagos automáticos créale un operador técnico ("Pasarela") en `platform_admins` y usa su id, así la auditoría muestra quién registró cada pago.

La lógica de vigencias no cambia: el webhook solo reemplaza el "registrar pago" manual.
