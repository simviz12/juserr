# 15. Estado de Resultados: ejemplo completo con números

Un mes ficticio de un restaurante, paso a paso, para entender **de dónde sale cada cifra** del informe `/finanzas/estado-resultados`.

> Estos números **no son inventados a mano**: son los mismos de la prueba automática `tests/income-statement.test.ts` ("calcula la cascada completa"), y se recalcularon con el código real de la app (`buildStatement` y `clasificarGasto`). Si alguien cambia la fórmula, esa prueba falla.

---

## 1. Lo que pasó en el mes (los datos de entrada)

### Ventas: salen de los cierres de turno

Cada turno cerrado aporta **efectivo + transferencias (Nequi)**. Aquí agrupamos los turnos en dos bloques:

| Origen                     | Valor           |
| -------------------------- | --------------- |
| Turnos de la semana 1–2    | $6.000.000      |
| Turnos de la semana 3–4    | $4.000.000      |
| **Ingresos operacionales** | **$10.000.000** |

### Registrados a mano en el Estado de Resultados (movimientos contables)

| Tipo                        | Concepto                    | Valor    |
| --------------------------- | --------------------------- | -------- |
| Devolución en ventas        | Pedido devuelto             | $150.000 |
| Descuento en ventas         | Descuento cliente frecuente | $50.000  |
| Otro ingreso no operacional | Venta de aceite usado       | $30.000  |

### Compras de Bodega

| Origen                                                        | Valor      |
| ------------------------------------------------------------- | ---------- |
| Compras de insumos registradas en **Bodega** (tipo "entrada") | $3.000.000 |

### Gastos (de la caja del turno o registrados a mano)

El sistema **clasifica solo** cada gasto leyendo las palabras del concepto. Esta es la clasificación real que hace la app con estos conceptos:

| Concepto escrito        | Valor      | Categoría que asigna la app      | Va a la sección…               |
| ----------------------- | ---------- | -------------------------------- | ------------------------------ |
| Hielo y carbón          | $200.000   | Insumos pagados por caja         | **Costo de ventas**            |
| Pago arriendo local     | $1.200.000 | Arriendos                        | Gastos operacionales           |
| Nómina quincena meseros | $1.800.000 | Nómina y personal                | Gastos operacionales           |
| Recibo de luz y agua    | $300.000   | Servicios públicos               | Gastos operacionales           |
| Comisión datáfono banco | $80.000    | Gastos financieros y bancarios   | Otros egresos (no operacional) |
| Impuesto ICA bimestre   | $400.000   | Impuestos y provisiones fiscales | Impuestos                      |

> Si la app se equivoca de categoría, el Jefe la cambia desde el desglose de la línea (clic en la línea → "Recategorizar"). La categoría puesta a mano siempre manda sobre la automática.

---

## 2. El informe que resulta

```
  (+) Ingresos operacionales                          10.000.000
  (−) Devoluciones y descuentos en ventas                200.000
        Devoluciones en ventas                 150.000
        Descuentos en ventas                    50.000
  (=) INGRESOS NETOS                                   9.800.000

  (−) Costo de ventas                                  3.200.000
        Compras de insumos (Bodega)          3.000.000
        Insumos pagados por caja               200.000
  (=) UTILIDAD BRUTA                                   6.600.000   margen 67,3 %

  (−) Gastos operacionales                             3.300.000
        Nómina y personal                    1.800.000
        Arriendos                            1.200.000
        Servicios públicos                     300.000
  (=) UTILIDAD OPERACIONAL                             3.300.000   margen 33,7 %

  (+) Otros ingresos no operacionales                     30.000
  (−) Otros egresos no operacionales                      80.000
        Gastos financieros y bancarios          80.000
  (=) UTILIDAD ANTES DE IMPUESTOS                      3.250.000

  (−) Impuestos y provisiones fiscales                   400.000
  (=) UTILIDAD NETA DEL PERIODO                        2.850.000   margen 29,1 %
```

Dentro de cada grupo, las categorías se muestran **de mayor a menor** (por eso Nómina va antes que Arriendos). Las categorías sin movimientos no aparecen.

---

## 3. Cada cuenta, explicada

| Línea                       | Cálculo                     | Resultado     |
| --------------------------- | --------------------------- | ------------- |
| Ingresos netos              | 10.000.000 − 200.000        | **9.800.000** |
| Utilidad bruta              | 9.800.000 − 3.200.000       | **6.600.000** |
| Utilidad operacional        | 6.600.000 − 3.300.000       | **3.300.000** |
| Utilidad antes de impuestos | 3.300.000 + 30.000 − 80.000 | **3.250.000** |
| Utilidad neta               | 3.250.000 − 400.000         | **2.850.000** |

### Márgenes (siempre sobre los **ingresos netos**, no sobre las ventas brutas)

| Margen      | Cálculo               | Resultado  |
| ----------- | --------------------- | ---------- |
| Bruto       | 6.600.000 ÷ 9.800.000 | **67,3 %** |
| Operacional | 3.300.000 ÷ 9.800.000 | **33,7 %** |
| Neto        | 2.850.000 ÷ 9.800.000 | **29,1 %** |

Cómo leerlos: de cada $100 que realmente entraron por ventas, quedan $67 después de pagar los insumos, $34 después de pagar la operación del local y **$29 de ganancia final**.

### Las tarjetas de arriba del informe

| Tarjeta                 | Cálculo                                                                                                | Resultado     |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------- |
| Ingresos totales        | Ingresos netos + otros ingresos = 9.800.000 + 30.000                                                   | **9.830.000** |
| Costos y gastos totales | Costo de ventas + operacionales + otros egresos + impuestos = 3.200.000 + 3.300.000 + 80.000 + 400.000 | **6.980.000** |
| Utilidad neta           | 9.830.000 − 6.980.000                                                                                  | **2.850.000** |

Las tres tarjetas **siempre cuadran** con la última línea del informe (la prueba automática lo verifica).

---

## 4. Si el mes da pérdida

Si los costos y gastos superan los ingresos, la última línea cambia de nombre a **"Pérdida neta del periodo"**, el valor sale **negativo** (por ejemplo −450.000) y el margen neto también es negativo. Nada se oculta ni se redondea a cero.

Un periodo **sin movimientos** muestra todo en $0 y los márgenes como "—" (no se divide por cero).

---

## 5. Reglas que conviene recordar

- **Base caja, gerencial:** una compra de Bodega cuenta como costo el día que se paga, no el día que se consume. No es un estado financiero NIIF; para impuestos y contabilidad oficial lo valida tu contador.
- **Día de negocio:** va de 04:00 a 04:00 (hora Colombia). Un turno cerrado a la 1 a. m. pertenece al día anterior.
- **Centavos exactos:** todo se suma en centavos enteros; 1.000 movimientos de $0,10 dan exactamente $100,00.
- **Lo anulado no cuenta:** un movimiento manual anulado sale del informe, pero queda registrado (quién y cuándo).
- **Qué va a "Costo de ventas":** las compras de Bodega **y** los gastos de caja de categoría _Insumos_ (hielo, carbón, carne, queso…). Por eso conviene escribir bien el concepto del gasto.
- **Qué NO es gasto operacional:** comisiones bancarias, intereses y datáfono (van a _otros egresos_), y los impuestos (tienen su propia línea).

## 6. Cómo reproducir este ejemplo en la app

1. Crea el restaurante de prueba: `node scripts/restaurante-prueba.mjs` (ver [página 9](09-operacion-diaria.md)).
2. Entra como `jefe-prueba` y registra en **Bodega** una compra con valor $3.000.000.
3. Cierra turnos por $10.000.000 en total (efectivo + Nequi) con los gastos de la tabla de arriba en la caja.
4. En **Estado de Resultados → Registrar movimiento**, agrega la devolución, el descuento y el otro ingreso.
5. Elige el rango del mes: el informe debe mostrar exactamente las cifras de la sección 2.
