# 11. Checklist de salida a producción y venta

Marca cada punto antes de cobrarle al primer cliente. Las secciones legales y tributarias son **orientativas**: confírmalas con tu contador y tu abogado en Colombia.

## A. Técnico (obligatorio)

- [ ] CI en verde en `main` (lint, tipos, pruebas, build).
- [ ] Infraestructura de AWS montada ([página 10](10-despliegue-aws.md)), con HTTPS y un dominio propio.
- [ ] Variables configuradas: `DATABASE_URL`, **`ORIGIN`**, **`ADDRESS_HEADER=X-Forwarded-For`**, `XFF_DEPTH`, `KEEP_ALIVE_TIMEOUT=65`, `HEADERS_TIMEOUT=66`, `PAGO_INSTRUCCIONES` y `SOPORTE_WHATSAPP`.
- [ ] Migración aplicada (`pnpm db:migrate:estado` sin pendientes) **después** de tomar el branch de respaldo.
- [ ] Operador de la consola creado con una contraseña fuerte (12+ caracteres) guardada en un gestor de contraseñas.
- [ ] `/health` en verde y monitoreado (Route 53 Health Check o un servicio de disponibilidad).
- [ ] Alarmas de 5xx, de instancia no saludable y de CPU con aviso a tu correo.
- [ ] Respaldo semanal a S3 funcionando y **una restauración probada**.
- [ ] Presupuesto de AWS con alerta.
- [ ] (Ruta B) WAF con límite de login y `/plataforma` restringida a tus IPs.

## B. Prueba funcional (20 minutos, en producción, justo después de salir)

**Tu restaurante (fundador)**

- [ ] Entra con su código; el dashboard muestra las cifras de siempre.
- [ ] Haz un cierre de turno de prueba (luego anúlalo o úsalo como turno real).
- [ ] Una compra en bodega sube el stock.
- [ ] `/facturacion` muestra el Core y los add-ons "Al día".

**Consola**

- [ ] `/plataforma`: el MRR es correcto.
- [ ] Crea un restaurante de prueba `prueba-interna` solo con Core.

**Restaurante de prueba**

- [ ] No ve ningún dato de otros restaurantes.
- [ ] Los add-ons aparecen con 🔒 y la URL directa lo manda a `/modulos`.
- [ ] Solicita un módulo → aparece en la consola → actívalo con prorrateo → se abre en ≤30 s.
- [ ] Registra un pago → "pagado hasta" avanza un mes.
- [ ] Suspéndelo → solo ve Facturación. Cancélalo al terminar.

**Seguridad**

- [ ] 5 contraseñas malas → bloqueo de 15 minutos **solo para esa IP/usuario**. Desde otra red, otro usuario sigue entrando: eso confirma que `ADDRESS_HEADER` está bien configurado.
- [ ] `http://` redirige a `https://`.

## C. Comercial

- [ ] **Precios** definidos en `/plataforma/catalogo` (Core + add-ons). Decide tu política de descuentos (p. ej. 2 meses gratis pagando el año).
- [ ] **Días de prueba** estándar (15) y días de gracia (5).
- [ ] **Instrucciones de pago** reales en `PAGO_INSTRUCCIONES` (Nequi/cuenta a nombre de tu empresa).
- [ ] **WhatsApp de soporte** con horario de atención publicado.
- [ ] **Material de venta**: demo con `node scripts/demo-data.mjs --tenant demo-ventas` sobre un restaurante de demostración (nunca sobre uno real).
- [ ] **Guion de capacitación** del primer día ([página 9](09-operacion-diaria.md#alta-de-un-cliente-nuevo-5-minutos)).
- [ ] Define qué es un **desarrollo a medida** y cómo se cobra (montaje + mensualidad del módulo).

## D. Legal y tributario (verifícalo con profesionales)

- [ ] **Empresa y RUT**: vende como persona jurídica o natural con las responsabilidades tributarias correctas.
- [ ] **Facturación electrónica de tu suscripción**: tú le vendes un servicio a cada restaurante, así que normalmente debes **emitirle factura electrónica** cada mes. Usa un proveedor tecnológico habilitado por la DIAN.
- [ ] **Términos y condiciones del servicio**: alcance, disponibilidad, soporte, pagos, mora, suspensión, terminación, **devolución de datos al terminar** (exportaciones) y limitación de responsabilidad.
- [ ] **Datos personales (Ley 1581 de 2012)**: política de tratamiento de datos publicada; en el contrato, **el restaurante es el responsable** de los datos de sus empleados y **tú el encargado**. Revisa si te aplica el Registro Nacional de Bases de Datos (RNBD).
- [ ] **Aclaraciones del producto** en el contrato:
  - no es un POS de facturación electrónica al consumidor final;
  - el Estado de Resultados es gerencial (base caja), no NIIF.
- [ ] **Acuerdo de nivel de servicio** (por ejemplo, 99 % de disponibilidad mensual y respuesta de soporte en 24 h hábiles).

## E. Roadmap recomendado (en orden de impacto)

| #   | Mejora                                                       | Por qué                                                                                                                      |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pasarela de pago automática (Wompi/Mercado Pago) con webhook | Cobrar sin intervención manual ([página 5](05-planes-modulos-y-facturacion.md#conectar-una-pasarela-de-pago-siguiente-paso)) |
| 2   | "Olvidé mi contraseña" (correo o WhatsApp) para el Jefe      | Hoy la recuperación la haces tú                                                                                              |
| 3   | Errores con contexto (Sentry)                                | Enterarte antes que el cliente                                                                                               |
| 4   | Registro de clientes autoservicio (prueba gratis sin ti)     | Escalar las ventas                                                                                                           |
| 5   | Multi-sede (un dueño, varios locales consolidados)           | Ya está en la oferta del plan "Franquicia" de la versión anterior                                                            |
| 6   | Redis para las cachés (sesiones, plan, freno de login)       | Cuando pases de ~6 instancias                                                                                                |
| 7   | Exportación completa de los datos del cliente (ZIP)          | Requisito contractual al terminar el servicio                                                                                |
