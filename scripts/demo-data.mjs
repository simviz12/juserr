/**
 * Datos de demostración NO destructivos para MesaCapital.
 *
 *   node scripts/demo-data.mjs           → inserta ~70 días de operación simulada
 *   node scripts/demo-data.mjs --remove  → borra SOLO lo insertado y restaura stock/configuración
 *
 * Todo lo creado se registra en scripts/.demo-manifest.json para poder deshacerlo.
 * A diferencia de src/lib/server/seed-4dias.ts, este script NUNCA borra datos existentes.
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '.demo-manifest.json');
const sql = neon(process.env.DATABASE_URL);

// ── Utilidades ────────────────────────────────────────────────
let seed = 20261109;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const r100 = (n) => Math.round(n / 100) * 100;
/**
 * Instante UTC (ISO) para una hora local de Colombia (UTC-5).
 * IMPORTANTE: las columnas son `timestamp` SIN zona; la app guarda en UTC.
 * Se envía siempre un string ISO UTC: si se pasa un Date, el driver lo
 * serializa en hora local del equipo y queda desfasado 5 horas.
 */
const co = (ymd, h, m = 0) => {
	const [y, mo, d] = ymd.split('-').map(Number);
	return new Date(Date.UTC(y, mo - 1, d, h + 5, m)).toISOString().replace('Z', '');
};
const addDays = (ymd, n) => {
	const d = new Date(ymd + 'T12:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
};
/** Inicio de jornada (04:00 Colombia) del día dado. */
const jornada = (ymd) => co(ymd, 4);

// ── Eliminación ───────────────────────────────────────────────
async function remove() {
	if (!fs.existsSync(MANIFEST)) {
		console.log('No hay manifiesto de datos demo; nada que borrar.');
		return;
	}
	const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
	const ids = (a) => (a && a.length ? a : [-1]);
	await sql.transaction([
		sql`DELETE FROM ventas_items WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM cierres_linea WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM pizza_ventas WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM pizza_sobras WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM pizza_ruedas WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM transacciones_turno WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM gastos WHERE turno_id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM turnos WHERE id = ANY(${ids(m.turnos)})`,
		sql`DELETE FROM movimientos_inventario WHERE id = ANY(${ids(m.movimientos)})`,
		sql`DELETE FROM cierres_dia WHERE id = ANY(${ids(m.cierres)})`,
		sql`DELETE FROM cortes_semanales WHERE id = ANY(${ids(m.cortes)})`,
		sql`DELETE FROM items_linea WHERE id = ANY(${ids(m.items)})`,
		...m.stockOriginal.map((p) => sql`UPDATE productos SET stock_actual = ${p.stock}, precio_costo = ${p.costo} WHERE id = ${p.id}`),
		...(m.lineaControlOriginal ?? []).map((l) => sql`UPDATE lineas_gastronomicas SET producto_control_id = ${l.producto} WHERE id = ${l.id}`),
		sql`DELETE FROM productos WHERE id = ANY(${ids(m.productosCreados)})`,
		...(m.configOriginal
			? [
					sql`UPDATE rubros_config SET habilitar_pizzas = ${m.configOriginal.habilitar_pizzas}, rubro_principal = ${m.configOriginal.rubro_principal} WHERE id = ${m.configOriginal.id}`,
					...(m.configOriginal.habilitar_hamburguesas !== undefined
						? [sql`UPDATE rubros_config SET habilitar_hamburguesas = ${m.configOriginal.habilitar_hamburguesas}, habilitar_carnes = ${m.configOriginal.habilitar_carnes} WHERE id = ${m.configOriginal.id}`]
						: [])
				]
			: [])
	]);
	fs.unlinkSync(MANIFEST);
	console.log(`Datos demo eliminados: ${m.turnos.length} turnos, ${m.movimientos.length} movimientos, ${m.cierres.length} cierres, ${m.cortes.length} cortes, ${m.items.length} platos. Stock y configuración restaurados.`);
}

// ── Inserción ─────────────────────────────────────────────────
async function insert() {
	if (fs.existsSync(MANIFEST)) {
		console.log('Ya hay datos demo cargados. Ejecuta primero con --remove.');
		return;
	}
	const m = { creado: new Date().toISOString(), turnos: [], movimientos: [], cierres: [], cortes: [], items: [], productosCreados: [], stockOriginal: [], configOriginal: null };
	const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

	const [gabo] = await sql`SELECT id FROM usuarios WHERE rol = 'jefe' ORDER BY id LIMIT 1`;
	const sabores = await sql`SELECT id, precio_porcion FROM pizza_sabores WHERE activo = true ORDER BY id`;
	if (sabores.length === 0) throw new Error('No hay sabores activos.');
	const precioProm = Math.round(sabores.reduce((a, s) => a + Number(s.precio_porcion), 0) / sabores.length);

	// Configuración: activar Pizzas para la demo (se restaura al borrar)
	const [cfg] = await sql`SELECT id, habilitar_pizzas, habilitar_hamburguesas, habilitar_carnes, rubro_principal FROM rubros_config ORDER BY id LIMIT 1`;
	if (cfg) {
		m.configOriginal = cfg;
		// Demo mixta: pizzas + hamburguesas + carnes (se restaura al borrar)
		await sql`UPDATE rubros_config SET habilitar_pizzas = true, habilitar_hamburguesas = true, habilitar_carnes = true, rubro_principal = 'mixto' WHERE id = ${cfg.id}`;
	}

	// Productos: guardar stock original y crear insumos de cocina
	const existentes = await sql`SELECT id, nombre, stock_actual, precio_costo FROM productos`;
	m.stockOriginal = existentes.map((p) => ({ id: p.id, stock: p.stock_actual, costo: p.precio_costo }));
	const byName = Object.fromEntries(existentes.map((p) => [p.nombre.toLowerCase(), p.id]));
	const cats = Object.fromEntries((await sql`SELECT id, nombre FROM categorias`).map((c) => [c.nombre.toLowerCase(), c.id]));
	const catId = (frag) => Object.entries(cats).find(([n]) => n.includes(frag))?.[1] ?? null;
	const nuevos = [
		{ nombre: 'Queso mozzarella', unidad: 'kilo', min: 3, cat: catId('lác') },
		{ nombre: 'Pepperoni', unidad: 'kilo', min: 1, cat: catId('cárn') },
		{ nombre: 'Jamón', unidad: 'kilo', min: 1, cat: catId('cárn') },
		{ nombre: 'Salsa de tomate', unidad: 'litro', min: 2, cat: catId('bases') },
		{ nombre: 'Piña en almíbar', unidad: 'kilo', min: 1, cat: catId('veget') },
		{ nombre: 'Cajas para pizza', unidad: 'paquete', min: 2, cat: catId('bases') }
	];
	for (const n of nuevos) {
		if (byName[n.nombre.toLowerCase()]) continue;
		const [row] = await sql`INSERT INTO productos (nombre, categoria_id, unidad_medida, stock_actual, stock_minimo, precio, precio_costo) VALUES (${n.nombre}, ${n.cat}, ${n.unidad}, 0, ${n.min}, '0', '0') RETURNING id`;
		byName[n.nombre.toLowerCase()] = row.id;
		m.productosCreados.push(row.id);
	}
	save();

	// Líneas por inventario: insumo de control (pan / porción de carne) y platos
	const lineasDb = Object.fromEntries((await sql`SELECT id, codigo, producto_control_id FROM lineas_gastronomicas`).map((l) => [l.codigo, l]));
	m.lineaControlOriginal = Object.values(lineasDb).map((l) => ({ id: l.id, producto: l.producto_control_id }));
	const CONTROL = { burger: { nombre: 'Pan de hamburguesa', costo: 700 }, carne: { nombre: 'Porciones de carne', costo: 9000 } };
	const control = {};
	for (const [codigo, def] of Object.entries(CONTROL)) {
		const linea = lineasDb[codigo];
		if (!linea) continue;
		let prodId = linea.producto_control_id ?? byName[def.nombre.toLowerCase()];
		if (!prodId) {
			const [row] = await sql`INSERT INTO productos (nombre, unidad_medida, stock_actual, stock_minimo, precio, precio_costo) VALUES (${def.nombre}, 'unidad', 0, 10, '0', '0') RETURNING id`;
			prodId = row.id;
			m.productosCreados.push(prodId);
		}
		byName[def.nombre.toLowerCase()] ??= prodId;
		await sql`UPDATE lineas_gastronomicas SET producto_control_id = ${prodId} WHERE id = ${linea.id}`;
		control[codigo] = { lineaId: linea.id, prodId, costo: def.costo, platos: [] };
	}
	const PLATOS = [
		['pizza', 'Pizza familiar hawaiana', 42000, 12500],
		['pizza', 'Porción + gaseosa', 8500, 2900],
		['burger', 'Hamburguesa clásica', 16000, 5200],
		['burger', 'Hamburguesa doble queso + papas', 24000, 9100],
		['burger', 'Combo infantil', 14000, 5600],
		['carne', 'Churrasco 300 g', 32000, 13800],
		['carne', 'Costillas BBQ', 29000, 11200]
	];
	for (const [codigo, nombre, venta, costo] of PLATOS) {
		if (!lineasDb[codigo]) continue;
		const [row] = await sql`INSERT INTO items_linea (linea_id, nombre, precio_venta, precio_costo, activo, unidades_control) VALUES (${lineasDb[codigo].id}, ${nombre}, ${venta}, ${costo}, true, 1) RETURNING id`;
		m.items.push(row.id);
		control[codigo]?.platos.push({ id: row.id, precio: venta, costo });
	}
	save();

	const masaId = byName['masa'] ?? byName['masas'];
	const stock = Object.fromEntries(Object.values(byName).map((id) => [id, 0]));
	const costoAcum = Object.fromEntries(Object.values(byName).map((id) => [id, 0]));
	const movs = [];
	const compra = (prodId, cantidad, costoTotal, fecha) => {
		const prevStock = stock[prodId];
		const nuevo = prevStock + cantidad;
		costoAcum[prodId] = nuevo > 0 ? (prevStock * costoAcum[prodId] + costoTotal) / nuevo : costoAcum[prodId];
		stock[prodId] = nuevo;
		movs.push({ prodId, tipo: 'entrada', cantidad, costoTotal, costoUnit: costoTotal / cantidad, fecha });
	};
	const ajuste = (prodId, contado, fecha) => {
		movs.push({ prodId, tipo: 'ajuste', cantidad: contado - stock[prodId], costoTotal: 0, costoUnit: 0, fecha });
		stock[prodId] = contado;
	};

	// ── Simulación día a día ─────────────────────────────────
	const INICIO = '2026-09-01';
	const HOY = new Date(Date.now() - 9 * 3600e3).toISOString().slice(0, 10); // día de negocio actual
	const GASTOS = [['Hielo', 4000, 9000], ['Gas', 18000, 32000], ['Domicilio', 5000, 12000], ['Servilletas', 6000, 10000], ['Bolsas', 4000, 8000], ['Aseo', 7000, 15000]];
	let sobrasPorSabor = Object.fromEntries(sabores.map((s) => [s.id, 0]));
	const resumenDia = {}; // ymd → { efectivo, nequi, gastos }
	let turnoN = 0;

	for (let d = INICIO; d <= HOY; d = addDays(d, 1)) {
		const dow = new Date(d + 'T12:00:00Z').getUTCDay();
		const esHoy = d === HOY;
		const fds = dow === 5 || dow === 6 || dow === 0;
		// Crecimiento suave mes a mes (sep < oct < nov) para ver tendencias
		const factorMes = d < '2026-10-01' ? 0.88 : d < '2026-11-01' ? 1 : 1.07;

		// Compra diaria de masas: completar hasta ~32 (o 18 si es hoy)
		const objetivoMasas = esHoy ? 18 : fds ? 34 : 28;
		const faltan = Math.max(0, objetivoMasas - stock[masaId]);
		if (faltan > 0) compra(masaId, faltan, faltan * pick([1700, 1800, 1800, 1900]), co(d, 9, between(0, 40)));
		// Panes y porciones de carne: completar el stock del día
		for (const [codigo, objetivo] of [['burger', fds ? 45 : 36], ['carne', fds ? 18 : 14]]) {
			const c = control[codigo];
			if (!c) continue;
			const f = Math.max(0, objetivo - stock[c.prodId]);
			if (f > 0) compra(c.prodId, f, f * c.costo, co(d, 9, 45));
		}

		// Compras semanales de insumos (lunes) y bebidas (jueves)
		if (dow === 1 || d === INICIO) {
			compra(byName['queso mozzarella'], 16, 16 * between(36000, 39000), co(d, 10, 15));
			compra(byName['pepperoni'], 4, 4 * between(42000, 46000), co(d, 10, 20));
			compra(byName['jamón'], 4, 4 * between(26000, 29000), co(d, 10, 25));
			compra(byName['salsa de tomate'], 8, 8 * 9500, co(d, 10, 30));
			compra(byName['piña en almíbar'], 3, 3 * 12000, co(d, 10, 35));
			compra(byName['cajas para pizza'], 4, 4 * 32000, co(d, 10, 40));
		}
		if (dow === 4) {
			for (const b of ['coca cola 400ml', 'jugo hit mora', 'agua cristal 600ml']) {
				if (byName[b]) compra(byName[b], 24, 24 * 1500, co(d, 11, 0));
			}
		}
		// Conteo físico los domingos (merma natural de insumos)
		if (dow === 0) {
			for (const n of ['queso mozzarella', 'pepperoni', 'jamón', 'salsa de tomate', 'piña en almíbar', 'cajas para pizza']) {
				const id = byName[n];
				ajuste(id, Math.max(0, Math.round(stock[id] * 0.15 * 4) / 4), co(d, 23, 30));
			}
			for (const b of ['coca cola 400ml', 'jugo hit mora', 'agua cristal 600ml']) if (byName[b]) ajuste(byName[b], between(2, 9), co(d, 23, 35));
		}

		// Turnos: mañana (cierra 16:30) y noche (cierra 22:45). Hoy solo el de la mañana.
		const turnosDelDia = esHoy ? [[16, 30]] : dow === 1 && rand() < 0.4 ? [[22, 45]] : [[16, 30], [22, 45]];
		for (const [hh, mm] of turnosDelDia) {
			const fecha = esHoy ? co(d, 11, 30) : co(d, hh, mm); // hoy: cierre parcial a las 11:30
			const noche = hh >= 20;
			const masasIniciales = stock[masaId];
			const usar = Math.min(masasIniciales, Math.round((noche ? between(13, 18) : between(8, 12)) * factorMes * (fds ? 1.2 : 1)));
			const masasSobrantes = masasIniciales - usar;

			// Reparto de ruedas por sabor
			const ruedas = Object.fromEntries(sabores.map((s) => [s.id, 0]));
			for (let i = 0; i < usar; i++) ruedas[pick(sabores).id] += 1;
			const porcionesAyer = Object.values(sobrasPorSabor).reduce((a, b) => a + b, 0);
			const disponibles = Object.fromEntries(sabores.map((s) => [s.id, sobrasPorSabor[s.id] + ruedas[s.id] * 8]));

			// Sobrantes y mermas por sabor
			const sobras = {};
			const quemadas = {};
			for (const s of sabores) {
				sobras[s.id] = Math.min(disponibles[s.id], noche ? between(0, 3) : between(0, 2));
				quemadas[s.id] = Math.min(disponibles[s.id] - sobras[s.id], rand() < 0.25 ? between(1, 2) : 0);
			}
			const porcionesSobrantes = Object.values(sobras).reduce((a, b) => a + b, 0);
			const porcionesMermadas = Object.values(quemadas).reduce((a, b) => a + b, 0);
			const vendidas = Math.max(0, usar * 8 + porcionesAyer - porcionesSobrantes - porcionesMermadas);

			// Otras líneas: el cajero cuenta panes / porciones que sobran
			const cierresLinea = [];
			for (const [codigo, [a, b]] of [['burger', noche ? [8, 16] : [4, 9]], ['carne', noche ? [3, 7] : [1, 4]]]) {
				const c = control[codigo];
				if (!c || c.platos.length === 0) continue;
				const inicial = stock[c.prodId];
				const merma = rand() < 0.15 ? 1 : 0;
				const consumidas = Math.min(inicial - merma, Math.round(between(a, b) * factorMes * (fds ? 1.2 : 1)));
				const sobrantes = inicial - consumidas - merma;
				// Desglose por plato (completo en ~85 % de los turnos)
				const desglose = {};
				for (let i = 0; i < consumidas; i++) {
					const p = pick(c.platos);
					desglose[p.id] = (desglose[p.id] ?? 0) + 1;
				}
				const completo = rand() < 0.85;
				const ppu = c.platos.reduce((x, p) => x + p.precio, 0) / c.platos.length;
				const venta = completo
					? Object.entries(desglose).reduce((x, [id, q]) => x + q * c.platos.find((p) => p.id === Number(id)).precio, 0)
					: Math.round(consumidas * ppu);
				cierresLinea.push({ c, inicial, sobrantes, merma, consumidas, venta, completo, desglose });
				stock[c.prodId] = sobrantes;
			}
			const ventaLineas = cierresLinea.reduce((x, l) => x + l.venta, 0);

			// Dinero: venta esperada ± pequeña diferencia; parte de gastos sale del efectivo
			const esperado = vendidas * precioProm + ventaLineas;
			const gastosTurno = [];
			if (rand() < 0.45) {
				const [c, a, b] = pick(GASTOS);
				gastosTurno.push({ desc: c, monto: r100(between(a, b)) });
			}
			const totalGastos = gastosTurno.reduce((a, g) => a + g.monto, 0);
			const dif = rand() < 0.75 ? 0 : pick([-8000, -5000, -2000, 1000, 2000, 3000]);
			const nequi = r100(esperado * (0.32 + rand() * 0.16));
			const efectivo = Math.max(0, esperado - nequi - totalGastos + dif);

			turnoN += 1;
			const [t] = await sql`
				INSERT INTO turnos (monto, transferencias, descripcion, fecha, masas_iniciales, masas_sobrantes, porciones_ayer, porciones_sobrantes, porciones_mermadas, porciones_vendidas_calculado)
				VALUES (${efectivo}, ${nequi}, ${'Demo · ' + (esHoy ? 'turno en curso' : noche ? 'turno noche' : 'turno mañana') + (dif < 0 ? ' · faltante revisado' : '')}, ${fecha}, ${masasIniciales}, ${masasSobrantes}, ${porcionesAyer}, ${porcionesSobrantes}, ${porcionesMermadas}, ${vendidas})
				RETURNING id`;
			m.turnos.push(t.id);

			const qs = [];
			if (nequi > 0) qs.push(sql`INSERT INTO transacciones_turno (turno_id, plataforma, monto, referencias, fecha) VALUES (${t.id}, 'nequi', ${nequi}, ${`DEMO${t.id}A, DEMO${t.id}B`}, ${fecha})`);
			for (const g of gastosTurno) qs.push(sql`INSERT INTO gastos (turno_id, descripcion, monto, fecha) VALUES (${t.id}, ${g.desc}, ${g.monto}, ${fecha})`);
			for (const s of sabores) {
				const vend = Math.max(0, sobrasPorSabor[s.id] + ruedas[s.id] * 8 - sobras[s.id] - quemadas[s.id]);
				if (ruedas[s.id] > 0) qs.push(sql`INSERT INTO pizza_ruedas (sabor_id, turno_id, cantidad, fecha) VALUES (${s.id}, ${t.id}, ${ruedas[s.id]}, ${fecha})`);
				if (sobras[s.id] > 0) qs.push(sql`INSERT INTO pizza_sobras (sabor_id, turno_id, cantidad, fecha) VALUES (${s.id}, ${t.id}, ${sobras[s.id]}, ${fecha})`);
				if (vend > 0) qs.push(sql`INSERT INTO pizza_ventas (sabor_id, turno_id, cantidad_vendida, fecha) VALUES (${s.id}, ${t.id}, ${vend}, ${fecha})`);
			}
			for (const l of cierresLinea) {
				qs.push(sql`INSERT INTO cierres_linea (turno_id, linea_id, producto_id, inicial, sobrantes, mermas, consumidas, venta_esperada, desglose_completo, fecha) VALUES (${t.id}, ${l.c.lineaId}, ${l.c.prodId}, ${l.inicial}, ${l.sobrantes}, ${l.merma}, ${l.consumidas}, ${l.venta}, ${l.completo}, ${fecha})`);
				if (l.completo) {
					for (const [itemId, q] of Object.entries(l.desglose)) {
						const p = l.c.platos.find((x) => x.id === Number(itemId));
						qs.push(sql`INSERT INTO ventas_items (turno_id, item_id, linea_id, cantidad, precio_unitario, costo_unitario, fecha) VALUES (${t.id}, ${p.id}, ${l.c.lineaId}, ${q}, ${p.precio}, ${p.costo}, ${fecha})`);
					}
				}
			}
			if (qs.length) await sql.transaction(qs);

			stock[masaId] = masasSobrantes;
			sobrasPorSabor = sobras;
			const r = (resumenDia[d] ??= { efectivo: 0, nequi: 0, gastos: 0 });
			r.efectivo += efectivo;
			r.nequi += nequi;
			r.gastos += totalGastos;
		}
		save();
		if (turnoN % 20 === 0) process.stdout.write(`  ${d}: ${turnoN} turnos…\n`);
	}

	// Movimientos de inventario (en lotes)
	for (let i = 0; i < movs.length; i += 50) {
		const lote = movs.slice(i, i + 50);
		const rows = await sql.transaction(
			lote.map((mv) => sql`INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, costo_unitario, costo_total, fecha) VALUES (${mv.prodId}, ${gabo?.id ?? null}, ${mv.tipo}, ${mv.cantidad}, ${mv.costoUnit.toFixed(2)}, ${mv.costoTotal.toFixed(2)}, ${mv.fecha}) RETURNING id`)
		);
		m.movimientos.push(...rows.map((r) => r[0].id));
	}
	// Stock y costo promedio finales
	await sql.transaction(Object.entries(stock).map(([id, s]) => sql`UPDATE productos SET stock_actual = ${s}, precio_costo = ${costoAcum[id].toFixed(2)} WHERE id = ${Number(id)}`));
	// Porciones en vitrina para el próximo cierre (si existe producto "Pizza…")
	save();

	// Cierres de caja diarios (todos los días anteriores a hoy)
	const dias = Object.keys(resumenDia).filter((d) => d < HOY);
	for (let i = 0; i < dias.length; i += 50) {
		const rows = await sql.transaction(
			dias.slice(i, i + 50).map((d) => {
				const r = resumenDia[d];
				return sql`INSERT INTO cierres_dia (fecha, total_efectivo, total_transferencias, total_turnos, total_gastos) VALUES (${d + 'T17:00:00'}, ${r.efectivo}, ${r.nequi}, ${r.efectivo}, ${r.gastos}) RETURNING id`;
			})
		);
		m.cierres.push(...rows.map((r) => r[0].id));
	}

	// Cortes semanales (lunes a domingo), hechos el lunes siguiente
	const difs = [0, -6000, 2000, 0, -12000, 0, 3000, -4000, 0, 0];
	let k = 0;
	for (let lunes = '2026-08-31'; addDays(lunes, 6) < HOY; lunes = addDays(lunes, 7)) {
		const domingo = addDays(lunes, 6);
		const desde = lunes < INICIO ? INICIO : lunes;
		const esperado = Object.entries(resumenDia).filter(([d]) => d >= desde && d <= domingo).reduce((a, [, r]) => a + r.efectivo, 0);
		const real = esperado + difs[k++ % difs.length];
		const [row] = await sql`INSERT INTO cortes_semanales (fecha_corte, total_calculado, total_real, efectivo_real, diferencia, rango_inicio, rango_fin) VALUES (${co(addDays(domingo, 1), 10)}, ${esperado}, ${real}, ${real}, ${real - esperado}, ${jornada(desde)}, ${jornada(addDays(domingo, 1))}) RETURNING id`;
		m.cortes.push(row.id);
	}

	save();

	console.log(`\nListo: ${m.turnos.length} turnos (${INICIO} → ${HOY}), ${m.movimientos.length} movimientos de bodega, ${m.cierres.length} cierres de caja, ${m.cortes.length} cortes semanales, ${m.items.length} platos.`);
	console.log('Para borrar todo:  node scripts/demo-data.mjs --remove');
}

(process.argv.includes('--remove') ? remove() : insert()).catch((e) => {
	console.error('Error:', e);
	process.exit(1);
});
