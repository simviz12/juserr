/**
 * Crea una FUNCIÓN EXCLUSIVA para un restaurante (desarrollo a pedido).
 *
 *   pnpm modulo:nuevo <codigo-modulo> --para <codigo-restaurante> --nombre "Nombre visible" [--precio 50000] [--icono truck]
 *
 * Ejemplo:
 *   pnpm modulo:nuevo domicilios-donjuan --para pizzeria-don-juan --nombre "Domicilios" --precio 39000 --icono truck
 *
 * Genera:
 *   src/lib/modules/<codigo>/README.md          ficha del desarrollo (cliente, alcance, precio)
 *   src/lib/modules/<codigo>/server/datos.ts    lugar para su lógica de servidor (ya con aislamiento por restaurante)
 *   src/routes/m/<codigo>/+page.server.ts       página del módulo (load + acción de ejemplo)
 *   src/routes/m/<codigo>/+page.svelte
 *   migrations/NNNN_modulo_<codigo>.sql         lo agrega al catálogo como EXCLUSIVO del restaurante
 * y lo registra en src/lib/modules/registry.ts (EXCLUSIVOS) con su entrada en el menú.
 *
 * Después: escribe la función, `pnpm lint && pnpm check && pnpm vitest run`, despliega,
 * `pnpm db:migrate` y actívalo en la consola (ficha del restaurante → Activar un módulo).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONOS = [
	'puzzle',
	'truck',
	'calendar',
	'clipboard',
	'chart',
	'users',
	'star',
	'receipt',
	'package',
	'utensils'
];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function arg(nombre) {
	const i = process.argv.indexOf(`--${nombre}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}
function salir(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

const codigo = process.argv[2];
const para = arg('para');
const nombre = arg('nombre');
const precio = Number(arg('precio') ?? '0');
const icono = arg('icono') ?? 'puzzle';

if (!codigo || codigo.startsWith('--'))
	salir(
		'Falta el código del módulo. Uso: pnpm modulo:nuevo <codigo> --para <restaurante> --nombre "Nombre"'
	);
if (!SLUG.test(codigo) || codigo.length > 40)
	salir('El código del módulo debe ser minúsculas, números y guiones (máx. 40).');
if (codigo === 'core') salir('"core" está reservado.');
if (!para || !SLUG.test(para))
	salir('Indica el código del restaurante dueño: --para <codigo-restaurante>');
if (!nombre || nombre.trim().length < 3)
	salir('Indica el nombre visible: --nombre "Nombre de la función"');
if (!Number.isFinite(precio) || precio < 0)
	salir('--precio debe ser un número en pesos (ej. 39000).');
if (!ICONOS.includes(icono)) salir(`--icono debe ser uno de: ${ICONOS.join(', ')}`);

const rutaRegistro = path.join(RAIZ, 'src/lib/modules/registry.ts');
const registro = readFileSync(rutaRegistro, 'utf8');
const MARCADOR = '// @modulos-exclusivos';
if (!registro.includes(MARCADOR)) salir(`No encuentro el marcador "${MARCADOR}" en registry.ts.`);
if (registro.includes(`codigo: '${codigo}'`)) salir(`Ya existe un módulo con código "${codigo}".`);

const dirModulo = path.join(RAIZ, 'src/lib/modules', codigo);
const dirRuta = path.join(RAIZ, 'src/routes/m', codigo);
if (existsSync(dirModulo) || existsSync(dirRuta)) salir(`Ya existen carpetas para "${codigo}".`);

const nombreTs = JSON.stringify(nombre.trim()).slice(1, -1).replace(/'/g, "\\'");
const nombreSql = nombre.trim().replace(/'/g, "''");
const hoy = new Date().toISOString().slice(0, 10);
const generados = ['src/lib/modules/registry.ts'];
const escribir = (rel, contenido) => {
	generados.push(rel);
	const destino = path.join(RAIZ, rel);
	mkdirSync(path.dirname(destino), { recursive: true });
	writeFileSync(destino, contenido);
	console.log(`  + ${rel}`);
};

console.log(`Creando la función exclusiva "${nombre}" para el restaurante "${para}"…`);

// 1. Ficha del desarrollo
escribir(
	`src/lib/modules/${codigo}/README.md`,
	`# ${nombre.trim()}

- **Código del módulo:** \`${codigo}\`
- **Exclusivo de:** \`${para}\`
- **Precio mensual pactado:** $${precio.toLocaleString('es-CO')}
- **Creado:** ${hoy}
- **Ruta:** \`/m/${codigo}\`

## Qué pidió el cliente

<!-- Describe aquí el problema del restaurante y lo que acordaron (alcance). -->

## Qué hace

<!-- Pantallas, reglas, cálculos. -->

## Datos

<!-- Tablas nuevas (con tenant_id) o tablas del Core que lee. -->

## Reglas de este módulo

- Solo importa del Core (\`$lib/...\`); nunca de otro módulo.
- Toda consulta usa \`tenantDe(locals)\` + \`delTenant(...)\`.
- Para cualquier otro restaurante esta función no existe (404).
`
);

// 2. Servidor del módulo
escribir(
	`src/lib/modules/${codigo}/server/datos.ts`,
	`/**
 * Lógica de servidor de "${nombre.trim()}" (exclusivo de ${para}).
 * Toda consulta filtra por restaurante con delTenant(); el tenantId sale SIEMPRE de la sesión.
 */
import { db } from '$lib/server/db';
import { turnos } from '$lib/server/schema';
import { desc } from 'drizzle-orm';
import { delTenant } from '$lib/server/tenancy';

/** Ejemplo: últimos turnos del restaurante (reemplázalo por la lógica del módulo). */
export async function ultimosTurnos(tenantId: number, limite = 10) {
	return db
		.select({ id: turnos.id, fecha: turnos.fecha, monto: turnos.monto })
		.from(turnos)
		.where(delTenant(turnos, tenantId))
		.orderBy(desc(turnos.fecha))
		.limit(limite);
}
`
);

// 3. Página
escribir(
	`src/routes/m/${codigo}/+page.server.ts`,
	`import type { PageServerLoad } from './$types';
import { tenantDe } from '$lib/server/tenancy';
import { ultimosTurnos } from '$lib/modules/${codigo}/server/datos';

// El acceso (dueño + módulo pagado) lo garantiza hooks.server.ts con el registro de módulos.
export const load: PageServerLoad = async ({ locals }) => {
	const tid = tenantDe(locals);
	const turnos = await ultimosTurnos(tid);
	return {
		turnos: turnos.map((t) => ({ ...t, fecha: t.fecha ? t.fecha.toISOString() : null }))
	};
};
`
);
escribir(
	`src/routes/m/${codigo}/+page.svelte`,
	`<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { formatCOP, formatDateTime } from '$lib/utils/format';

	let { data } = $props();
</script>

<svelte:head><title>${nombre.trim()} · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6">
	<PageHeader title="${nombre.trim().replace(/"/g, '&quot;')}" description="Función hecha a la medida de tu restaurante." />
	<Card title="Últimos turnos" description="Ejemplo de datos de tu restaurante: reemplázalo por la función.">
		<ul class="divide-y divide-border text-sm">
			{#each data.turnos as t (t.id)}
				<li class="flex justify-between py-2">
					<span>{formatDateTime(t.fecha)}</span><span class="tabular-nums">{formatCOP(Number(t.monto))}</span>
				</li>
			{:else}
				<li class="py-2 text-muted-foreground">Aún no hay turnos.</li>
			{/each}
		</ul>
	</Card>
</div>
`
);

// 4. Registro (EXCLUSIVOS)
const entrada = `	{
		codigo: '${codigo}',
		nombre: '${nombreTs}',
		rutas: ['/m/${codigo}'],
		exclusivoDe: '${para}',
		menu: { nombre: '${nombreTs}', ruta: '/m/${codigo}', icono: '${icono}' }
	},
	${MARCADOR}`;
// Prettier quita la coma final de la última entrada: si la anterior termina en "}", se la devolvemos.
const iMarcador = registro.indexOf(`\t${MARCADOR}`);
let previo = iMarcador - 1;
while (previo >= 0 && /\s/.test(registro[previo])) previo--;
const conComa =
	registro[previo] === '}'
		? registro.slice(0, previo + 1) + ',' + registro.slice(previo + 1)
		: registro;
writeFileSync(rutaRegistro, conComa.replace(`\t${MARCADOR}`, entrada));
console.log('  ~ src/lib/modules/registry.ts (EXCLUSIVOS)');

// 5. Migración: catálogo como exclusivo del restaurante
const dirMig = path.join(RAIZ, 'migrations');
const ultimo = readdirSync(dirMig)
	.map((f) => Number(/^(\d{4})_/.exec(f)?.[1] ?? 0))
	.reduce((a, b) => Math.max(a, b), 0);
const numero = String(ultimo + 1).padStart(4, '0');
escribir(
	`migrations/${numero}_modulo_${codigo}.sql`,
	`-- Función EXCLUSIVA "${nombreSql}" para el restaurante "${para}" (creada ${hoy} con pnpm modulo:nuevo).
-- Queda en el catálogo como no pública y solo activable para ese restaurante
-- (CHECK + trigger de la migración 0002). Se activa desde la consola.
DO $$
DECLARE
	dueno integer;
BEGIN
	SELECT id INTO dueno FROM tenants WHERE codigo = '${para}';
	IF dueno IS NULL THEN
		RAISE NOTICE 'El restaurante "${para}" no existe en esta base: el módulo no se agrega al catálogo.';
		RETURN;
	END IF;
	INSERT INTO modulos_catalogo (codigo, nombre, descripcion, precio_mensual_cents, es_core, publico, orden, exclusivo_tenant_id)
	VALUES ('${codigo}', '${nombreSql}', 'Función hecha a la medida.', ${Math.round(precio * 100)}, false, false, 900, dueno)
	ON CONFLICT (codigo) DO NOTHING;
END $$;
`
);

// 6. Formato del proyecto (Prettier) sobre lo generado
try {
	const prettier = path.join(RAIZ, 'node_modules/prettier/bin/prettier.cjs');
	const archivos = generados.filter((f) => !f.endsWith('.sql') && !f.endsWith('.md'));
	execFileSync(process.execPath, [prettier, '--write', ...archivos], {
		cwd: RAIZ,
		stdio: 'ignore'
	});
} catch {
	console.warn('  (No se pudo aplicar Prettier; ejecuta pnpm format)');
}

console.log(`
✓ Listo. Siguientes pasos:
  1. Escribe la función en src/lib/modules/${codigo}/ y src/routes/m/${codigo}/
     (tablas nuevas: agrégalas a schema.ts con tenantId() y a la migración ${numero}).
  2. pnpm lint && pnpm check && pnpm vitest run
  3. Despliega, luego: pnpm db:migrate
  4. Consola → ficha de "${para}" → Activar un módulo → "★ ${nombre.trim()}"
Para cualquier otro restaurante, /m/${codigo} responde 404 y no aparece en su menú.`);
