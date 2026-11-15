# 6. Funciones del producto (con sus fórmulas)

Cada fórmula vive en un archivo de dominio puro y tiene pruebas. Estudia la fórmula aquí y luego ábrela en el código.

## Conceptos base

- **Día de negocio**: de **04:00 a 04:00** hora Colombia. Un turno cerrado a la 1:30 a.m. del martes pertenece al **lunes** (`businessDayKey()`, `features/finance/domain/period.ts`).
- **Comparación justa**: si el periodo está en curso (p. ej. el 1–9 de noviembre), se compara contra el **mismo tramo** del anterior (1–9 de octubre), no contra octubre completo (`previousRange()`).
- **Fracciones**: el inventario acepta "6 1/4", "2 1/2", "3/4" (`utils/fractions.ts`).

---

## Cierre de turno (Core) — `/turnos/cierre`

Archivos: `features/shifts/domain/close-shift.ts`, `features/shifts/domain/line-close.ts`, `features/shifts/server/close-shift.action.ts`.

### Pizzas (control por masas y porciones)

```
Masas usadas          = masas iniciales (bodega) − masas sobrantes (contadas)
Porciones vendidas    = masas usadas × 8 + porciones de vitrina de ayer − porciones sobrantes − mermas
```

- `PORCIONES_POR_MASA = 8`.
- **Masas iniciales** y **porciones de ayer** se leen de la bodega (servidor), **nunca del formulario**: el cajero solo declara lo que sobra. Así no puede "inflar" el inicio para ocultar faltantes.
- Las masas sobrantes no pueden superar las que había en bodega.
- **Por sabor**: `vendidas = sobras de ayer + ruedas × 8 − sobras − quemadas`.

### Otras líneas (hamburguesas, chuzos, lasañas, carnes) — control por insumo

Pensado para puestos callejeros: se cuenta un **insumo de control** (pan, chuzo armado, porción) al cierre.

```
Consumidas = inicial (bodega) − sobrantes (contados) − mermas

Venta esperada =
   si el desglose por plato explica exactamente el consumo (±0,01):  Σ cantidad × precio del plato
   si no:                                                             consumidas × precio promedio por unidad de control
```

- Cada plato define cuántas unidades del insumo consume (`unidades_control`, p. ej. 1 pan por hamburguesa).
- Si el desglose **no** cuadra, queda registrado como incompleto: puede indicar **panes que se fueron sin cobrar**.

### Dinero

```
Total declarado = efectivo contado + Nequi + gastos pagados con la caja
Diferencia      = total declarado − venta esperada (pizzas + líneas)
                  → verde: cuadra · azul: sobrante · rojo: faltante
```

### Antifraude de comprobantes

Las referencias Nequi (tokens de 4+ caracteres con al menos un dígito) se comparan con las de turnos anteriores **del mismo restaurante**. Un comprobante repetido bloquea el cierre.

### Guardado atómico

Se reserva el id del turno (`nextval`) y en **un solo lote** se guardan: turno, stock nuevo de masas y porciones, Nequi, gastos, ruedas, sobras, ventas por sabor, stock y conciliación de cada línea, y desglose de platos. Si algo falla, **no se guarda nada**.

Al terminar, la pantalla arma un **resumen para WhatsApp** y una **tirilla imprimible**.

---

## Bodega (Core) — `/bodega`

- **Compra (entrada)**: `stock nuevo = stock + cantidad`, y recalcula el **costo promedio ponderado**:
  ```
  costo nuevo = (stock anterior × costo anterior + valor de la compra) / stock nuevo
  ```
- **Conteo físico (ajuste)**: `stock nuevo = cantidad contada` (el movimiento registra la diferencia). No cambia el costo.
- Stock y movimiento se guardan juntos (atómico).
- **Alertas**: los productos con `stock ≤ stock mínimo` aparecen en la campana 🔔 y en el dashboard.

## Productos, líneas, sabores, categorías, personal (Core)

- **Productos**: catálogo de insumos (nombre único por restaurante, unidad, stock mínimo). "Masa" no se puede borrar (la usa el cierre). Un producto con movimientos no se borra (se conserva el historial).
- **Líneas y combos** (`/configuracion/rubros`): nombre del negocio, tipo de negocio, interruptores de líneas activas, platos con precio, costo y unidades de control, y el insumo de control de cada línea. El costo de un plato no puede superar su precio.
- **Sabores**: precio por porción y por rueda (por defecto, porción × 8). Si un sabor tiene ventas, se desactiva en vez de borrarse.
- **Personal**: usuarios con rol, contraseña de mínimo 8 caracteres y respeto del **límite de usuarios** del plan.

## Dashboard (Core) — `/dashboard`

Archivos: `features/finance/domain/metrics.ts`, `features/finance/server/dashboard.service.ts`.

| Indicador            | Fórmula                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Ventas brutas        | efectivo + transferencias de los turnos                                                         |
| Utilidad neta (caja) | ventas − gastos de caja − compras de insumos (**puede ser negativa**: una pérdida no se oculta) |
| Margen               | utilidad / ventas                                                                               |
| Food cost            | compras de insumos / ventas · **saludable ≤30 %**, vigilar ≤35 %, riesgo >35 %                  |
| Tasa de merma        | mermas / (vendidas + mermas)                                                                    |
| Ticket por turno     | ventas / número de turnos                                                                       |
| Variación            | (actual − anterior) / \|anterior\|, con banda de ±0,5 % = "estable"                             |

Filtros: día, semana, mes, año y fecha específica. Incluye un gráfico de flujo de caja (en la vista diaria muestra los últimos 7 días), la mezcla de cobro, el ranking de productos y las ventas por línea.

## Caja diaria (Core) — `/finanzas/caja`

Consolida los turnos de una **jornada** (04:00–04:00) en un cierre diario: efectivo, Nequi y gastos. Un día solo se cierra una vez y no se pueden cerrar días futuros.

---

## Finanzas avanzadas (add-on)

- **Resumen** (`/finanzas/resumen`): rango libre con accesos rápidos (este mes, mes anterior, 7 y 30 días); tablas por día, semana, turno, gasto y compra; gráfico; exportación a **PDF ejecutivo** y **Excel** con varias hojas.
- **Corte semanal** (`/finanzas/semanal`):
  ```
  Efectivo esperado = Σ efectivo de los turnos del rango   (ya viene neto de gastos de caja)
  Diferencia        = efectivo contado − esperado          → sobrante / faltante
  ```
- **Reporte mensual** (`/finanzas/mensual`): KPIs del mes contra el mes anterior, gastos agrupados por concepto, cortes del mes y PDF.

## Reporte de producción (add-on) — `/reportes/produccion`

Por día: masas realmente usadas, porciones vendidas, mermas y turnos, con exportación a Excel.

---

## Estado de Resultados (add-on) — `/finanzas/estado-resultados`

Archivos: `modules/estado-resultados/domain/income-statement.ts`, `.../statement-period.ts`, `.../server/income-statement.service.ts`.

### La cascada

```
  (+) Ingresos operacionales           ← turnos (efectivo + transferencias)
  (−) Devoluciones y descuentos        ← movimientos manuales
  (=) INGRESOS NETOS
  (−) Costo de ventas                  ← compras de Bodega + gastos categoría "Insumos"
  (=) UTILIDAD BRUTA          · margen bruto = utilidad bruta / ingresos netos
  (−) Gastos operacionales             ← gastos de caja + manuales, por categoría (nómina, arriendo, servicios…)
  (=) UTILIDAD OPERACIONAL    · margen operacional
  (+) Otros ingresos no operacionales  ← manuales
  (−) Otros egresos no operacionales   ← gastos financieros/bancarios y extraordinarios
  (=) UTILIDAD ANTES DE IMPUESTOS
  (−) Impuestos y provisiones          ← gastos categoría "Impuestos"
  (=) UTILIDAD (o PÉRDIDA) NETA       · margen neto
```

- **Centavos enteros** en todo el cálculo.
- **Clasificación automática** de gastos por palabras del concepto: "arriendo" → Arriendos, "luz/agua/gas" → Servicios, "nómina/sueldo" → Nómina, "IVA/ICA/DIAN" → Impuestos, "hielo/queso/carne" → Insumos (costo de ventas). Compara palabras completas: "gas" ≠ "gaseosa". El Jefe puede **reasignar** la categoría desde el desglose.
- **Movimientos manuales** (arriendo, nómina, impuestos, devoluciones, otros ingresos): se registran en el mismo informe y **se anulan** (nunca se borran).
- **Comparativo**: contra el periodo anterior (o el mismo tramo del mes anterior) o contra el mismo periodo del año pasado; diferencia en pesos y en %. Un aumento de un gasto se pinta como desfavorable.
- **Desglose** (drill-down): clic en cualquier línea muestra los registros que la componen.
- **Exportación**: PDF (con detalle si son ≤150 movimientos), Excel (con hoja de detalle) y CSV en formato colombiano (`;` y coma decimal).
- Es **gerencial y en base caja**: las compras cuentan como costo cuando se pagan, no cuando se consumen.
