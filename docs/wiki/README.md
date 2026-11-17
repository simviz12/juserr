# 📚 Wiki de MesaCapital

Documentación completa del sistema para **entenderlo, estudiarlo, operarlo y venderlo**. Está escrita para leerse en orden, pero cada página se sostiene sola.

> Convención: cuando aparece una ruta como `src/lib/billing/domain.ts`, es un archivo real del repositorio; ábrelo junto a la página para estudiar el código.

## Ruta de estudio recomendada

| #   | Página                                                                     | Qué vas a entender                                                                                                      | Tiempo |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | [Visión y modelo de negocio](01-vision-y-modelo-de-negocio.md)             | Qué vendemos, a quién, cómo se cobra                                                                                    | 10 min |
| 2   | [Arquitectura](02-arquitectura.md)                                         | Capas, carpetas y el recorrido de una petición de punta a punta                                                         | 25 min |
| 3   | [Base de datos](03-base-de-datos.md)                                       | Cada tabla, sus relaciones y por qué está diseñada así                                                                  | 25 min |
| 4   | [Multi-restaurante y seguridad](04-multi-restaurante-y-seguridad.md)       | Cómo se aíslan los clientes, sesiones, roles, protección del login                                                      | 25 min |
| 5   | [Planes, módulos y facturación](05-planes-modulos-y-facturacion.md)        | Core + add-ons, vigencias, gracia, prorrateo, consola del dueño                                                         | 25 min |
| 6   | [Funciones del producto](06-funciones-del-producto.md)                     | Fórmulas del cierre de turno, bodega, dashboard, finanzas, Estado de Resultados                                         | 30 min |
| 7   | [Funciones exclusivas](07-como-agregar-un-modulo.md)                       | **El corazón del modelo**: construir una función que SOLO tiene el restaurante que la pidió (`pnpm modulo:nuevo`)       | 20 min |
| 8   | [Pruebas y calidad](08-pruebas-y-calidad.md)                               | Qué prueba cada test, CI, cómo verificar antes de publicar                                                              | 15 min |
| 9   | [Operación diaria](09-operacion-diaria.md)                                 | Migraciones, scripts, alta de clientes, cobros, respaldos, incidentes                                                   | 20 min |
| 10  | [Despliegue](10-despliegue-aws.md)                                         | Producción actual en Vercel, procedimiento de cada despliegue (respaldo, migración, verificación, reversa) y paso a AWS | 45 min |
| 11  | [Checklist de salida a producción y venta](11-checklist-salida-y-venta.md) | Lo técnico, lo comercial y lo legal antes de cobrarle al primer cliente                                                 | 15 min |
| 12  | [Historial de cambios](12-historial-de-cambios.md)                         | Qué cambiamos, por qué y dónde quedó cada cosa                                                                          | 15 min |
| 13  | [Glosario](13-glosario.md)                                                 | Términos del negocio y técnicos                                                                                         | —      |
| 14  | [Auditoría 2026-11](14-auditoria-2026-11.md)                               | Qué se corrigió en la auditoría y qué queda pendiente                                                                   | —      |
| 15  | [Estado de Resultados: ejemplo](15-estado-de-resultados-ejemplo.md)        | Un mes completo con números: de dónde sale cada cifra, márgenes y tarjetas                                              | —      |
| 16  | [Ejemplo de un día completo](16-ejemplo-de-un-dia-completo.md)             | Bodega → cierre de turno → caja → dashboard → Estado de Resultados, con números                                         | —      |
| 17  | [Registrar movimiento](17-registrar-movimiento.md)                         | Por qué existe el botón del Estado de Resultados, los 4 tipos, categorías, anular y rutina de fin de mes                | —      |

## Mapa mental en 30 segundos

```
                    ┌─────────────────────────────── PLATAFORMA (tú) ───────────────────────────────┐
                    │  /plataforma  → alta de restaurantes · pagos · módulos · precios · MRR        │
                    └───────────────────────────────────────┬────────────────────────────────────────┘
                                                            │ activa/vence módulos
   ┌──────────── RESTAURANTE A ────────────┐    ┌───────────▼─── RESTAURANTE B ───────────┐
   │ Plan Core  (cierre, bodega, caja…)    │    │ Plan Core                               │
   │ + Estado de Resultados (add-on)       │    │ + Producción (add-on)                   │
   │ usuarios: jefe, cajero…               │    │ usuarios: jefe…                         │
   └───────────────────┬───────────────────┘    └───────────────────┬─────────────────────┘
                       │  tenant_id = A                             │  tenant_id = B
                       └──────────────► UNA sola base PostgreSQL ◄──┘
                                       (cada fila sabe de quién es)
```

## Si solo tienes 10 minutos

1. Un **restaurante = tenant**. Todas las tablas de negocio tienen `tenant_id` y toda consulta filtra por él (`delTenant`).
2. El **acceso** se decide en un solo lugar: `src/hooks.server.ts` → rol → plan pagado → módulo → solo lectura.
3. Lo que **se vende** está en `src/lib/modules/registry.ts` (qué rutas son de qué módulo) y en la tabla `modulos_catalogo` (precios).
4. El **dinero** se calcula en **centavos enteros** para no tener errores de redondeo.
5. Antes de publicar: `pnpm lint && pnpm check && pnpm vitest run && pnpm build` (lo mismo que corre el CI).
