# 10. Despliegue

> **Dónde está producción hoy (nov. 2026):** la app corre en **Vercel** y la base en **Neon**. Cada `git push` a `main` despliega solo. Esta página explica:
>
> - **[Parte 1](#parte-1--producción-actual-vercel--neon)**: cómo funciona hoy en Vercel.
> - **[Parte 2](#parte-2--procedimiento-de-cada-despliegue-runbook)**: el procedimiento paso a paso para cualquier despliegue, con verificación y reversa.
> - **[Parte 3](#parte-3--aws-cuando-quieras-crecer)**: la guía para pasar a AWS cuando el negocio lo pida.

---

# Parte 1 — Producción actual: Vercel + Neon

```
  GitHub (simviz12/juserr)
     │  push a main
     ▼
  Vercel ──► build (pnpm build con adapter-vercel, Node 22) ──► funciones serverless
     │                                                         │ HTTPS (driver de Neon)
     ▼                                                         ▼
  https://<tu-app>                                       Neon Postgres (us-east-1)
```

- **El adaptador se elige solo**: en Vercel (variable `VERCEL`) se usa `adapter-vercel` con runtime `nodejs22.x`; en Docker/AWS, `adapter-node` (`vite.config.ts`).
- **Vercel despliega aunque el CI falle.** El CI de GitHub y el build de Vercel corren en paralelo. Para que solo llegue a producción lo que pasó las pruebas:
  1. GitHub → Settings → Branches → regla para `main`: **"Require status checks to pass"** con el check `verificar` del CI.
  2. Trabaja en ramas y une a `main` con un pull request (Vercel crea un **preview** de cada rama para probar antes).
- **Las migraciones NO corren solas.** Se aplican desde tu computador con `pnpm db:migrate` (Parte 2). Así ningún despliegue toca la base sin que lo decidas.

### Variables en Vercel

Vercel → proyecto → **Settings → Environment Variables** (entorno **Production**; para los previews usa un branch de Neon, nunca la base real):

| Variable                | Obligatoria | Valor                                                                              |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Sí          | Cadena de Neon de producción (`sslmode=require`)                                   |
| `PAGO_INSTRUCCIONES`    | Sí          | Datos de pago que ve cada restaurante en `/facturacion` (pasos separados por `\|`) |
| `SOPORTE_WHATSAPP`      | Sí          | Solo números con indicativo, p. ej. `573001234567`                                 |
| `PLATFORM_REQUIRE_TOTP` | Recomendada | `1` cuando todos los operadores tengan el segundo factor probado                   |
| `DB_TIMEOUT_MS`         | No          | `10000` por defecto                                                                |
| `LOG_LEVEL`             | No          | `info` por defecto                                                                 |

En Vercel **no** hacen falta `ORIGIN`, `ADDRESS_HEADER`, `XFF_DEPTH` ni los timeouts de keep-alive: la plataforma ya entrega la URL y la IP real del cliente. Esas son de `adapter-node` (Docker/AWS).

> Cambiar una variable **no** afecta al despliegue que ya está corriendo: después de cambiarla, ve a **Deployments → ⋯ → Redeploy** del último despliegue de producción.

### Ver logs y errores

- Vercel → **Logs** (o **Deployments → el despliegue → Functions**). Cada evento del servidor es **una línea JSON** (`nivel`, `msg`, `tenantId`, `err`…).
- Si un usuario reporta un **"Código de soporte: …"**, búscalo en Logs: aparece como `errorId` con la ruta, el restaurante, el usuario y el error completo.
- `https://<tu-app>/health` → `{"ok":true,"db":"ok","version":"…"}`. `version` cambia en cada build: sirve para confirmar qué versión está corriendo.

### Volver a la versión anterior (código)

Vercel → **Deployments** → el despliegue anterior que funcionaba → **⋯ → Promote to Production** (Instant Rollback). Tarda segundos y no toca la base. Ojo: si el despliegue que quieres revertir venía con una migración, el código viejo puede no ser compatible con la base nueva; mira la tabla de reversa de la Parte 2.

---

# Parte 2 — Procedimiento de cada despliegue (runbook)

Sirve igual para Vercel y para AWS. Sigue los pasos en orden; cada uno tiene cómo verificarlo.

## Paso 0 — ¿Este despliegue trae migración?

```bash
git diff --name-only origin/main...HEAD -- migrations/
pnpm db:migrate:estado      # contra producción: muestra las pendientes
```

| Tipo de cambio                                                                        | Ejemplos                                                  | Cómo desplegar                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **Sin migración**                                                                     | Pantallas, textos, lógica                                 | Merge a `main` y listo (pasos 4–6)                          |
| **Migración compatible** (solo agrega: tablas, columnas _nullable_, índices)          | Nueva tabla de un módulo                                  | Migra **antes** y despliega cuando quieras                  |
| **Migración incompatible** (cambia tipos, renombra o borra, el código nuevo la exige) | `0003` (`real` → `numeric`, tablas que el login necesita) | Migra y despliega **en la misma ventana**, fuera de horario |

**Regla para escribir migraciones nuevas:** prefiere siempre la forma compatible (_expandir → desplegar → contraer_): primero agrega lo nuevo sin quitar lo viejo, despliega el código que usa lo nuevo y, en una migración posterior, borra lo viejo. Así nunca hay una ventana en la que el código y la base no se entienden.

## Paso 1 — Antes de empezar

- [ ] CI en verde en la rama (lint, tipos, 170+ pruebas, build).
- [ ] `tests/migration.test.ts` pasa (garantiza que la migración deja la base idéntica a `schema.ts`).
- [ ] Si es incompatible: aviso a los restaurantes y hora sin turnos abiertos (de madrugada o antes de abrir).

## Paso 2 — Respaldo (siempre que haya migración)

1. **Neon → Branches → Create branch** `respaldo-AAAAMMDD` desde `main` (copia instantánea, 10 segundos). Es tu punto de retorno principal.
2. **Respaldo lógico** local, para inspeccionar o restaurar tablas puntuales:
   ```bash
   pnpm db:respaldo          # → ../respaldos/respaldo-AAAAMMDD-HHMM.json (fuera del repo)
   ```
   Contiene datos de clientes y hashes de contraseñas: no lo subas a git ni lo compartas.

## Paso 3 — Migrar

```bash
pnpm db:migrate:estado
pnpm db:migrate
```

- Cada archivo corre en una transacción: si falla, **se revierte completo** y el runner se detiene.
- El runner toma un candado: dos migraciones simultáneas no se pisan.
- Lee la salida: un `WARNING` (p. ej. "se omite el índice único por duplicados") significa que la migración terminó pero dejó algo para revisar a mano.

> Sin `pnpm` instalado: `npx -y pnpm@12.18.0 db:migrate` o `node scripts/migrate.mjs`.

## Paso 4 — Desplegar

- **Vercel:** merge del PR a `main` (o `git push origin main`). En 1–3 minutos el despliegue queda "Ready".
- **AWS:** ver [6.14](#614-despliegue-automático-github-actions--oidc-sin-llaves-guardadas) (automático) o [5.2–5.3](#52-subir-la-imagen) (Lightsail).

## Paso 5 — Verificar (5 minutos)

```bash
APP=https://<tu-app>

curl -s $APP/health                                   # {"ok":true,"db":"ok","version":"…"}
curl -sI $APP/login | grep -iE "content-security|strict-transport|x-frame"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$APP/pl%61taforma"   # 303 → /plataforma/login
```

- [ ] `/health` en verde y con la `version` nueva.
- [ ] Entras a un restaurante real: el dashboard muestra las cifras de siempre.
- [ ] Un cierre de turno de prueba (o en el restaurante `prueba-interna`, ver [página 9](09-operacion-diaria.md)).
- [ ] Una compra en Bodega sube el stock.
- [ ] Entras a `/plataforma` con correo, contraseña y código del segundo factor.
- [ ] En los logs no aparecen líneas `"nivel":"error"` nuevas.

## Paso 6 — Si algo sale mal

| Qué pasó                                                       | Qué hacer                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El build de Vercel falló                                       | Nada cambió en producción (sigue el despliegue anterior). Revisa el log del build, corrige y vuelve a hacer push                                                                                                            |
| Despliegue sin migración con errores                           | **Promote to Production** del despliegue anterior (Parte 1)                                                                                                                                                                 |
| Migración **compatible** + código con errores                  | Rollback solo del código; la base se queda (el código viejo convive con las tablas nuevas)                                                                                                                                  |
| Migración **incompatible** + código con errores                | Primero intenta **arreglar hacia adelante** (un commit rápido). Si no se puede: Neon → restaura `main` desde el branch `respaldo-AAAAMMDD` **y** Promote del despliegue anterior. Se pierde lo escrito después del respaldo |
| La migración falló a la mitad                                  | No hay que hacer nada en la base: se revirtió sola. Lee el error, corrige con una migración **nueva** y repite                                                                                                              |
| `db:migrate` dice "cambió después de aplicarse"                | Alguien editó una migración ya aplicada: restaura ese archivo desde git y crea una migración nueva                                                                                                                          |
| `/health` dice `db: error`                                     | Estado de Neon (status.neon.tech) y `DATABASE_URL` en Vercel                                                                                                                                                                |
| Todos ven "No hay conexión con la base de datos"               | Neon no responde en `DB_TIMEOUT_MS`; revisa si la rama de Neon está suspendida (_scale to zero_) o caída                                                                                                                    |
| La consola no deja entrar tras poner `PLATFORM_REQUIRE_TOTP=1` | El operador no tiene TOTP: `pnpm plataforma:totp --activar <correo>`, o quita la variable y vuelve a desplegar                                                                                                              |

## Registro de despliegues a producción

| Fecha      | Commit    | Migraciones    | Notas                                                                                                                                            |
| ---------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16-11-2026 | `882e5cd` | `0000`, `0003` | Auditoría (Entrega 4). Respaldo previo en `respaldos/`; sin duplicados; migración y push en la misma ventana. Creado el primer operador con TOTP |

> Agrega una fila por cada despliegue con migración: es tu bitácora para saber qué cambió y cuándo.

---

# Parte 3 — AWS (cuando quieras crecer)

Hay **dos rutas**:

|                                                          | **Ruta A — Rápida (Lightsail Containers)**     | **Ruta B — Profesional (ECS Fargate + ALB)**               |
| -------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Para                                                     | Primeros 1–30 restaurantes, validar el negocio | Crecer con alta disponibilidad, seguridad y automatización |
| Tiempo de montaje                                        | 1–2 horas                                      | 1 día                                                      |
| Costo aprox.*                                            | US$10–40/mes + Neon                            | US$70–110/mes + Neon                                       |
| Alta disponibilidad                                      | 1–2 nodos detrás del balanceador de Lightsail  | 2+ tareas en 2 zonas de disponibilidad                     |
| Firewall (WAF), secretos cifrados, despliegue automático | Limitado                                       | Sí                                                         |

\* Estimados de referencia; confírmalos en la [calculadora de precios de AWS](https://calculator.aws/) antes de decidir.

**¿Cuándo dejar Vercel?** Cuando necesites WAF propio (restringir `/plataforma` por IP), los datos y la app en tu cuenta de AWS por contrato, o costos predecibles con mucho tráfico. Mientras tanto, Vercel + Neon es suficiente. La aplicación es la misma imagen Docker en ambas rutas de AWS.

## 0. Decisiones de arquitectura

```
                         Route 53 (app.tudominio.com)
                                    │
                         ┌──────────▼──────────┐
                         │ AWS WAF (Ruta B)    │  reglas administradas + límite de login + IP permitida a /plataforma
                         └──────────┬──────────┘
                         ┌──────────▼──────────┐
                         │ Balanceador (HTTPS) │  certificado ACM · /health
                         └─────┬──────────┬────┘
                    ┌──────────▼──┐   ┌───▼─────────┐
                    │ App (Docker)│   │ App (Docker)│   Node 22 · SvelteKit · sin root
                    │  zona A     │   │  zona B     │
                    └──────┬──────┘   └──────┬──────┘
                           └──────┬──────────┘
                                  │ HTTPS (driver serverless de Neon)
                         ┌────────▼─────────┐
                         │ Neon Postgres    │  región AWS us-east-1 · PITR · branches
                         └──────────────────┘
                 CloudWatch (logs + alarmas) · S3 (respaldos semanales) · Secrets Manager
```

### ¿Por qué mantener Neon y no usar RDS?

La aplicación usa el **driver HTTP de Neon** (`drizzle-orm/neon-http`) y su `db.batch()` para las escrituras atómicas. Neon corre **sobre AWS**: elige la región **AWS us-east-1** en Neon y tu app en **us-east-1**, y la latencia entre ambas es mínima. Además te da PITR y branches (copias instantáneas para probar migraciones) sin administrar nada.

Pasar a **RDS/Aurora** es posible más adelante; requiere cambiar `src/lib/server/db.ts` al driver `node-postgres` y reemplazar `db.batch([...])` por `db.transaction(...)` en unos 6 archivos (ver [sección 9](#9-a-futuro-pasar-la-base-a-rds-o-aurora)).

### Región

**us-east-1 (Norte de Virginia)** para app y base: es la región con más servicios, los mejores precios y buena latencia desde Colombia. São Paulo (`sa-east-1`) es más cara y no necesariamente más rápida desde Bogotá; mide antes de decidir.

---

## 1. Preparar la cuenta de AWS (ambas rutas)

1. **Crea la cuenta** y activa **MFA en el usuario root**. No uses el root para el día a día.
2. **IAM Identity Center** → crea tu usuario administrador con MFA y trabaja con él.
3. **Billing → Budgets**: crea un presupuesto mensual (p. ej. US$150) con alerta al 80 % por correo. Evita sorpresas.
4. Instala en tu computador la **AWS CLI v2** y configúrala con `aws configure sso`. Instala también **Docker Desktop**.
5. **Dominio**: cómpralo (p. ej. `mesacapital.co`) en Route 53 o en tu registrador. Si es externo, crea una _Hosted Zone_ en Route 53 y apunta los NS del registrador a ella. Usaremos `app.mesacapital.co` como ejemplo.

## 2. Preparar Neon para producción (ambas rutas)

1. Proyecto de producción en la región **AWS US East 1 (N. Virginia)**. Si tu proyecto actual está en otra región, créalo nuevo y migra los datos con `pg_dump`/`pg_restore`.
2. Plan **pago** (Launch o superior):
   - desactiva **"scale to zero"** en la rama de producción, para no tener arranques en frío;
   - configura la **retención de historial (PITR)** al máximo que permita tu plan.
3. Copia la cadena de conexión de la rama `main` con `sslmode=require`. Esa es tu `DATABASE_URL`.
4. Antes de cada migración: **Branches → Create branch** `respaldo-AAAAMMDD` (tu punto de retorno; ver [Paso 2](#paso-2--respaldo-siempre-que-haya-migración)).

## 3. Variables de entorno de producción (AWS / Docker)

Además de las de la [Parte 1](#variables-en-vercel), con `adapter-node` hacen falta las de la red:

| Variable                | Valor                                                                       | Por qué                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | cadena de Neon                                                              | Conexión a la base (**secreto**)                                                                                                                                         |
| `ORIGIN`                | `https://app.mesacapital.co`                                                | SvelteKit valida el origen de los formularios (protección CSRF). **Sin esto, los formularios fallan detrás del balanceador**                                             |
| `ADDRESS_HEADER`        | `X-Forwarded-For`                                                           | IP real del cliente. **Sin esto, el freno de login vería a todos con la IP del balanceador**: el límite por IP (50 intentos) se compartiría entre todos los restaurantes |
| `XFF_DEPTH`             | `1`                                                                         | El balanceador agrega 1 IP. Si pones CloudFront delante, usa `2`                                                                                                         |
| `KEEP_ALIVE_TIMEOUT`    | `65` (segundos)                                                             | Debe ser **mayor** que el tiempo de inactividad del balanceador (60 s). Si no, aparecen **errores 502 intermitentes**                                                    |
| `HEADERS_TIMEOUT`       | `66` (segundos)                                                             | Debe ser mayor que `KEEP_ALIVE_TIMEOUT`                                                                                                                                  |
| `PAGO_INSTRUCCIONES`    | `Nequi 300 … \| Bancolombia ahorros … \| Envía el comprobante por WhatsApp` | Lo que ve el cliente en `/facturacion`                                                                                                                                   |
| `SOPORTE_WHATSAPP`      | `573001234567`                                                              | Botón "Enviar comprobante por WhatsApp"                                                                                                                                  |
| `NODE_ENV`              | `production`                                                                | Ya viene en la imagen. Activa HSTS y bloquea los scripts destructivos sin `--permitir-produccion`                                                                        |
| `PLATFORM_REQUIRE_TOTP` | `1`                                                                         | La consola exige segundo factor a **todos** los operadores. Ponlo **después** de activar y probar el TOTP de cada uno (`pnpm plataforma:totp`)                           |
| `DB_TIMEOUT_MS`         | `10000` (opcional)                                                          | Tiempo máximo por consulta a Neon. Evita peticiones colgadas                                                                                                             |
| `LOG_LEVEL`             | `info` (opcional)                                                           | Nivel mínimo de los logs JSON (`debug`, `info`, `warn`, `error`)                                                                                                         |

## 4. Construir y probar la imagen en tu computador (ambas rutas)

```bash
# Desde la raíz del repo
docker build --platform linux/amd64 -t mesacapital:1.0.0 .

# Prueba local contra un BRANCH de Neon (nunca contra producción)
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://...branch-de-pruebas..." \
  -e ORIGIN="http://localhost:3000" \
  mesacapital:1.0.0

curl http://localhost:3000/health     # → {"ok":true,"db":"ok",...}
```

- La imagen corre **sin root**, solo con dependencias de producción, e incluye `migrations/` y `scripts/migrate.mjs` para migrar desde la misma imagen.
- **Versiona las imágenes** (`1.0.0`, `1.0.1`…), no uses solo `latest`: así puedes volver a la anterior en un minuto.
- Si prefieres procesadores **Graviton** (ARM, ~20 % más baratos en Fargate), construye con `--platform linux/arm64` y declara `ARM64` en la definición de la tarea.

---

## 5. Ruta A — Lightsail Containers (rápida)

### 5.1 Crear el servicio

Consola → **Lightsail** → **Containers** → _Create container service_

- Región: **Virginia (us-east-1)**.
- Capacidad: **Micro** (0,25 vCPU, 1 GB) para empezar; **Small** cuando pases de ~15 restaurantes.
- Escala: **2 nodos** si quieres tolerancia a fallas (o 1 para empezar).
- Nombre: `mesacapital`.

### 5.2 Subir la imagen

Instala el plugin `lightsailctl` (instrucciones en la documentación de Lightsail) y ejecuta:

```bash
aws lightsail push-container-image --region us-east-1 \
  --service-name mesacapital --label app --image mesacapital:1.0.0
# Devuelve un nombre tipo ":mesacapital.app.1" → úsalo en el despliegue
```

### 5.3 Crear el despliegue

_Deployments → Create deployment_:

- **Container**: nombre `app`, imagen `:mesacapital.app.1`.
- **Environment variables**: todas las de la [sección 3](#3-variables-de-entorno-de-producción).
- **Open ports**: `3000` HTTP.
- **Public endpoint**: contenedor `app`, puerto 3000, **health check path `/health`**.

### 5.4 Dominio y HTTPS

_Custom domains_ → crea un **certificado** para `app.mesacapital.co`, agrega en Route 53 los registros CNAME de validación que te indica y, ya validado, **asígnalo** al servicio. Luego crea en Route 53 el registro que apunte `app.mesacapital.co` al dominio público del servicio.

### 5.5 Migrar la base

Desde tu computador (con el `.env` apuntando a producción **solo en este paso**):

```bash
pnpm db:migrate:estado
pnpm db:migrate
pnpm plataforma:admin tu@correo.com "Tu Nombre" --totp
pnpm plataforma:totp --probar tu@correo.com <código de la app>
```

> El runner toma un candado en la base: si dos despliegues migran a la vez, el segundo espera. Si una migración cambia tipos o tablas que el código viejo usa (como `0003`), **migra y despliega en la misma ventana**: primero la migración, inmediatamente después el código nuevo.

### 5.6 Limitaciones de la Ruta A (para saber cuándo pasar a la B)

- Las variables de entorno quedan visibles en la consola de Lightsail (no hay Secrets Manager integrado): **limita quién tiene acceso a tu cuenta**.
- No hay WAF: la protección de login depende del freno de la app.
- Despliegues manuales (o con scripts de la CLI).

---

## 6. Ruta B — ECS Fargate + ALB (profesional)

> Puedes hacerlo por la consola web siguiendo estos pasos; los bloques de JSON y comandos sirven tanto de referencia como para automatizar.

### 6.1 Repositorio de imágenes (ECR)

```bash
aws ecr create-repository --repository-name mesacapital --image-scanning-configuration scanOnPush=true --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <CUENTA>.dkr.ecr.us-east-1.amazonaws.com
docker tag mesacapital:1.0.0 <CUENTA>.dkr.ecr.us-east-1.amazonaws.com/mesacapital:1.0.0
docker push <CUENTA>.dkr.ecr.us-east-1.amazonaws.com/mesacapital:1.0.0
```

Agrega una **lifecycle policy** al repositorio que conserve las últimas 20 imágenes.

### 6.2 Secretos (Secrets Manager)

Crea el secreto `mesacapital/prod` (tipo "Other", pares clave/valor):

- `DATABASE_URL` = cadena de Neon.

Las variables que no son secretas (`ORIGIN`, `ADDRESS_HEADER`, etc.) van en la definición de la tarea.

### 6.3 Red

Para empezar sirve la **VPC por defecto** (subredes públicas en varias zonas):

- **Security group del ALB** (`sg-alb`): entrada 80 y 443 desde `0.0.0.0/0`.
- **Security group de las tareas** (`sg-app`): entrada **3000 solo desde `sg-alb`**. Nada más.
- Las tareas usan **IP pública** para salir a Internet (Neon, ECR) sin pagar un NAT Gateway (~US$33/mes). El security group impide que alguien llegue directo a ellas.

### 6.4 Certificado (ACM)

**Certificate Manager** (us-east-1) → _Request_ → `app.mesacapital.co` → validación por DNS → _Create records in Route 53_.

### 6.5 Balanceador (ALB)

- _Application Load Balancer_, _internet-facing_, 2+ subredes públicas, `sg-alb`.
- **Target group**: tipo **IP**, protocolo HTTP, puerto **3000**, health check **`/health`**, código esperado `200`, intervalo 15 s, umbral sano 2 y no sano 3.
- **Listeners**:
  - `HTTP:80` → _Redirect_ a `HTTPS:443` (301).
  - `HTTPS:443` → certificado ACM → _Forward_ al target group. Política TLS recomendada: `ELBSecurityPolicy-TLS13-1-2-2021-06`.
- **Atributos**: idle timeout **60 s** (por eso `KEEP_ALIVE_TIMEOUT=65`).

### 6.6 Roles IAM

- **Rol de ejecución** (`mesacapital-task-execution`): política administrada `AmazonECSTaskExecutionRolePolicy` + permiso `secretsmanager:GetSecretValue` solo sobre el ARN de `mesacapital/prod`.
- **Rol de la tarea**: no necesita permisos por ahora (la app no usa servicios de AWS).

### 6.7 Logs

CloudWatch → _Log groups_ → `/ecs/mesacapital`, retención **30 días**.

### 6.8 Definición de la tarea

```json
{
	"family": "mesacapital",
	"networkMode": "awsvpc",
	"requiresCompatibilities": ["FARGATE"],
	"cpu": "512",
	"memory": "1024",
	"runtimePlatform": { "cpuArchitecture": "X86_64", "operatingSystemFamily": "LINUX" },
	"executionRoleArn": "arn:aws:iam::<CUENTA>:role/mesacapital-task-execution",
	"containerDefinitions": [
		{
			"name": "app",
			"image": "<CUENTA>.dkr.ecr.us-east-1.amazonaws.com/mesacapital:1.0.0",
			"essential": true,
			"portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
			"environment": [
				{ "name": "ORIGIN", "value": "https://app.mesacapital.co" },
				{ "name": "ADDRESS_HEADER", "value": "X-Forwarded-For" },
				{ "name": "XFF_DEPTH", "value": "1" },
				{ "name": "KEEP_ALIVE_TIMEOUT", "value": "65" },
				{ "name": "HEADERS_TIMEOUT", "value": "66" },
				{
					"name": "PAGO_INSTRUCCIONES",
					"value": "Nequi 300 000 0000 | Bancolombia ahorros 000-000000-00 | Envía el comprobante por WhatsApp"
				},
				{ "name": "SOPORTE_WHATSAPP", "value": "573000000000" }
			],
			"secrets": [
				{
					"name": "DATABASE_URL",
					"valueFrom": "arn:aws:secretsmanager:us-east-1:<CUENTA>:secret:mesacapital/prod-XXXXXX:DATABASE_URL::"
				}
			],
			"healthCheck": {
				"command": ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1"],
				"interval": 30,
				"timeout": 5,
				"retries": 3,
				"startPeriod": 20
			},
			"stopTimeout": 30,
			"logConfiguration": {
				"logDriver": "awslogs",
				"options": {
					"awslogs-group": "/ecs/mesacapital",
					"awslogs-region": "us-east-1",
					"awslogs-stream-prefix": "app"
				}
			}
		}
	]
}
```

- **0,5 vCPU y 1 GB** por tarea alcanzan holgadamente para decenas de restaurantes; Argon2 (login) es lo más pesado.
- `stopTimeout: 30` coincide con `SHUTDOWN_TIMEOUT` (30 s por defecto en SvelteKit): las peticiones en curso terminan antes de apagar la tarea.

### 6.9 Clúster y servicio

- **Cluster**: `mesacapital` (Fargate).
- **Service**: definición `mesacapital`, **2 tareas**, subredes públicas en 2 zonas, `sg-app`, IP pública activada, conectado al ALB y al target group.
- **Despliegue**: mínimo saludable **100 %**, máximo **200 %**, **deployment circuit breaker con rollback** activado (si la versión nueva no pasa `/health`, vuelve sola a la anterior). Gracia del health check: 30 s.
- **Auto Scaling**: seguimiento de **CPU al 60 %**, mínimo 2 y máximo 4 tareas.

### 6.10 DNS

Route 53 → registro **A (Alias)** `app.mesacapital.co` → el ALB.

### 6.11 Migraciones con una tarea de una sola vez

La misma imagen trae el runner. Antes de cada despliegue que incluya migraciones:

```bash
aws ecs run-task --cluster mesacapital --launch-type FARGATE \
  --task-definition mesacapital \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-aaa,subnet-bbb],securityGroups=[sg-app],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"app","command":["node","scripts/migrate.mjs"]}]}'
```

Revisa el resultado en el log group (`✓ NNNN_….sql aplicada`). Si falla, la migración se revierte completa. Antes, toma el respaldo del [Paso 2](#paso-2--respaldo-siempre-que-haya-migración).

Para crear tu usuario de la consola, hazlo desde tu computador (`pnpm plataforma:admin … --totp`), porque pide la contraseña por la terminal. Después registra el secreto en tu app autenticadora, pruébalo con `pnpm plataforma:totp --probar` y agrega `PLATFORM_REQUIRE_TOTP=1` a la tarea.

### 6.12 Firewall (AWS WAF) — asociado al ALB

Web ACL `mesacapital-waf` con:

1. **AWS Managed Rules**: `AWSManagedRulesCommonRuleSet` y `AWSManagedRulesKnownBadInputsRuleSet`.
2. **Límite por IP en login**: _rate-based rule_ de **100 peticiones cada 5 minutos por IP** cuando la ruta empieza por `/login` o `/plataforma/login` → _Block_.
3. **Consola solo desde tus IPs**: un _IP set_ con tu(s) IP(s), y una regla que **bloquea** `/plataforma*` si la IP **no** está en ese set. Es la protección más fuerte para la consola.

> Si la regla común bloquea algún formulario legítimo (p. ej. descripciones largas), revisa en los logs de WAF qué sub-regla fue y ponla en modo _Count_.

### 6.13 Monitoreo y alarmas (SNS → tu correo/WhatsApp)

- **Route 53 Health Check** contra `https://app.mesacapital.co/health` cada 30 s → alarma si falla.
- **ALB**: `HTTPCode_Target_5XX_Count` > 10 en 5 minutos; `UnHealthyHostCount` ≥ 1.
- **ECS**: CPU > 80 % y memoria > 80 % sostenidas 10 minutos.
- **Logs**: _metric filter_ sobre `/ecs/mesacapital` que cuente líneas con `error` → alarma si pasan de 20 en 5 minutos.
- **Errores con código de soporte:** _metric filter_ sobre `"nivel":"error"` y búsqueda por `errorId` en CloudWatch Logs Insights: `fields @timestamp, msg, tenantId, err.message | filter errorId = "…"`.
- (Opcional) **Sentry** para ver errores con su contexto.

### 6.14 Despliegue automático (GitHub Actions + OIDC, sin llaves guardadas)

1. IAM → _Identity providers_ → **OpenID Connect**: proveedor `token.actions.githubusercontent.com`, audiencia `sts.amazonaws.com`.
2. Rol `github-deploy-mesacapital`. Que confíe en ese proveedor **solo** para `repo:simviz12/juserr:ref:refs/heads/main` y tenga permisos para hacer push a ECR, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`, `ecs:RunTask` e `iam:PassRole` sobre el rol de ejecución.
3. Guarda la definición de la tarea en el repo (`aws/task-definition.json`, sin secretos: el secreto va por ARN) y crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment: production # exige aprobación manual si la configuras en GitHub
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<CUENTA>:role/github-deploy-mesacapital
          aws-region: us-east-1
      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2
      - name: Build y push
        run: |
          IMAGE=${{ steps.ecr.outputs.registry }}/mesacapital:${{ github.sha }}
          docker build --platform linux/amd64 -t $IMAGE .
          docker push $IMAGE
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV
      - id: td
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: aws/task-definition.json
          container-name: app
          image: ${{ env.IMAGE }}
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.td.outputs.task-definition }}
          service: mesacapital
          cluster: mesacapital
          wait-for-service-stability: true
```

> Verifica en GitHub Marketplace la última versión de cada acción antes de usarla. Las **migraciones no** se corren solas en este flujo, a propósito: se ejecutan con la tarea de la [sección 6.11](#611-migraciones-con-una-tarea-de-una-sola-vez) después de tomar el respaldo.

---

## 7. Respaldos

1. **Neon PITR**: activo según tu plan (restaura a un minuto exacto).
2. **Branch antes de cada migración** (manual, 10 segundos).
3. **Copia semanal a S3** fuera de Neon:
   - Bucket `mesacapital-respaldos` en us-east-1 con **versionado**, **cifrado** (SSE-S3 o KMS), **bloqueo de acceso público** y regla de ciclo de vida (pasar a Glacier a los 30 días y borrar a los 365).
   - Una GitHub Action programada (o una tarea programada de ECS) que ejecute `pg_dump` y suba el archivo:

```yaml
name: Respaldo semanal
on:
  schedule: [{ cron: '0 8 * * 1' }] # lunes 03:00 Colombia
  workflow_dispatch:
permissions: { id-token: write, contents: read }
jobs:
  backup:
    runs-on: ubuntu-latest
    container: postgres:18 # pg_dump debe ser ≥ la versión del servidor (Neon reporta PostgreSQL 18)
    steps:
      - name: Instalar AWS CLI
        run: apt-get update && apt-get install -y awscli
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<CUENTA>:role/github-backup-mesacapital
          aws-region: us-east-1
      - name: Dump y subida
        env: { DATABASE_URL: '${{ secrets.DATABASE_URL_BACKUP }}' }
        run: |
          F=mesacapital-$(date -u +%Y%m%d).dump
          pg_dump --format=custom --no-owner "$DATABASE_URL" -f "$F"
          aws s3 cp "$F" s3://mesacapital-respaldos/semanal/ --sse AES256
```

El rol `github-backup-mesacapital` solo necesita `s3:PutObject` sobre ese bucket. Para `DATABASE_URL_BACKUP` crea en Neon un **rol de solo lectura** y úsalo aquí. 4. **Prueba de restauración trimestral**: `pg_restore` del último dump en un branch nuevo de Neon y abre la app contra él.

---

## 8. Pasar de Vercel a AWS

La base **no se mueve** (sigue en Neon) y ya está migrada; solo cambia dónde corre la app. Por eso se puede hacer **sin ventana de mantenimiento**:

| #   | Paso                                                                                                                              | Cómo verificar                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Monta la infraestructura (Ruta A o B) con la imagen del mismo commit que está en Vercel                                           | `/health` responde por la URL del balanceador con la misma `version` de código |
| 2   | Configura las variables de la [sección 3](#3-variables-de-entorno-de-producción-aws--docker), con el `DATABASE_URL` de producción | `/health` → `db: ok`                                                           |
| 3   | Prueba por la URL del balanceador: login de un restaurante, un cierre en `prueba-interna`, la consola                             | Todo funciona igual que en Vercel                                              |
| 4   | Baja el TTL del registro DNS a 60 s un día antes                                                                                  | `nslookup` muestra el TTL nuevo                                                |
| 5   | DNS: `app.mesacapital.co` → AWS                                                                                                   | `nslookup app.mesacapital.co` muestra AWS                                      |
| 6   | Deja Vercel encendido 48 h (por si hay que volver) y luego quítale el dominio                                                     | Los logs de Vercel ya no reciben tráfico                                       |

**Reversa:** vuelve a apuntar el DNS a Vercel. Como ambos usan la misma base y el mismo código, no se pierde nada.

> Desde que la app viva en AWS, el despliegue sigue la [Parte 2](#parte-2--procedimiento-de-cada-despliegue-runbook) igual que hoy; solo cambia el paso 4.

---

## 9. A futuro: pasar la base a RDS o Aurora

Solo si lo necesitas (p. ej. un cliente exige que los datos estén en tu cuenta de AWS):

1. `src/lib/server/db.ts` → `drizzle-orm/node-postgres` con un `Pool` (`pg`).
2. Reemplazar `db.batch([...])` por `await db.transaction(async (tx) => { ... })` en el cierre de turno, bodega, configuración de líneas y facturación. Mejor aún: ganas transacciones reales con bloqueos.
3. Los `db.execute(sql\`SELECT nextval(...)\`)` siguen funcionando.
4. Las tareas de ECS pasan a **subredes privadas** con acceso a RDS por security group. Agrega **RDS Proxy** si hay muchas conexiones.
5. Corre toda la batería de pruebas: cubren exactamente esos flujos.

## 10. Escalar

| Señal                                     | Acción                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CPU sostenida > 60 % con 4 tareas         | Sube a 1 vCPU / 2 GB o el máximo del auto scaling                                                                                     |
| Necesitas invalidación instantánea global | Mueve las cachés de sesiones (5 s) y derechos (10 s) a **ElastiCache/Upstash (Redis)**. El freno de login ya es compartido (Postgres) |
| Clientes fuera de Colombia                | CloudFront delante del ALB (recuerda `XFF_DEPTH=2`)                                                                                   |
| Base lenta                                | Revisa en Neon las consultas lentas; los índices `(tenant_id, fecha)` cubren el uso normal                                            |
