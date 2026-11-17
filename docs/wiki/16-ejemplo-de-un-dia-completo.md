# 16. Ejemplo de un día completo: de la Bodega al Estado de Resultados

Un día de un restaurante que vende **pizza por porción** y **hamburguesas**, seguido de principio a fin: compra en Bodega → cierre de turno → cuadre de caja → dashboard → Estado de Resultados.

> Las cifras **no están hechas a mano**: se calcularon con las mismas funciones que usa la app (`porcionesVendidas`, `cerrarLinea`, `summarize`, `clasificarGasto`, `buildStatement`). Para el ejemplo de un **mes** con todas las secciones del informe (devoluciones, impuestos, márgenes), ve a la [página 15](15-estado-de-resultados-ejemplo.md).

---

## Punto de partida (lo que había en Bodega al abrir)

| Insumo                              | Stock       | Costo unitario |
| ----------------------------------- | ----------- | -------------- |
| Masa                                | 10 masas    | $11.000        |
| Pizza (Porciones) — vitrina de ayer | 4 porciones | —              |
| Pan de hamburguesa                  | 40 panes    | —              |

Platos de la línea **Hamburguesas** (cada uno consume **1 pan**):

| Plato               | Precio  | Costo   |
| ------------------- | ------- | ------- |
| Hamburguesa clásica | $18.000 | $7.000  |
| Hamburguesa doble   | $26.000 | $11.000 |

Precio de la porción de pizza: **$7.000** (promedio de los sabores activos).

---

## 1. Bodega: llega una compra (10:00 a. m.)

El bodeguero registra **5 masas por $60.000**.

| Concepto             | Cálculo                     | Resultado      |
| -------------------- | --------------------------- | -------------- |
| Stock nuevo          | 10 + 5                      | **15 masas**   |
| Costo promedio nuevo | (10 × 11.000 + 60.000) ÷ 15 | **$11.333,33** |

- El costo promedio ponderado solo cambia con compras que tienen valor.
- La compra se guarda en **una sola operación** con bloqueo: si en ese mismo segundo alguien cierra un turno, ninguna de las dos se pierde.
- Esta compra de $60.000 es la que luego aparece como **costo de ventas** en el Estado de Resultados.

---

## 2. Cierre de turno (10:00 p. m.)

El cajero solo **cuenta lo que sobra**. Lo que había al empezar lo pone el sistema desde Bodega (no se puede manipular desde el formulario).

### Pizzas: control por masas y porciones

| Dato                         | Quién lo pone    | Valor |
| ---------------------------- | ---------------- | ----- |
| Masas al iniciar             | Sistema (Bodega) | 15    |
| Masas que sobraron           | Cajero (cuenta)  | 3     |
| Porciones de ayer en vitrina | Sistema          | 4     |
| Porciones que sobraron       | Cajero (cuenta)  | 5     |
| Porciones dañadas (mermas)   | Cajero           | 3     |

```
Masas usadas        = 15 − 3              = 12 masas
Porciones nuevas    = 12 × 8              = 96 porciones   (1 masa = 8 porciones)
Porciones vendidas  = 96 + 4 − 5 − 3      = 92 porciones
Venta de pizza      = 92 × $7.000         = $644.000
```

> Si el restaurante detalla por **sabor**, cada sabor sigue la misma idea: `vendidas = sobras de ayer + ruedas × 8 − sobras de hoy − quemadas`. Ejemplo: 2 + 6 × 8 − 3 − 1 = **46 porciones** de ese sabor.

### Hamburguesas: control por insumo (el pan)

| Dato                   | Quién lo pone    | Valor |
| ---------------------- | ---------------- | ----- |
| Panes al iniciar       | Sistema (Bodega) | 40    |
| Panes que sobraron     | Cajero (cuenta)  | 12    |
| Panes dañados (mermas) | Cajero           | 1     |

```
Panes consumidos = 40 − 12 − 1 = 27   → 27 hamburguesas vendidas
```

**Con desglose** (el cajero dice qué se vendió: 20 clásicas y 7 dobles = 27, cuadra exacto):

```
Venta esperada = 20 × $18.000 + 7 × $26.000 = $360.000 + $182.000 = $542.000
```

**Sin desglose** (si el cajero no detalla), el sistema usa el precio promedio por pan: (18.000 + 26.000) ÷ 2 = $22.000, y la venta esperada sería 27 × $22.000 = **$594.000**. Por eso conviene registrar el desglose: es más exacto.

### El cuadre del turno

```
Venta esperada = pizza $644.000 + hamburguesas $542.000 = $1.186.000
```

Lo que declara el cajero:

| Concepto                                        | Valor          |
| ----------------------------------------------- | -------------- |
| Efectivo contado                                | $800.000       |
| Nequi (con comprobante `M48213`)                | $350.000       |
| Gastos pagados con la caja: Hielo               | $15.000        |
| Gastos pagados con la caja: Domicilio pedido 12 | $21.000        |
| **Total declarado**                             | **$1.186.000** |

```
Diferencia = declarado − esperado = 1.186.000 − 1.186.000 = $0   → ✅ CUADRADO
```

Los gastos **suman** al declarado porque ese dinero salió de la caja durante el turno.

| Si el cajero hubiera contado… | Diferencia | Estado que muestra la app |
| ----------------------------- | ---------- | ------------------------- |
| $800.000 en efectivo          | $0         | ✅ Cuadrado               |
| $790.000 en efectivo          | −$10.000   | 🔴 **Faltante**           |
| $815.000 en efectivo          | +$15.000   | 🟡 Sobrante               |

### Qué guarda el sistema al cerrar (todo en un solo lote: o se guarda todo o nada)

- Turno #N con efectivo, Nequi, conteos y porciones vendidas.
- **Stock de masas:** se **descuentan** las 12 usadas → 15 − 12 = **3 masas** (no se "fija" en 3: si alguien registró otra compra mientras tanto, se respeta).
- **Vitrina:** queda en las **5 porciones** contadas (para el turno de mañana).
- **Pan:** se descuentan 28 (27 vendidos + 1 merma) → **12 panes**.
- Los 2 gastos, el pago Nequi y el comprobante `M48213` (que ya **no podrá usarse** en otro turno).
- Si el cajero hace **doble clic** en "Cerrar turno", el segundo envío se reconoce y **no crea otro turno**.

---

## 3. Caja diaria (`/finanzas/caja`)

El Jefe cierra la caja del día (consolida todos los turnos de la jornada de 04:00 a 04:00):

| Efectivo | Nequi    | Gastos  | Total del día |
| -------- | -------- | ------- | ------------- |
| $800.000 | $350.000 | $36.000 | $1.150.000    |

Solo puede haber **un cierre de caja por día** (la base lo impide aunque se pulse dos veces).

---

## 4. Dashboard del día (`/dashboard`)

| Indicador             | Cálculo                               | Resultado           |
| --------------------- | ------------------------------------- | ------------------- |
| Ventas brutas         | 800.000 + 350.000                     | **$1.150.000**      |
| Gastos de caja        | 15.000 + 21.000                       | $36.000             |
| Compras (Bodega)      | la compra de las 10:00                | $60.000             |
| Utilidad              | 1.150.000 − 36.000 − 60.000           | **$1.054.000**      |
| Margen                | 1.054.000 ÷ 1.150.000                 | 91,7 %              |
| Food cost             | compras ÷ ventas = 60.000 ÷ 1.150.000 | 5,2 % → "saludable" |
| Tasa de merma (pizza) | 3 ÷ (92 + 3)                          | 3,2 %               |

> ⚠️ **Por qué un solo día se ve "demasiado bueno":** el sistema es **base caja**. Ese día solo se compraron 5 masas, pero se vendió con insumos comprados antes (las 10 masas y los 40 panes que ya había). El food cost real se lee en **semanas o meses**, no en un día. La meta de referencia es **≤ 30 %** (saludable), hasta 35 % (vigilar), más de 35 % (riesgo).

---

## 5. Estado de Resultados de ese día (`/finanzas/estado-resultados`)

La app clasifica sola los gastos por el concepto:

| Gasto               | Categoría                | Sección              |
| ------------------- | ------------------------ | -------------------- |
| Hielo               | Insumos pagados por caja | **Costo de ventas**  |
| Domicilio pedido 12 | Ventas y domicilios      | Gastos operacionales |

```
  (+) Ingresos operacionales                  1.150.000
  (=) INGRESOS NETOS                          1.150.000
  (−) Costo de ventas                            75.000
        Compras de insumos (Bodega)     60.000
        Insumos pagados por caja        15.000
  (=) UTILIDAD BRUTA                          1.075.000   margen 93,5 %
  (−) Gastos operacionales                       21.000
        Ventas y domicilios             21.000
  (=) UTILIDAD OPERACIONAL                    1.054.000   margen 91,7 %
  (=) UTILIDAD NETA DEL PERIODO               1.054.000   margen 91,7 %
```

Fíjate que la **utilidad neta del Estado de Resultados ($1.054.000) es la misma que la del dashboard**: las dos pantallas cuentan los mismos ingresos, gastos y compras; el Estado de Resultados solo los ordena por secciones contables.

---

## 6. Resumen: de dónde sale cada número

```
Bodega ──compra $60.000──────────────────────────────────────► Costo de ventas
   │
   └─ stock inicial (masas, panes) ─► Cierre de turno ─► venta esperada $1.186.000
                                          │
                     efectivo + Nequi ────┼──► Ingresos $1.150.000 ─► Dashboard / ER
                     gastos de caja ──────┴──► Hielo → costo · Domicilio → operacional
                                                       │
                                              Caja diaria (1 por día)
```

## 7. Probarlo tú mismo

1. `node scripts/restaurante-prueba.mjs` → entra como `jefe-prueba` (ver [página 9](09-operacion-diaria.md)).
2. **Líneas y combos:** activa Pizzas y Hamburguesas; crea los dos platos con sus precios.
3. **Bodega:** deja Masa en 10 (conteo), Pan en 40, y registra la compra de 5 masas por $60.000.
4. **Cierre de turno:** escribe los conteos y el dinero de la sección 2. La pantalla debe mostrar **venta esperada $1.186.000** y **Cuadrado**.
5. Revisa **Bodega** (3 masas, 12 panes), **Caja**, **Dashboard** y **Estado de Resultados**: deben dar las cifras de las secciones 3 a 5.
