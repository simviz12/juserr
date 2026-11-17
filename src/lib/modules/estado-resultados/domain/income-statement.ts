/**
 * Estado de Resultados (Pérdidas y Ganancias) — lógica contable pura.
 * No conoce Drizzle, SvelteKit ni el DOM: recibe movimientos ya leídos y arma
 * la cascada. Todos los importes van en CENTAVOS enteros (ver ./money).
 */
import { ratio, sumCents } from '$lib/features/finance/domain/money';

// ── Catálogo contable ────────────────────────────────────────────────

/** Sección de la cascada a la que pertenece una categoría de gasto. */
export type SeccionGasto = 'costo' | 'operacional' | 'no_operacional' | 'impuestos';

export interface CategoriaGasto {
	codigo: string;
	nombre: string;
	seccion: SeccionGasto;
	/** Palabras del concepto que identifican la categoría (sin tildes, minúsculas). */
	claves: readonly string[];
}

export const CATEGORIA_POR_DEFECTO = 'otros';

/**
 * El orden importa: la clasificación automática devuelve la primera categoría
 * que coincide, así que van primero las más específicas.
 */
export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = [
	{
		codigo: 'impuestos',
		nombre: 'Impuestos y provisiones fiscales',
		seccion: 'impuestos',
		claves: [
			'impuesto',
			'iva',
			'ica',
			'dian',
			'retencion',
			'retefuente',
			'impoconsumo',
			'industria y comercio',
			'predial'
		]
	},
	{
		codigo: 'financieros',
		nombre: 'Gastos financieros y bancarios',
		seccion: 'no_operacional',
		claves: [
			'interes',
			'intereses',
			'comision',
			'banco',
			'bancaria',
			'bancario',
			'4x1000',
			'datafono',
			'prestamo',
			'credito',
			'cuota',
			'gota'
		]
	},
	{
		codigo: 'otros_egresos',
		nombre: 'Otros egresos extraordinarios',
		seccion: 'no_operacional',
		claves: ['multa', 'sancion', 'robo', 'perdida', 'donacion']
	},
	{
		codigo: 'nomina',
		nombre: 'Nómina y personal',
		seccion: 'operacional',
		claves: [
			'nomina',
			'sueldo',
			'salario',
			'pago turno',
			'empleado',
			'ayudante',
			'mesero',
			'cocinero',
			'jornal',
			'liquidacion',
			'seguridad social',
			'eps',
			'pension',
			'arl',
			'almuerzo personal'
		]
	},
	{
		codigo: 'arriendo',
		nombre: 'Arriendos',
		seccion: 'operacional',
		claves: ['arriendo', 'alquiler', 'canon', 'administracion local']
	},
	{
		codigo: 'servicios',
		nombre: 'Servicios públicos',
		seccion: 'operacional',
		claves: [
			'luz',
			'energia',
			'agua',
			'acueducto',
			'gas',
			'pipeta',
			'internet',
			'telefono',
			'celular',
			'recarga',
			'servicio',
			'servicios'
		]
	},
	{
		codigo: 'insumos',
		nombre: 'Insumos pagados por caja',
		seccion: 'costo',
		claves: [
			'hielo',
			'insumo',
			'carne',
			'pollo',
			'pan',
			'queso',
			'verdura',
			'tomate',
			'cebolla',
			'papa',
			'salsa',
			'harina',
			'aceite',
			'carbon',
			'gaseosa',
			'bebida',
			'masa',
			'huevo',
			'leche',
			'jamon',
			'tocineta',
			'mercado',
			'plaza'
		]
	},
	{
		codigo: 'ventas',
		nombre: 'Ventas y domicilios',
		seccion: 'operacional',
		claves: [
			'domicilio',
			'domiciliario',
			'publicidad',
			'volante',
			'pauta',
			'empaque',
			'desechable',
			'servilleta',
			'bolsa',
			'caja',
			'icopor',
			'rappi',
			'didi'
		]
	},
	{
		codigo: 'mantenimiento',
		nombre: 'Mantenimiento y reparaciones',
		seccion: 'operacional',
		claves: ['mantenimiento', 'reparacion', 'arreglo', 'repuesto', 'tecnico', 'fumigacion']
	},
	{
		codigo: 'transporte',
		nombre: 'Transporte',
		seccion: 'operacional',
		claves: ['transporte', 'taxi', 'gasolina', 'flete', 'acarreo', 'parqueadero', 'pasaje']
	},
	{
		codigo: 'administrativos',
		nombre: 'Administrativos',
		seccion: 'operacional',
		claves: [
			'papeleria',
			'contador',
			'contabilidad',
			'aseo',
			'jabon',
			'suscripcion',
			'software',
			'licencia',
			'tramite',
			'camara de comercio',
			'oficina'
		]
	},
	{
		codigo: CATEGORIA_POR_DEFECTO,
		nombre: 'Otros gastos operacionales',
		seccion: 'operacional',
		claves: []
	}
];

const CATEGORIA_INDEX = new Map(CATEGORIAS_GASTO.map((c) => [c.codigo, c]));

export function esCategoriaGasto(codigo: unknown): codigo is string {
	return typeof codigo === 'string' && CATEGORIA_INDEX.has(codigo);
}

export function categoriaGasto(codigo: string): CategoriaGasto {
	return CATEGORIA_INDEX.get(codigo) ?? CATEGORIA_INDEX.get(CATEGORIA_POR_DEFECTO)!;
}

function normalizar(texto: string): string {
	return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Sugiere la categoría de un gasto a partir de su concepto ("Pago arriendo local"
 * → arriendo). Compara por palabra completa (con plural) para no confundir
 * "gas" con "gaseosa". Sin coincidencias => "otros".
 */
export function clasificarGasto(descripcion: string): string {
	const texto = normalizar(descripcion);
	const palabras = new Set(texto.split(/[^a-z0-9]+/).filter(Boolean));
	const coincide = (clave: string) =>
		clave.includes(' ')
			? texto.includes(clave)
			: palabras.has(clave) || palabras.has(clave + 's') || palabras.has(clave + 'es');
	return CATEGORIAS_GASTO.find((c) => c.claves.some(coincide))?.codigo ?? CATEGORIA_POR_DEFECTO;
}

/** Categoría efectiva: la asignada a mano si es válida; si no, la sugerida por el concepto. */
export function resolverCategoria(
	asignada: string | null | undefined,
	descripcion: string
): string {
	return esCategoriaGasto(asignada) ? asignada : clasificarGasto(descripcion);
}

// ── Movimientos contables manuales ───────────────────────────────────

export const TIPOS_MOVIMIENTO = ['devolucion', 'descuento', 'otro_ingreso', 'gasto'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
	devolucion: 'Devolución en ventas',
	descuento: 'Descuento en ventas',
	otro_ingreso: 'Otro ingreso no operacional',
	gasto: 'Gasto, costo o impuesto'
};

export function esTipoMovimiento(value: unknown): value is TipoMovimiento {
	return typeof value === 'string' && (TIPOS_MOVIMIENTO as readonly string[]).includes(value);
}

// ── Entradas ─────────────────────────────────────────────────────────

/** De qué tabla sale un movimiento (define qué acciones admite en el desglose). */
export type OrigenMovimiento = 'turno' | 'compra' | 'gasto' | 'ajuste';

export interface Movimiento {
	/** Único dentro del informe, p. ej. "gasto-12". */
	id: string;
	origen: OrigenMovimiento;
	/** Id del registro en su tabla de origen. */
	refId: number;
	/** ISO 8601 o null si el registro no tiene fecha. */
	fecha: string | null;
	concepto: string;
	detalle?: string;
	/** Importe en centavos, siempre positivo. */
	cents: number;
	/** Solo turnos: desglose por medio de pago (centavos). */
	efectivoCents?: number;
	transferenciasCents?: number;
	/** Solo compras de Bodega: cantidad y unidad compradas. */
	cantidad?: number;
	unidad?: string;
}

export interface MovimientoGasto extends Movimiento {
	/** Código de CATEGORIAS_GASTO ya resuelto. */
	categoria: string;
	/** true si la categoría la dedujo el sistema por el concepto. */
	automatica: boolean;
}

export interface StatementInput {
	/** Ventas de los turnos cerrados (efectivo + transferencias). */
	ventas: readonly Movimiento[];
	devoluciones: readonly Movimiento[];
	descuentos: readonly Movimiento[];
	/** Compras de insumos registradas en Bodega. */
	compras: readonly Movimiento[];
	/** Gastos de caja + gastos manuales, cada uno con su categoría. */
	gastos: readonly MovimientoGasto[];
	otrosIngresos: readonly Movimiento[];
}

// ── Salida ───────────────────────────────────────────────────────────

/**
 * - `ingreso` / `deduccion`: partidas (importe positivo; la deducción resta).
 * - `subtotal` / `total`: resultados de la cascada (importe con signo).
 */
export type TipoLinea = 'ingreso' | 'deduccion' | 'subtotal' | 'total';

export interface StatementLine {
	id: string;
	label: string;
	tipo: TipoLinea;
	/** 0 = línea principal, 1 = categoría dentro de la línea anterior. */
	nivel: 0 | 1;
	cents: number;
	/** Margen sobre ingresos netos (solo en utilidades). */
	margen?: number | null;
	/** Registros que suman el importe (solo en líneas sin hijos). */
	movimientos: Movimiento[];
	/** Ids de las líneas de nivel 1 que componen esta. */
	hijos: string[];
}

export interface StatementTotals {
	ingresosOperacionales: number;
	devolucionesDescuentos: number;
	ingresosNetos: number;
	costoVentas: number;
	utilidadBruta: number;
	gastosOperacionales: number;
	utilidadOperacional: number;
	otrosIngresos: number;
	otrosEgresos: number;
	utilidadAntesImpuestos: number;
	impuestos: number;
	utilidadNeta: number;
	/** Ingresos netos + otros ingresos (tarjeta "Ingresos totales"). */
	ingresosTotales: number;
	/** Costo de ventas + gastos operacionales + otros egresos + impuestos. */
	costosGastosTotales: number;
}

export interface Statement {
	lineas: StatementLine[];
	totales: StatementTotals;
	margenes: { bruto: number | null; operacional: number | null; neto: number | null };
	/** Cantidad de registros que componen el informe. */
	movimientos: number;
}

const total = (rows: readonly Movimiento[]) => sumCents(rows, (m) => m.cents);

/** Más recientes primero; los registros sin fecha al final. */
function porFecha(rows: readonly Movimiento[]): Movimiento[] {
	return [...rows].sort(
		(a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || a.id.localeCompare(b.id)
	);
}

function partida(
	id: string,
	label: string,
	tipo: 'ingreso' | 'deduccion',
	movimientos: readonly Movimiento[],
	nivel: 0 | 1 = 0
): StatementLine {
	return {
		id,
		label,
		tipo,
		nivel,
		cents: total(movimientos),
		movimientos: porFecha(movimientos),
		hijos: []
	};
}

function resultado(
	id: string,
	label: string,
	cents: number,
	margen?: number | null,
	tipo: 'subtotal' | 'total' = 'subtotal'
): StatementLine {
	return { id, label, tipo, nivel: 0, cents, margen, movimientos: [], hijos: [] };
}

/**
 * Línea agrupadora + una sublínea por categoría (solo las que tienen movimientos,
 * de mayor a menor importe).
 */
function grupo(
	id: string,
	label: string,
	tipo: 'ingreso' | 'deduccion',
	partes: { id: string; label: string; movimientos: readonly Movimiento[] }[]
): StatementLine[] {
	const hijos = partes
		.filter((p) => p.movimientos.length > 0)
		.map((p) => partida(`${id}.${p.id}`, p.label, tipo, p.movimientos, 1))
		.sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
	const cabeza: StatementLine = {
		id,
		label,
		tipo,
		nivel: 0,
		cents: sumCents(hijos, (h) => h.cents),
		movimientos: [],
		hijos: hijos.map((h) => h.id)
	};
	return [cabeza, ...hijos];
}

function gastosDeSeccion(gastos: readonly MovimientoGasto[], seccion: SeccionGasto) {
	return CATEGORIAS_GASTO.filter((c) => c.seccion === seccion).map((c) => ({
		id: c.codigo,
		label: c.nombre,
		movimientos: gastos.filter((g) => categoriaGasto(g.categoria).codigo === c.codigo)
	}));
}

/**
 * Arma la cascada:
 *   Ingresos operacionales − devoluciones y descuentos = Ingresos netos
 *   − Costo de ventas = Utilidad bruta
 *   − Gastos operacionales = Utilidad operacional
 *   + Otros ingresos − Otros egresos = Utilidad antes de impuestos
 *   − Impuestos = Utilidad (o pérdida) neta
 */
export function buildStatement(input: StatementInput): Statement {
	const ingresos = partida(
		'ingresos_operacionales',
		'Ingresos operacionales',
		'ingreso',
		input.ventas
	);
	const deducciones = grupo(
		'devoluciones_descuentos',
		'Devoluciones y descuentos en ventas',
		'deduccion',
		[
			{ id: 'devoluciones', label: 'Devoluciones en ventas', movimientos: input.devoluciones },
			{ id: 'descuentos', label: 'Descuentos en ventas', movimientos: input.descuentos }
		]
	);
	const costo = grupo('costo_ventas', 'Costo de ventas', 'deduccion', [
		{ id: 'compras', label: 'Compras de insumos (Bodega)', movimientos: input.compras },
		...gastosDeSeccion(input.gastos, 'costo')
	]);
	const operacionales = grupo(
		'gastos_operacionales',
		'Gastos operacionales',
		'deduccion',
		gastosDeSeccion(input.gastos, 'operacional')
	);
	const otrosIngresos = partida(
		'otros_ingresos',
		'Otros ingresos no operacionales',
		'ingreso',
		input.otrosIngresos
	);
	const otrosEgresos = grupo(
		'otros_egresos',
		'Otros egresos no operacionales',
		'deduccion',
		gastosDeSeccion(input.gastos, 'no_operacional')
	);
	const impuestos = grupo(
		'impuestos',
		'Impuestos y provisiones fiscales',
		'deduccion',
		gastosDeSeccion(input.gastos, 'impuestos')
	);

	const ingresosNetos = ingresos.cents - deducciones[0].cents;
	const utilidadBruta = ingresosNetos - costo[0].cents;
	const utilidadOperacional = utilidadBruta - operacionales[0].cents;
	const utilidadAntesImpuestos = utilidadOperacional + otrosIngresos.cents - otrosEgresos[0].cents;
	const utilidadNeta = utilidadAntesImpuestos - impuestos[0].cents;

	const margenes = {
		bruto: ratio(utilidadBruta, ingresosNetos),
		operacional: ratio(utilidadOperacional, ingresosNetos),
		neto: ratio(utilidadNeta, ingresosNetos)
	};

	const lineas: StatementLine[] = [
		ingresos,
		...deducciones,
		resultado('ingresos_netos', 'Ingresos netos', ingresosNetos),
		...costo,
		resultado('utilidad_bruta', 'Utilidad bruta', utilidadBruta, margenes.bruto),
		...operacionales,
		resultado(
			'utilidad_operacional',
			'Utilidad operacional',
			utilidadOperacional,
			margenes.operacional
		),
		otrosIngresos,
		...otrosEgresos,
		resultado('utilidad_antes_impuestos', 'Utilidad antes de impuestos', utilidadAntesImpuestos),
		...impuestos,
		resultado(
			'utilidad_neta',
			utilidadNeta < 0 ? 'Pérdida neta del periodo' : 'Utilidad neta del periodo',
			utilidadNeta,
			margenes.neto,
			'total'
		)
	];

	return {
		lineas,
		totales: {
			ingresosOperacionales: ingresos.cents,
			devolucionesDescuentos: deducciones[0].cents,
			ingresosNetos,
			costoVentas: costo[0].cents,
			utilidadBruta,
			gastosOperacionales: operacionales[0].cents,
			utilidadOperacional,
			otrosIngresos: otrosIngresos.cents,
			otrosEgresos: otrosEgresos[0].cents,
			utilidadAntesImpuestos,
			impuestos: impuestos[0].cents,
			utilidadNeta,
			ingresosTotales: ingresosNetos + otrosIngresos.cents,
			costosGastosTotales:
				costo[0].cents + operacionales[0].cents + otrosEgresos[0].cents + impuestos[0].cents
		},
		margenes,
		movimientos:
			input.ventas.length +
			input.devoluciones.length +
			input.descuentos.length +
			input.compras.length +
			input.gastos.length +
			input.otrosIngresos.length
	};
}

/** Movimientos de una línea; si agrupa categorías, los de todas ellas. */
export function movimientosDeLinea(statement: Statement, lineaId: string): Movimiento[] {
	const linea = statement.lineas.find((l) => l.id === lineaId);
	if (!linea) return [];
	if (linea.hijos.length === 0) return linea.movimientos;
	const hijos = new Set(linea.hijos);
	return porFecha(statement.lineas.filter((l) => hijos.has(l.id)).flatMap((l) => l.movimientos));
}

// ── Comparativo entre periodos ───────────────────────────────────────

export interface Variacion {
	/** Importe del periodo de comparación, en centavos. */
	anterior: number;
	/** Diferencia en dinero (actual − anterior), en centavos. */
	diferencia: number;
	/** Variación relativa (0.12 = +12 %). null si el periodo anterior fue 0. */
	pct: number | null;
}

export function variacion(actual: number, anterior: number): Variacion {
	const diferencia = actual - anterior;
	return { anterior, diferencia, pct: anterior === 0 ? null : diferencia / Math.abs(anterior) };
}

/**
 * Variación de cada línea del periodo actual contra el de comparación.
 * Una categoría que no existía antes se compara contra 0.
 */
export function compararStatements(
	actual: Statement,
	anterior: Statement
): Record<string, Variacion> {
	const previo = new Map(anterior.lineas.map((l) => [l.id, l.cents]));
	return Object.fromEntries(
		actual.lineas.map((l) => [l.id, variacion(l.cents, previo.get(l.id) ?? 0)])
	);
}

/**
 * ¿Un aumento de esta línea es buena noticia? Sirve para colorear la variación:
 * que suban los gastos es malo aunque el número sea "positivo".
 */
export function aumentoEsFavorable(tipo: TipoLinea): boolean {
	return tipo !== 'deduccion';
}
