# 13. Glosario

| Término                       | Significado                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| **Tenant / restaurante**      | Un cliente de la plataforma. Todos sus datos llevan su `tenant_id`                             |
| **Código del restaurante**    | Identificador con el que sus usuarios inician sesión (`pizzeria-don-juan`)                     |
| **Plan Core**                 | El módulo base obligatorio                                                                     |
| **Add-on / módulo adicional** | Funcionalidad que se cobra aparte y se activa por restaurante                                  |
| **Módulo a medida**           | Add-on con `publico = false`: solo lo ven los restaurantes a los que se lo activas             |
| **Entitlements / derechos**   | Lo que un restaurante puede usar hoy según lo que tiene pagado                                 |
| **Vigente hasta**             | Último día (inclusive) cubierto por pagos de un módulo                                         |
| **Gracia**                    | Días después del vencimiento en los que todo sigue funcionando con aviso                       |
| **Solo lectura**              | Core vencido sin gracia: se puede consultar y exportar, no registrar                           |
| **Suspendido / cancelado**    | Decisión manual de la plataforma: solo facturación / sin acceso                                |
| **Precio pactado**            | Precio mensual de un módulo para un cliente específico (puede diferir del de lista)            |
| **Prorrateo**                 | Cobro proporcional al activar un módulo a mitad de ciclo, para alinearlo con el Core           |
| **MRR**                       | _Monthly Recurring Revenue_: ingreso mensual recurrente de los restaurantes activos            |
| **Consola / plataforma**      | `/plataforma`: donde el dueño de MesaCapital administra clientes y cobros                      |
| **Día de negocio / jornada**  | De 04:00 a 04:00 hora Colombia                                                                 |
| **Cierre de turno**           | Arqueo de dinero e inventario al final de un turno                                             |
| **Masa / rueda / porción**    | 1 masa = 1 rueda (pizza entera) = 8 porciones                                                  |
| **Merma**                     | Producto perdido (quemado, dañado); no se cobra pero se registra                               |
| **Insumo de control**         | Lo que se cuenta al cierre para deducir las ventas de una línea (pan, chuzo armado…)           |
| **Línea gastronómica**        | Familia de productos: pizza, chuzo, hamburguesa, lasaña, carne                                 |
| **Food cost**                 | Compras de insumos / ventas. Saludable ≤ 30 %                                                  |
| **Costo promedio ponderado**  | Costo unitario recalculado en cada compra según el stock existente                             |
| **Base caja**                 | Ingresos y gastos se cuentan cuando entra o sale el dinero (no cuando se devengan)             |
| **Cascada / P&L**             | Estado de Resultados: de ingresos a utilidad neta, paso a paso                                 |
| **Centavos enteros**          | Representación del dinero como entero (×100) para evitar errores de coma flotante              |
| **`delTenant`**               | Función que agrega "y que sea de este restaurante" a una consulta                              |
| **Lote atómico (`db.batch`)** | Varias escrituras que se guardan todas o ninguna                                               |
| **Migración**                 | Archivo SQL versionado que cambia la estructura de la base                                     |
| **Branch de Neon**            | Copia instantánea de la base, para pruebas o respaldo                                          |
| **PITR**                      | _Point-in-time recovery_: restaurar la base a un instante exacto                               |
| **Health check**              | `/health`: el balanceador lo usa para saber si una instancia está sana                         |
| **ALB / ECS / Fargate / ECR** | Balanceador, orquestador de contenedores, cómputo sin servidores y registro de imágenes de AWS |
| **WAF**                       | Firewall de aplicaciones web de AWS                                                            |
| **OIDC**                      | Mecanismo para que GitHub despliegue en AWS sin guardar llaves                                 |
| **CI**                        | Integración continua: las verificaciones automáticas en cada cambio                            |
