# 1. Visión y modelo de negocio

## El problema que resuelve

Los restaurantes pequeños y medianos de Colombia (pizzerías, puestos de chuzos, hamburgueserías, asaderos) pierden dinero en tres lugares que casi nunca miden:

1. **La caja del turno**: el efectivo y los pagos por Nequi/Daviplata no cuadran con lo que se vendió, y nadie sabe por qué.
2. **El inventario**: se compran insumos pero no se sabe cuánto se consumió realmente, cuánto se quemó o cuánto "desapareció".
3. **La rentabilidad**: el dueño ve que entra plata, pero no sabe si gana o pierde después de arriendo, nómina, servicios e impuestos.

MesaCapital convierte cada cierre de turno en una **auditoría**: a partir del inventario que se cuenta al final (masas sobrantes, panes, porciones) el sistema **deduce cuánto se debió vender** y lo compara con el dinero declarado. Si falta plata o falta inventario, aparece.

## A quién se le vende

| Segmento                         | Dolor principal                                    | Qué módulos le sirven                            |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Puesto callejero / carreta       | Faltantes de caja, empleados de confianza limitada | Core                                             |
| Pizzería de barrio               | Porciones regaladas o quemadas, food cost alto     | Core + Producción                                |
| Restaurante con varios empleados | No sabe si gana plata                              | Core + Finanzas avanzadas + Estado de Resultados |
| Dueño con varios locales         | Necesita consolidar                                | Core por local (multi-sede está en el roadmap)   |

## El modelo en una frase

> **Un esqueleto (Core) igual para todos + funciones que cada restaurante pide y que son SOLO suyas.**

1. Todos los restaurantes usan el mismo **Core** y pagan su mensualidad.
2. Cuando un restaurante necesita algo propio, **se lo construyes como función exclusiva**: solo él la ve y la usa, y se la cobras cada mes con un precio pactado con él ([página 7](07-como-agregar-un-modulo.md)).
3. Si algo le sirve a muchos, lo vendes como **add-on general**.

## Cómo se cobra: SaaS mensual Core + add-ons + funciones exclusivas

```
Mensualidad del restaurante = Plan Core + Σ módulos adicionales contratados
```

| Módulo                      | Precio de lista inicial* | Qué incluye                                                                                                      |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Plan Core** (obligatorio) | $69.000/mes              | Cierre de turno con arqueo, bodega, productos, líneas y sabores, caja diaria, dashboard, personal, configuración |
| Finanzas avanzadas          | $25.000/mes              | Resumen por rango, corte semanal, reporte mensual, PDF/Excel                                                     |
| Estado de Resultados        | $29.000/mes              | P&L en cascada, márgenes, comparativos, desglose, exportación                                                    |
| Reporte de producción       | $15.000/mes              | Producción y ventas por línea y por plato                                                                        |

\* Los precios se cambian en la consola (`/plataforma/catalogo`). Cada cliente guarda su **precio pactado**: si le das descuento a uno, no afecta a los demás.

### Reglas del cobro (resumen; detalle en [la página 5](05-planes-modulos-y-facturacion.md))

- Cada módulo tiene una fecha **"pagado hasta"**.
- Al vencer: **días de gracia** (5 por defecto) con aviso → luego **solo lectura** (Core) o **bloqueo** (add-on).
- El cliente **nunca pierde sus datos** por no pagar: puede consultar y exportar.
- Activar un módulo a mitad de mes cobra un **prorrateo** para que todo venza el mismo día.

## Por qué este modelo funciona

- **Ingreso recurrente predecible (MRR)**: la consola lo calcula en tiempo real.
- **Ticket que crece con el cliente**: empieza con Core y sube a medida que el restaurante madura.
- **Desarrollos a medida rentables y exclusivos**: lo que pide un cliente se construye como **función exclusiva** (`pnpm modulo:nuevo`). Solo él la ve, se cobra mensual y no afecta a los demás (ver [página 7](07-como-agregar-un-modulo.md)).
- **Bajo costo marginal**: todos los clientes comparten la misma aplicación y la misma base de datos.

## Lo que el producto NO es (para venderlo bien)

- **No es un POS con facturación electrónica DIAN.** No emite facturas al consumidor final. Si un cliente necesita eso, debe usar su POS/facturador; MesaCapital controla la caja y el inventario de su operación.
- **El Estado de Resultados es gerencial (base caja)**, no un estado financiero bajo NIIF. Sirve para decidir, no para presentar ante la DIAN o un banco.

Decirlo de entrada evita reclamos y genera confianza.
