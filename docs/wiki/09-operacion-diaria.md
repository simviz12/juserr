# 9. Operación diaria

## Comandos

| Comando                                                 | Para qué                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                              | Servidor local en `http://localhost:5173`                                                                  |
| `pnpm db:migrate:estado`                                | Ver qué migraciones están aplicadas y cuáles pendientes                                                    |
| `pnpm db:migrate`                                       | Aplicar las pendientes (cada una en una transacción)                                                       |
| `pnpm plataforma:admin <correo> "<Nombre>"`             | Crear un operador de la consola, o cambiarle la contraseña (la pide por la terminal y cierra sus sesiones) |
| `pnpm db:seed -- --tenant <código> --confirmar`         | **Borra** un restaurante y lo deja con el catálogo inicial (solo para pruebas/capacitación)                |
| `pnpm db:reset-counts -- --tenant <código> --confirmar` | Deja historial y stock en cero conservando catálogo y usuarios (p. ej. tras capacitar con datos de prueba) |
| `node scripts/demo-data.mjs --tenant <código>`          | ~70 días de operación de demostración (para mostrar a prospectos); `--remove` la quita                     |

> Los scripts que borran **exigen** `--tenant` y `--confirmar`. Nunca operan sobre todos los restaurantes.

## Rutina del dueño de la plataforma

### Cada día

- Abre `/plataforma`: revisa **"Vencen en ≤ 5 días"** y **"Vencidos"** → escribe a esos clientes.
- Atiende las **solicitudes de módulos** que aparecen arriba.
- Registra los pagos recibidos (Nequi/transferencia) en la ficha de cada restaurante.

### Cada semana

- Revisa las alarmas de AWS (errores 5xx, CPU) y que `/health` esté en verde.
- Verifica que el respaldo semanal se haya generado (ver abajo).

### Cada mes

- Revisa el **MRR** y los restaurantes en gracia o en solo lectura.
- Ajusta precios de lista si hace falta (los clientes actuales conservan su precio pactado).
- Actualiza dependencias en una rama, corre las pruebas y despliega.

## Alta de un cliente nuevo (5 minutos)

1. `/plataforma` → **Nuevo restaurante**: nombre, código (se sugiere solo), contacto, usuario Jefe, contraseña inicial, módulos, 15 días de prueba y límite de usuarios.
2. Envíale al cliente: la URL de la app, **su código**, el usuario y la contraseña inicial. Pídele que la cambie en _Personal_.
3. Primera sesión con él (capacitación):
   - **Líneas y combos**: nombre del negocio, líneas que vende, platos con precio y costo.
   - **Productos**: insumos con su stock mínimo.
   - **Bodega**: primera compra de cada insumo (esto deja el stock inicial).
   - **Personal**: crear cajeros.
   - Un **cierre de turno** de prueba juntos. Si quedaron datos de práctica, bórralos con `db:reset-counts`.

## Cobro mensual

1. El cliente paga por el medio que configuraste en `PAGO_INSTRUCCIONES` y te envía el comprobante (botón de WhatsApp en su `/facturacion`).
2. Consola → su ficha → **Registrar pago**: módulos (por defecto todos), meses, método y referencia del comprobante. Si recibiste un monto distinto (descuento), escríbelo en "Monto recibido".
3. "Pagado hasta" avanza; si estaba en solo lectura, vuelve a funcionar en ≤30 segundos.
4. Emite tu **factura electrónica** al cliente por la suscripción (ver [página 11](11-checklist-salida-y-venta.md)).

## Respaldos

| Capa                                   | Cómo                                                                     | Para qué                                      |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| **Neon PITR** (point-in-time recovery) | Incluido según el plan de Neon; restaura la base a un minuto exacto      | Errores recientes ("borré algo hace 2 horas") |
| **Branch antes de cada migración**     | En Neon → Branches → Create branch                                       | Volver atrás si una migración sale mal        |
| **Copia lógica semanal a S3**          | `pg_dump` programado (ver [guía de AWS](10-despliegue-aws.md#respaldos)) | Desastre, cambio de proveedor, auditoría      |

**Prueba una restauración al menos una vez por trimestre.** Un respaldo que nunca se restauró no es un respaldo.

## Incidentes: qué hacer si…

| Síntoma                              | Primer paso                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| "No puedo entrar" (un cliente)       | ¿Escribe bien el código? ¿El restaurante está **cancelado**? ¿Está bloqueado por 5 intentos fallidos? (espera 15 minutos) |
| "No me deja guardar el cierre"       | ¿Está en **solo lectura**? (consola → ficha → estado). Si es así, registra el pago                                        |
| "No veo el Estado de Resultados"     | ¿Tiene el módulo activo y vigente?                                                                                        |
| Toda la app responde 502/503         | Revisa `/health`. Si dice `db: error` → estado de Neon. Si no responde → logs de CloudWatch y estado de las tareas de ECS |
| Pago registrado pero sigue bloqueado | Espera 30 segundos (caché por instancia) o pide al cliente que recargue                                                   |
| Se aplicó una migración mal          | Restaura el branch de respaldo en Neon y despliega la versión anterior de la imagen                                       |
