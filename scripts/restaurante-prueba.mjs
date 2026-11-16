/**
 * Restaurante de PRUEBA para probar la app sin tocar datos reales.
 *
 *   node scripts/restaurante-prueba.mjs            crea (o reinicia las contraseñas de) "prueba-interna"
 *   node scripts/restaurante-prueba.mjs --borrar   lo cancela y cierra sus sesiones
 *
 * Crea un usuario por rol (jefe, bodeguero, cajero) con contraseñas aleatorias
 * que se imprimen UNA vez, el Core y todos los add-ons públicos por 15 días.
 * Nunca toca otros restaurantes.
 */
import { neon } from '@neondatabase/serverless';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import 'dotenv/config';

const CODIGO = 'prueba-interna';
const USUARIOS = [
	{ nombre: 'jefe-prueba', rol: 'jefe' },
	{ nombre: 'bodega-prueba', rol: 'bodeguero' },
	{ nombre: 'caja-prueba', rol: 'cajero' }
];

if (!process.env.DATABASE_URL) {
	console.error('Falta DATABASE_URL en el entorno (.env).');
	process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

if (process.argv.includes('--borrar')) {
	const r =
		await sql`UPDATE tenants SET estado = 'cancelado' WHERE codigo = ${CODIGO} RETURNING id`;
	if (!r.length) console.log(`No existe "${CODIGO}".`);
	else {
		await sql`DELETE FROM sesiones WHERE user_id IN (SELECT id FROM usuarios WHERE tenant_id = ${r[0].id})`;
		console.log(`"${CODIGO}" cancelado: ya nadie puede entrar con sus usuarios.`);
	}
	process.exit(0);
}

const clave = () => randomBytes(9).toString('base64url');
const [t] = await sql`
	INSERT INTO tenants (codigo, nombre, estado, contacto_nombre)
	VALUES (${CODIGO}, 'Restaurante de prueba', 'activo', 'Pruebas internas')
	ON CONFLICT (codigo) DO UPDATE SET estado = 'activo'
	RETURNING id`;

await sql`
	INSERT INTO rubros_config (tenant_id, nombre_negocio)
	VALUES (${t.id}, 'Restaurante de prueba')
	ON CONFLICT (tenant_id) DO NOTHING`;

// Core + add-ons públicos por 15 días (precio 0: es interno, no se factura).
await sql`
	INSERT INTO suscripciones_modulo (tenant_id, modulo, vigente_hasta, precio_mensual_cents)
	SELECT ${t.id}, codigo, (now() AT TIME ZONE 'America/Bogota')::date + 15, 0
	FROM modulos_catalogo WHERE (es_core OR publico) AND exclusivo_tenant_id IS NULL
	ON CONFLICT (tenant_id, modulo) DO UPDATE
		SET estado = 'activa', vigente_hasta = EXCLUDED.vigente_hasta`;

const filas = [];
for (const u of USUARIOS) {
	const pass = clave();
	const h = await hash(pass);
	const [row] = await sql`
		INSERT INTO usuarios (tenant_id, nombre, password_hash, rol)
		VALUES (${t.id}, ${u.nombre}, ${h}, ${u.rol})
		ON CONFLICT (tenant_id, lower(nombre)) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol
		RETURNING id`;
	await sql`DELETE FROM sesiones WHERE user_id = ${row.id}`;
	filas.push({ ...u, pass });
}

console.log(`\nRestaurante de prueba listo. Código del restaurante: ${CODIGO}\n`);
for (const f of filas)
	console.log(`  ${f.rol.padEnd(10)} usuario: ${f.nombre.padEnd(14)} contraseña: ${f.pass}`);
console.log(
	'\nLas contraseñas no se vuelven a mostrar; si las pierdes, corre el script de nuevo.\nAl terminar: node scripts/restaurante-prueba.mjs --borrar'
);
