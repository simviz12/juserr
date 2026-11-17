# 9. Operación diaria

## Comandos

| Comando                                                                     | Para qué                                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                                  | Servidor local en `http://localhost:5173`                                                                                                                     |
| `pnpm db:migrate:estado`                                                    | Ver qué migraciones están aplicadas y cuáles pendientes                                                                                                       |
| `pnpm db:respaldo`                                                          | Copia todas las tablas a `../respaldos/respaldo-AAAAMMDD-HHMM.json` (solo lectura sobre la base). Úsalo antes de migrar                                       |
| `pnpm db:migrate`                                                           | Aplicar las pendientes (cada una en una transacción)                                                                                                          |
| `pnpm plataforma:admin <correo> "<Nombre>" [--totp]`                        | Crear un operador de la consola, o cambiarle la contraseña (la pide por la terminal y cierra sus sesiones). Con `--totp` activa el segundo factor             |
| `pnpm plataforma:totp --listar`                                             | Ver qué operadores tienen segundo factor                                                                                                                      |
| `pnpm plataforma:totp --activar [correo]`                                   | Activar el segundo factor sin tocar la contraseña (sin correo: a todos los que no lo tengan)                                                                  |
| `pnpm plataforma:totp --probar <correo> <código>`                           | Comprobar que la app autenticadora genera el código correcto antes de exigirlo                                                                                |
| `pnpm plataforma:totp --quitar <correo>`                                    | Retirar el segundo factor (operador que perdió el teléfono)                                                                                                   |
| `pnpm db:seed -- --tenant <código> --confirmar`                             | **Borra** un restaurante y lo deja con el catálogo inicial (solo para pruebas/capacitación)                                                                   |
| `pnpm db:reset-counts -- --tenant <código> --confirmar`                     | Deja historial y stock en cero conservando catálogo y usuarios (p. ej. tras capacitar con datos de prueba)                                                    |
| `node scripts/restablecer-clave.mjs --tenant <código> --usuario "<nombre>"` | Pone una contraseña aleatoria nueva a un usuario de un restaurante (olvidó la suya), la imprime una vez y cierra sus sesiones                                 |
| `pnpm prueba:restaurante`                                                   | Crea (o reinicia) el restaurante `prueba-interna` con un usuario Jefe, Bodeguero y Cajero y contraseñas aleatorias impresas una vez; `-- --borrar` lo cancela |
| `node scripts/demo-data.mjs --tenant <código>`                              | ~70 días de operación de demostración (para mostrar a prospectos); `--remove` la quita                                                                        |

> Los scripts que borran **exigen** `--tenant` y `--confirmar`. Nunca operan sobre todos los restaurantes. Con `NODE_ENV=production` también exigen `--permitir-produccion`. Los usuarios que crean reciben una **contraseña aleatoria** que se imprime al final.

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
3. "Pagado hasta" avanza; si estaba en solo lectura, vuelve a funcionar en ≤10 segundos. Si dos pagos del mismo restaurante se registran a la vez, el segundo se rechaza con "recarga la página": revisa antes de volver a registrarlo.
4. Emite tu **factura electrónica** al cliente por la suscripción (ver [página 11](11-checklist-salida-y-venta.md)).

## Respaldos

| Capa                                   | Cómo                                                                     | Para qué                                      |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| **Neon PITR** (point-in-time recovery) | Incluido según el plan de Neon; restaura la base a un minuto exacto      | Errores recientes ("borré algo hace 2 horas") |
| **Branch antes de cada migración**     | En Neon → Branches → Create branch                                       | Volver atrás si una migración sale mal        |
| **Respaldo lógico inmediato**          | `pnpm db:respaldo` → JSON en `../respaldos/` (fuera del repo)            | Revisar o recuperar tablas puntuales          |
| **Copia lógica semanal a S3**          | `pg_dump` programado (ver [página 10](10-despliegue-aws.md#7-respaldos)) | Desastre, cambio de proveedor, auditoría      |

**Prueba una restauración al menos una vez por trimestre.** Un respaldo que nunca se restauró no es un respaldo.

## Incidentes: qué hacer si…

| Síntoma                                           | Primer paso                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "No puedo entrar" (un cliente)                    | ¿Escribe bien el código? ¿El restaurante está **cancelado**? ¿Está bloqueado por intentos fallidos? (espera 15 minutos o borra sus filas de `intentos_login`) |
| Un cliente reporta "Código de soporte: …"         | Busca ese código (`errorId`) en los logs: la línea JSON trae ruta, restaurante, usuario y el error completo                                                   |
| "Este turno ya estaba registrado"                 | Fue un doble envío: el turno se guardó una sola vez. No hay que hacer nada                                                                                    |
| "El comprobante … ya fue registrado"              | El comprobante Nequi ya se usó en otro turno. Revisa el pantallazo del cliente                                                                                |
| "No hay conexión con la base de datos" al guardar | Neon no respondió (timeout de 10 s). No se guardó nada; reintentar. Si se repite, revisa `/health` y el estado de Neon                                        |
| Perdí el teléfono del segundo factor              | Desde tu computador: `pnpm plataforma:totp --quitar <correo>` y luego `--activar <correo>` con el teléfono nuevo                                              |
| "No me deja guardar el cierre"                    | ¿Está en **solo lectura**? (consola → ficha → estado). Si es así, registra el pago                                                                            |
| "No veo el Estado de Resultados"                  | ¿Tiene el módulo activo y vigente?                                                                                                                            |
| Toda la app responde 502/503                      | Revisa `/health`. Si dice `db: error` → estado de Neon. Si no responde → logs de CloudWatch y estado de las tareas de ECS                                     |
| Pago registrado pero sigue bloqueado              | Espera 10 segundos (caché por instancia) o pide al cliente que recargue                                                                                       |
| Se aplicó una migración mal                       | Restaura el branch de respaldo en Neon y despliega la versión anterior de la imagen                                                                           |
| `db:migrate` dice "cambió después de aplicarse"   | Alguien editó una migración ya aplicada. Restaura el archivo original desde git y crea una migración nueva                                                    |
