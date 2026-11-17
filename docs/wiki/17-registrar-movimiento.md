# 17. ¿Para qué sirve "Registrar movimiento" en el Estado de Resultados?

En `/finanzas/estado-resultados` hay un botón **"Registrar movimiento"**. Esta página explica por qué existe, qué registra cada tipo y cómo cambia el informe.

> **Aclaración: esto no es un Balance General.** MesaCapital genera un **Estado de Resultados** (pérdidas y ganancias: cuánto entró, cuánto salió y cuánto quedó en un periodo). Un **Balance General** muestra otra cosa: lo que el negocio **tiene** (caja, inventario, equipos) y lo que **debe** (proveedores, préstamos) en una fecha. La app no lleva activos, pasivos ni patrimonio; ese informe lo prepara tu contador.

---

## El problema que resuelve

El Estado de Resultados se arma **solo** con lo que ya pasa por la app:

| Ya lo sabe la app                    | De dónde                                          |
| ------------------------------------ | ------------------------------------------------- |
| Ventas                               | Cierres de turno (efectivo + Nequi)               |
| Compras de insumos                   | Bodega                                            |
| Gastos pagados con la caja del turno | Los gastos que el cajero anota al cerrar el turno |

Pero muchos gastos e ingresos **nunca pasan por la caja del turno**: el arriendo se paga por transferencia desde el banco, la nómina el día de quincena, los impuestos en la DIAN, la comisión del banco se descuenta sola. Si no se registran, el informe **muestra más utilidad de la que realmente hay**.

"Registrar movimiento" existe para agregar esos valores y que el resultado sea el real.

### Ejemplo con los datos reales de ChuzoOS (octubre de 2026)

Hoy el informe de octubre solo contiene turnos, compras de Bodega y gastos de caja (verificado contra la base el 17-11-2026):

|                      | Sin movimientos manuales | Registrando nómina ($4.000.000) y arriendo ($1.500.000) |
| -------------------- | ------------------------ | ------------------------------------------------------- |
| Ingresos netos       | $51.991.469              | $51.991.469                                             |
| Costo de ventas      | $9.420.136               | $9.420.136                                              |
| Gastos operacionales | $321.900                 | **$5.821.900**                                          |
| **Utilidad neta**    | **$42.249.433**          | **$36.749.433**                                         |
| Margen neto          | 81,3 %                   | **70,7 %**                                              |

La nómina y el arriendo de este cuadro son **valores de ejemplo**, no los reales del restaurante. Un margen neto de 81 % en un restaurante es una señal clara de que faltan gastos por registrar: lo normal está muy por debajo.

---

## Los cuatro tipos de movimiento

| Tipo                            | Cuándo usarlo                                                                                                     | Dónde cae en el informe                                     | Efecto en la utilidad |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------- |
| **Devolución en ventas**        | Le devolviste el dinero a un cliente (pedido malo, error de cobro)                                                | (−) Devoluciones y descuentos → baja los **ingresos netos** | Resta                 |
| **Descuento en ventas**         | Descuentos dados después de la venta (cliente frecuente, compensación)                                            | (−) Devoluciones y descuentos                               | Resta                 |
| **Otro ingreso no operacional** | Dinero que entra y **no** es venta de comida: venta de aceite usado, reciclaje, alquiler de un espacio, intereses | (+) Otros ingresos no operacionales                         | Suma                  |
| **Gasto, costo o impuesto**     | Todo pago que no salió de la caja del turno. Exige elegir la **categoría**                                        | Según la categoría (tabla de abajo)                         | Resta                 |

### Categorías de un gasto y su sección

| Categoría                        | Sección del informe            | Ejemplos                                                  |
| -------------------------------- | ------------------------------ | --------------------------------------------------------- |
| Insumos pagados por caja         | **Costo de ventas**            | Carne o verdura comprada en la plaza sin pasar por Bodega |
| Nómina y personal                | Gastos operacionales           | Quincenas, seguridad social, liquidaciones                |
| Arriendos                        | Gastos operacionales           | Arriendo del local, administración                        |
| Servicios públicos               | Gastos operacionales           | Luz, agua, gas, internet                                  |
| Ventas y domicilios              | Gastos operacionales           | Domiciliarios, empaques, publicidad, comisiones de apps   |
| Mantenimiento y reparaciones     | Gastos operacionales           | Técnico de la nevera, fumigación                          |
| Transporte                       | Gastos operacionales           | Fletes, taxis, gasolina                                   |
| Administrativos                  | Gastos operacionales           | Contador, software, papelería, aseo                       |
| Otros gastos operacionales       | Gastos operacionales           | Lo que no encaje en las anteriores                        |
| Gastos financieros y bancarios   | Otros egresos (no operacional) | Comisiones del banco, datáfono, 4x1000, intereses         |
| Otros egresos extraordinarios    | Otros egresos (no operacional) | Multas, robos, pérdidas, donaciones                       |
| Impuestos y provisiones fiscales | **Impuestos**                  | ICA, IVA, impoconsumo, predial, retenciones               |

La separación importa porque cada sección alimenta un margen distinto:

- un gasto mal clasificado como **costo** baja el margen **bruto**;
- uno **operacional** baja el margen **operacional**;
- un **impuesto** solo baja el margen **neto**.

---

## Cómo se registra

1. **Estado de Resultados → Registrar movimiento.**
2. Elige el **tipo** y, si es un gasto, la **categoría**.
3. Escribe el **concepto** (p. ej. "Arriendo local noviembre") y el **valor**. Acepta formato colombiano: `1.500.000` o `1500000,50`.
4. Elige la **fecha**: el día de negocio al que pertenece. No se aceptan fechas futuras.
5. Guardar. El informe se recalcula al instante.

Reglas que valida el servidor:

- El valor debe ser mayor que cero y razonable (tope de $100.000 millones por registro, contra ceros de más).
- Solo el **Jefe** (administrador) puede registrar, anular o reclasificar.
- El restaurante necesita el módulo **Estado de Resultados** activo.
- Cada movimiento guarda **quién** lo registró.

---

## Corregir un error: anular, no borrar

Si te equivocaste, abre el desglose de la línea y pulsa **Anular**. El movimiento:

- deja de contar en el informe de inmediato;
- **no se borra**: queda guardado con quién lo anuló y cuándo (trazabilidad, como en contabilidad);
- no se puede "des-anular": si lo necesitas otra vez, regístralo de nuevo.

Anular dos veces seguidas (doble clic) no hace daño: la segunda vez no cambia nada.

## ¿Y los gastos que el cajero anotó en el turno?

No hace falta registrarlos otra vez. Ya están en el informe, clasificados solos por el concepto ("hielo" → Insumos, "luz" → Servicios). Si la app los clasificó mal, en el desglose puedes **cambiar su categoría** sin tocar el cierre del turno.

> ⚠️ **No registres dos veces lo mismo.** Si el arriendo se pagó con plata de la caja y el cajero lo anotó como gasto del turno, ya está contado. Usa "Registrar movimiento" solo para lo que **no** pasó por la caja.

---

## Rutina recomendada (fin de mes, 10 minutos)

1. Abre el Estado de Resultados del mes.
2. Registra lo que se pagó **fuera de la caja**: nómina, arriendo, servicios pagados por banco, contador, comisiones bancarias e impuestos del periodo.
3. Registra los **otros ingresos** (venta de aceite, reciclaje).
4. Revisa el desglose de **Gastos operacionales** por si algún gasto de caja quedó en "Otros".
5. Descarga el **PDF**: ahora sí muestra el resultado real del mes.

Relacionado:

- [Página 15](15-estado-de-resultados-ejemplo.md): un mes completo con números.
- [Página 16](16-ejemplo-de-un-dia-completo.md): un día de punta a punta.
- [Página 6](06-funciones-del-producto.md#estado-de-resultados-add-on--finanzasestado-resultados): la cascada.
