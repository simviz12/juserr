<script lang="ts">
	import { gotoWithQuery } from '$lib/utils/navigation';
	import { enhance } from '$app/forms';
	import { navigating } from '$app/state';
	import {
		CalendarRange,
		ChevronRight,
		CircleDollarSign,
		FileDown,
		FileSpreadsheet,
		FileText,
		LoaderCircle,
		Percent,
		Plus,
		ReceiptText,
		TrendingDown,
		TrendingUp,
		Wallet
	} from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import IncomeStatementChart from '$lib/modules/estado-resultados/components/IncomeStatementChart.svelte';
	import StatementMovements from '$lib/modules/estado-resultados/components/StatementMovements.svelte';
	import { btn, inputClass, selectClass } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatPct } from '$lib/utils/format';
	import { exportCsv, exportExcel, safeFileName } from '$lib/utils/export';
	import { fromCents, ratio } from '$lib/features/finance/domain/money';
	import {
		TIPOS_MOVIMIENTO,
		TIPO_MOVIMIENTO_LABELS,
		aumentoEsFavorable,
		variacion,
		type StatementLine,
		type TipoMovimiento,
		type Variacion
	} from '$lib/modules/estado-resultados/domain/income-statement';
	import {
		COMPARACIONES,
		COMPARACION_LABELS,
		PRESETS,
		PRESET_LABELS,
		diasDelRango,
		presetActivo,
		presetRange,
		type Comparacion,
		type KeyRange,
		type Preset
	} from '$lib/modules/estado-resultados/domain/statement-period';

	let { data, form } = $props();

	const RUTA = '/finanzas/estado-resultados';
	const money = (cents: number) => formatCOP(fromCents(cents));

	let loading = $derived(navigating.to?.url.pathname === RUTA);
	let st = $derived(data.statement);
	let t = $derived(st.totales);
	let cmp = $derived(data.comparativo);
	let hayPerdida = $derived(t.utilidadNeta < 0);

	// ── Periodo ─────────────────────────────────────────────
	const fechaLarga = new Intl.DateTimeFormat('es-CO', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const dia = (key: string) => fechaLarga.format(new Date(key + 'T12:00:00Z'));
	/** YYYY-MM-DD en hora de Colombia (para Excel/CSV). */
	const fechaColombia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
	const rangoLabel = (r: KeyRange) =>
		r.inicio === r.fin ? dia(r.inicio) : `${dia(r.inicio)} – ${dia(r.fin)}`;

	let inicio = $derived(data.rango.inicio);
	let fin = $derived(data.rango.fin);
	let periodo = $derived(rangoLabel(data.rango));
	let periodoComparado = $derived(cmp ? rangoLabel(cmp.rango) : null);
	let preset = $derived(presetActivo(data.rango, data.hoy));
	let query = $derived(
		new URLSearchParams({
			inicio: data.rango.inicio,
			fin: data.rango.fin,
			comparar: data.modo
		}).toString()
	);

	function ir(r: KeyRange, comparar: Comparacion = data.modo) {
		gotoWithQuery({ inicio: r.inicio, fin: r.fin, comparar });
	}
	const aplicar = () => inicio && fin && ir({ inicio, fin });
	const usarPreset = (p: Preset) => ir(presetRange(p, data.hoy));

	// ── Cascada y desglose ──────────────────────────────────
	const PREFIJO = { ingreso: '+', deduccion: '−', subtotal: '=', total: '=' } as const;
	const MARGEN_LABEL: Record<string, string> = {
		utilidad_bruta: 'Margen bruto',
		utilidad_operacional: 'Margen operacional',
		utilidad_neta: 'Margen neto'
	};

	/** Grupos plegados (por defecto abiertos) y partidas con el detalle desplegado. */
	let plegados = $state<Record<string, boolean>>({});
	let abiertas = $state<Record<string, boolean>>({});

	let padreDe = $derived(new Map(st.lineas.flatMap((l) => l.hijos.map((h) => [h, l.id] as const))));
	let lineasVisibles = $derived(
		st.lineas.filter((l) => l.nivel === 0 || !plegados[padreDe.get(l.id) ?? ''])
	);

	const esGrupo = (l: StatementLine) => l.hijos.length > 0;
	const desplegable = (l: StatementLine) => esGrupo(l) || l.movimientos.length > 0;
	const expandida = (l: StatementLine) => (esGrupo(l) ? !plegados[l.id] : !!abiertas[l.id]);
	function alternar(l: StatementLine) {
		if (esGrupo(l)) plegados[l.id] = !plegados[l.id];
		else abiertas[l.id] = !abiertas[l.id];
	}
	const esResultado = (l: StatementLine) => l.tipo === 'subtotal' || l.tipo === 'total';
	const participacion = (l: StatementLine) => ratio(l.cents, t.ingresosNetos);

	// ── Comparativo ─────────────────────────────────────────
	const signo = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
	const difMoney = (v: Variacion) =>
		v.diferencia === 0 ? '—' : `${signo(v.diferencia)}${money(Math.abs(v.diferencia))}`;
	const difPct = (v: Variacion) => {
		if (v.pct === null) return v.diferencia === 0 ? '—' : 'Nuevo';
		return v.diferencia === 0 ? '0%' : `${signo(v.pct)}${formatPct(Math.abs(v.pct))}`;
	};
	function tono(v: Variacion, favorableAlSubir: boolean): string {
		if (v.diferencia === 0) return 'text-muted-foreground';
		return v.diferencia > 0 === favorableAlSubir ? 'text-success' : 'text-danger';
	}
	/** Texto de variación para las tarjetas ("+12,5% vs. periodo anterior"). */
	function pista(actual: number, anterior: number | undefined): string | undefined {
		if (!cmp || anterior === undefined) return undefined;
		return `${difPct(variacion(actual, anterior))} vs. ${COMPARACION_LABELS[cmp.modo].toLowerCase()}`;
	}
	let pistaMargen = $derived.by(() => {
		if (!cmp || st.margenes.neto === null || cmp.margenes.neto === null) return undefined;
		const pp = (st.margenes.neto - cmp.margenes.neto) * 100;
		return `${signo(pp)}${Math.abs(pp).toFixed(1).replace('.', ',')} pp vs. ${COMPARACION_LABELS[cmp.modo].toLowerCase()}`;
	});

	// ── Gráfico ─────────────────────────────────────────────
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chartData = $derived(
		(
			[
				['Ingresos netos', 'ingresosNetos'],
				['Costo de ventas', 'costoVentas'],
				['Gastos operacionales', 'gastosOperacionales'],
				['Utilidad neta', 'utilidadNeta']
			] as const
		).map(([label, key]) => ({
			label,
			actual: fromCents(t[key]),
			anterior: cmp ? fromCents(cmp.totales[key]) : null
		}))
	);

	// ── Registro de movimientos manuales ────────────────────
	const SECCIONES = [
		{ id: 'operacional', label: 'Gastos operacionales' },
		{ id: 'costo', label: 'Costo de ventas' },
		{ id: 'no_operacional', label: 'Egresos no operacionales' },
		{ id: 'impuestos', label: 'Impuestos' }
	];
	let dialogo = $state(false);
	let guardando = $state(false);
	let nuevo = $state({
		tipo: 'gasto' as TipoMovimiento,
		categoria: '',
		descripcion: '',
		monto: '',
		fecha: ''
	});

	function abrirRegistro() {
		nuevo = {
			tipo: 'gasto',
			categoria: '',
			descripcion: '',
			monto: '',
			fecha: data.rango.fin > data.hoy ? data.hoy : data.rango.fin
		};
		dialogo = true;
	}

	// ── Exportaciones ───────────────────────────────────────
	let busy = $state<'pdf' | 'xlsx' | 'csv' | null>(null);
	let exportMsg = $state('');
	let baseName = $derived(
		safeFileName(`${data.negocio}_Estado_de_Resultados_${data.rango.inicio}_a_${data.rango.fin}`)
	);
	const etiqueta = (l: StatementLine) =>
		l.nivel === 1 ? `    ${l.label}` : `(${PREFIJO[l.tipo]}) ${l.label}`;
	const pctNum = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 100);

	/** Filas del informe para Excel/CSV (importes en pesos, porcentajes en puntos). */
	function filasInforme() {
		return st.lineas.map((l) => {
			const v = cmp?.variaciones[l.id];
			return {
				Concepto: etiqueta(l),
				[`Periodo (${periodo})`]: fromCents(l.cents),
				'% sobre ingresos netos': pctNum(participacion(l)),
				...(v && periodoComparado
					? {
							[`Comparativo (${periodoComparado})`]: fromCents(v.anterior),
							'Diferencia $': fromCents(v.diferencia),
							'Variación %': pctNum(v.pct)
						}
					: {})
			};
		});
	}
	function filasDetalle() {
		return st.lineas.flatMap((l) =>
			l.movimientos.map((m) => ({
				Línea:
					(l.nivel === 1 ? `${st.lineas.find((p) => p.id === padreDe.get(l.id))?.label} › ` : '') +
					l.label,
				// Fecha en hora de Colombia (antes, en UTC, un turno nocturno salía al día siguiente)
				Fecha: m.fecha ? fechaColombia.format(new Date(m.fecha)) : '',
				Concepto: m.concepto,
				Detalle: m.detalle ?? '',
				Monto: fromCents(m.cents)
			}))
		);
	}

	async function exportar(tipo: 'pdf' | 'xlsx' | 'csv') {
		busy = tipo;
		exportMsg = '';
		try {
			if (tipo === 'csv') exportCsv(baseName, filasInforme());
			else if (tipo === 'xlsx') {
				await exportExcel(baseName, [
					{ name: 'Estado de resultados', rows: filasInforme() },
					{ name: 'Detalle de movimientos', rows: filasDetalle() }
				]);
			} else await pdf();
		} catch (e) {
			console.error('Error al exportar el estado de resultados', e);
			exportMsg = 'No se pudo generar el archivo. Intenta de nuevo.';
		} finally {
			busy = null;
		}
	}

	/** El PDF incluye el anexo de detalle solo si es breve; un informe para presentar no lleva cientos de filas. */
	const DETALLE_PDF_MAX = 150;

	/** PDF con formato de estado financiero (distinto del de los reportes de caja). */
	async function pdf() {
		const { downloadStatementPdf } =
			await import('$lib/modules/estado-resultados/reports/statement-pdf');
		await downloadStatementPdf({
			fileName: baseName,
			negocio: data.negocio,
			periodo,
			statement: st,
			comparativo:
				cmp && periodoComparado
					? {
							etiqueta: COMPARACION_LABELS[cmp.modo],
							periodo: periodoComparado,
							totales: cmp.totales,
							margenes: cmp.margenes,
							variaciones: cmp.variaciones
						}
					: null,
			detalleMax: DETALLE_PDF_MAX
		});
	}
</script>

<svelte:head><title>Estado de resultados · MesaCapital</title></svelte:head>

<div class="flex flex-col gap-6">
	<!-- Filtros de tiempo + acciones -->
	<div class="flex flex-col gap-3">
		<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
			<div class="flex flex-wrap items-end gap-2">
				<div
					class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 shadow-sm sm:w-auto"
				>
					<CalendarRange size={15} class="shrink-0 text-muted-foreground" />
					<input
						type="date"
						bind:value={inicio}
						max={data.hoy}
						aria-label="Fecha de inicio"
						class="min-w-0 flex-1 bg-transparent text-[13px] outline-none dark:[color-scheme:dark]"
					/>
					<span class="text-muted-foreground">–</span>
					<input
						type="date"
						bind:value={fin}
						aria-label="Fecha de fin"
						class="min-w-0 flex-1 bg-transparent text-[13px] outline-none dark:[color-scheme:dark]"
					/>
				</div>
				<button
					type="button"
					class={cn(btn.base, btn.primary)}
					onclick={aplicar}
					disabled={!inicio || !fin || (inicio === data.rango.inicio && fin === data.rango.fin)}
					>Aplicar</button
				>
			</div>
			<div class="flex flex-wrap gap-2">
				<button type="button" class={cn(btn.base, btn.outline)} onclick={abrirRegistro}
					><Plus size={15} /> Registrar movimiento</button
				>
				<button
					type="button"
					class={cn(btn.base, btn.outline)}
					onclick={() => exportar('csv')}
					disabled={busy !== null || st.movimientos === 0}
				>
					{#if busy === 'csv'}<LoaderCircle size={15} class="animate-spin" />{:else}<FileDown
							size={15}
						/>{/if} CSV
				</button>
				<button
					type="button"
					class={cn(btn.base, btn.outline)}
					onclick={() => exportar('xlsx')}
					disabled={busy !== null || st.movimientos === 0}
				>
					{#if busy === 'xlsx'}<LoaderCircle
							size={15}
							class="animate-spin"
						/>{:else}<FileSpreadsheet size={15} />{/if} Excel
				</button>
				<button
					type="button"
					class={cn(btn.base, btn.primary)}
					onclick={() => exportar('pdf')}
					disabled={busy !== null || st.movimientos === 0}
				>
					{#if busy === 'pdf'}<LoaderCircle size={15} class="animate-spin" />{:else}<FileText
							size={15}
						/>{/if} PDF
				</button>
			</div>
		</div>

		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex flex-wrap gap-1" role="group" aria-label="Accesos rápidos de periodo">
				{#each PRESETS as p (p)}
					<button
						type="button"
						aria-pressed={preset === p}
						class={cn(
							btn.base,
							btn.sm,
							preset === p
								? 'bg-accent text-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-foreground'
						)}
						onclick={() => usarPreset(p)}
					>
						{PRESET_LABELS[p]}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-[13px] text-muted-foreground">Comparar con</span>
				<SegmentedControl
					label="Periodo de comparación"
					value={data.modo}
					onchange={(v) => ir(data.rango, v)}
					options={COMPARACIONES.map((c) => ({ value: c, label: COMPARACION_LABELS[c] }))}
				/>
			</div>
		</div>
		{#if exportMsg}<p class="text-sm text-danger" role="alert">{exportMsg}</p>{/if}
	</div>

	{#if !dialogo}<FormFeedback {form} />{/if}

	{#if st.movimientos === 0 && !loading}
		<Card>
			<EmptyState
				icon={ReceiptText}
				title="Sin movimientos en este periodo"
				description="Elige otro rango de fechas, registra cierres de turno o agrega un movimiento manual para ver el estado de resultados."
			/>
		</Card>
	{:else}
		<!-- KPIs -->
		<section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores del periodo">
			{#if loading}
				{#each { length: 4 }, i (i)}<Skeleton class="h-[92px]" />{/each}
			{:else}
				<StatTile
					label="Ingresos totales"
					value={money(t.ingresosTotales)}
					icon={Wallet}
					hint={pista(t.ingresosTotales, cmp?.totales.ingresosTotales) ??
						`${diasDelRango(data.rango)} día(s)`}
				/>
				<StatTile
					label="Costos y gastos totales"
					value={money(t.costosGastosTotales)}
					icon={CircleDollarSign}
					hint={pista(t.costosGastosTotales, cmp?.totales.costosGastosTotales)}
				/>
				<StatTile
					label={hayPerdida ? 'Pérdida neta' : 'Utilidad neta'}
					value={money(t.utilidadNeta)}
					icon={hayPerdida ? TrendingDown : TrendingUp}
					hint={pista(t.utilidadNeta, cmp?.totales.utilidadNeta)}
					tone={hayPerdida ? 'danger' : 'success'}
					class={hayPerdida
						? 'border-danger/40 bg-danger-soft'
						: 'border-success/40 bg-success-soft'}
				/>
				<StatTile
					label="Margen neto"
					value={formatPct(st.margenes.neto)}
					icon={Percent}
					hint={pistaMargen}
					tone={st.margenes.neto !== null && st.margenes.neto < 0 ? 'danger' : 'default'}
				/>
			{/if}
		</section>

		<Card
			title="Comparativo del periodo"
			description={periodoComparado ? `${periodo} frente a ${periodoComparado}` : periodo}
		>
			{#if loading}
				<Skeleton class="h-72 w-full" />
			{:else}
				<IncomeStatementChart
					data={chartData}
					actualLabel={periodo}
					anteriorLabel={periodoComparado}
					bind:canvasEl={chartCanvas}
				/>
			{/if}
		</Card>

		<!-- Cascada contable -->
		<Card
			title="Estado de resultados"
			description="Haz clic en una línea para ver los registros que la componen."
		>
			{#if loading}
				<Skeleton class="h-96 w-full" />
			{:else}
				<div class="custom-scrollbar overflow-x-auto rounded-md border border-border">
					<table class="w-full text-sm">
						<thead class="bg-muted/60 text-left text-xs text-muted-foreground">
							<tr>
								<th scope="col" class="h-10 px-3 font-medium">Concepto</th>
								<th scope="col" class="h-10 px-3 text-right font-medium whitespace-nowrap"
									>Periodo</th
								>
								<th
									scope="col"
									class="hidden h-10 px-3 text-right font-medium whitespace-nowrap sm:table-cell"
									>% ingresos</th
								>
								{#if cmp}
									<th
										scope="col"
										class="hidden h-10 px-3 text-right font-medium whitespace-nowrap lg:table-cell"
										>{COMPARACION_LABELS[cmp.modo]}</th
									>
									<th
										scope="col"
										class="hidden h-10 px-3 text-right font-medium whitespace-nowrap md:table-cell"
										>Diferencia</th
									>
									<th
										scope="col"
										class="hidden h-10 px-3 text-right font-medium whitespace-nowrap sm:table-cell"
										>Var.</th
									>
								{/if}
							</tr>
						</thead>
						<tbody class="tabular-nums">
							{#each lineasVisibles as l (l.id)}
								{@const v = cmp?.variaciones[l.id]}
								{@const resultado = esResultado(l)}
								<tr
									class={cn(
										'border-t border-border',
										resultado ? 'bg-muted/40 font-semibold' : 'transition-colors hover:bg-muted/30',
										l.tipo === 'total' && (hayPerdida ? 'bg-danger-soft' : 'bg-success-soft')
									)}
								>
									<th
										scope="row"
										class={cn(
											'px-3 py-2.5 text-left',
											resultado ? 'font-semibold' : 'font-normal',
											l.nivel === 1 && 'pl-6 sm:pl-9'
										)}
									>
										{#if desplegable(l)}
											<button
												type="button"
												class="group flex w-full items-start gap-1.5 text-left"
												aria-expanded={expandida(l)}
												onclick={() => alternar(l)}
											>
												<ChevronRight
													size={15}
													class={cn(
														'mt-0.5 shrink-0 text-muted-foreground transition-transform',
														expandida(l) && 'rotate-90'
													)}
												/>
												<span class="group-hover:underline">
													{#if l.nivel === 0}<span class="text-muted-foreground"
															>({PREFIJO[l.tipo]})</span
														>{/if}
													{l.label}
													{#if !esGrupo(l)}<span
															class="ml-1 text-xs font-normal text-muted-foreground"
															>({l.movimientos.length})</span
														>{/if}
												</span>
											</button>
										{:else}
											<span class="flex items-start gap-1.5">
												<span class="w-[15px] shrink-0"></span>
												<span>
													{#if l.nivel === 0}<span class="font-normal text-muted-foreground"
															>({PREFIJO[l.tipo]})</span
														>{/if}
													{l.label}
													{#if MARGEN_LABEL[l.id]}
														<span class="block text-xs font-normal text-muted-foreground"
															>{MARGEN_LABEL[l.id]}: {formatPct(l.margen ?? null)}</span
														>
													{/if}
												</span>
											</span>
										{/if}
									</th>
									<td
										class={cn(
											'px-3 py-2.5 text-right whitespace-nowrap',
											resultado && l.cents < 0 && 'text-danger',
											l.tipo === 'total' && l.cents >= 0 && 'text-success'
										)}
									>
										{money(l.cents)}
										<!-- En móvil no caben las columnas del comparativo: la variación va bajo el importe -->
										{#if cmp && v}<span
												class={cn(
													'block text-xs font-normal sm:hidden',
													tono(v, aumentoEsFavorable(l.tipo))
												)}>{difPct(v)}</span
											>{/if}
									</td>
									<td
										class="hidden px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground sm:table-cell"
										>{formatPct(participacion(l))}</td
									>
									{#if cmp && v}
										<td
											class="hidden px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground lg:table-cell"
											>{money(v.anterior)}</td
										>
										<td
											class={cn(
												'hidden px-3 py-2.5 text-right whitespace-nowrap md:table-cell',
												tono(v, aumentoEsFavorable(l.tipo))
											)}>{difMoney(v)}</td
										>
										<td
											class={cn(
												'hidden px-3 py-2.5 text-right whitespace-nowrap sm:table-cell',
												tono(v, aumentoEsFavorable(l.tipo))
											)}>{difPct(v)}</td
										>
									{/if}
								</tr>
								{#if !esGrupo(l) && abiertas[l.id] && l.movimientos.length > 0}
									<tr class="border-t border-border bg-muted/20">
										<td
											colspan={cmp ? 6 : 3}
											class={cn('px-3 py-3 font-normal', l.nivel === 1 ? 'sm:pl-9' : 'sm:pl-8')}
										>
											<StatementMovements
												movimientos={l.movimientos}
												categorias={data.categorias}
												catalogo={data.catalogo}
												{query}
											/>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-3 text-xs text-muted-foreground">
					Base caja · jornadas de 04:00 a 04:00. Los porcentajes se calculan sobre los ingresos
					netos. Solo cuentan registros confirmados (los anulados se excluyen).
				</p>
			{/if}
		</Card>
	{/if}
</div>

<Dialog
	bind:open={dialogo}
	title="Registrar movimiento contable"
	description="Para lo que no pasa por la caja del turno: arriendo, nómina, impuestos, devoluciones, otros ingresos…"
>
	<form
		id="form-movimiento"
		method="POST"
		action="?/registrar&{query}"
		class="flex flex-col gap-4"
		use:enhance={() => {
			guardando = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				guardando = false;
				if (result.type === 'success') dialogo = false;
			};
		}}
	>
		{#if form?.error}<FormFeedback {form} />{/if}
		<Field label="Tipo" for="mov-tipo">
			<select id="mov-tipo" name="tipo" bind:value={nuevo.tipo} class={selectClass} required>
				{#each TIPOS_MOVIMIENTO as tipo (tipo)}<option value={tipo}
						>{TIPO_MOVIMIENTO_LABELS[tipo]}</option
					>{/each}
			</select>
		</Field>
		{#if nuevo.tipo === 'gasto'}
			<Field label="Categoría" for="mov-categoria" hint="Define en qué línea del informe aparece.">
				<select
					id="mov-categoria"
					name="categoria"
					bind:value={nuevo.categoria}
					class={selectClass}
					required
				>
					<option value="" disabled>Selecciona una categoría…</option>
					{#each SECCIONES as s (s.id)}
						<optgroup label={s.label}>
							{#each data.catalogo.filter((c) => c.seccion === s.id) as c (c.codigo)}<option
									value={c.codigo}>{c.nombre}</option
								>{/each}
						</optgroup>
					{/each}
				</select>
			</Field>
		{/if}
		<Field label="Concepto" for="mov-descripcion">
			<input
				id="mov-descripcion"
				name="descripcion"
				bind:value={nuevo.descripcion}
				maxlength="200"
				required
				placeholder="Ej. Arriendo del local, noviembre"
				class={inputClass}
			/>
		</Field>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<Field label="Valor (COP)" for="mov-monto">
				<input
					id="mov-monto"
					name="monto"
					bind:value={nuevo.monto}
					inputmode="decimal"
					required
					placeholder="1.200.000"
					autocomplete="off"
					class={cn(inputClass, 'tabular-nums')}
				/>
			</Field>
			<Field label="Fecha" for="mov-fecha">
				<input
					id="mov-fecha"
					name="fecha"
					type="date"
					bind:value={nuevo.fecha}
					max={data.hoy}
					required
					class={inputClass}
				/>
			</Field>
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.ghost)} onclick={() => (dialogo = false)}
			>Cancelar</button
		>
		<button
			type="submit"
			form="form-movimiento"
			class={cn(btn.base, btn.primary)}
			disabled={guardando}
		>
			{#if guardando}<LoaderCircle size={15} class="animate-spin" />{/if} Guardar
		</button>
	{/snippet}
</Dialog>
