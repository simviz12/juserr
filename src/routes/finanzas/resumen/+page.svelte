<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { FileText, FileSpreadsheet, LoaderCircle, Wallet, Banknote, Smartphone, Receipt, ShoppingCart, ChartLine, CalendarRange } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import CashflowChart from '$lib/components/charts/CashflowChart.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate, formatDateTime, formatNumber, formatPct } from '$lib/utils/format';
	import { exportExcel, safeFileName } from '$lib/utils/export';
	import { downloadPdfReport, pdfMoney } from '$lib/features/finance/reports/pdf';
	import { businessDayKey, currentRange } from '$lib/features/finance/domain/period';
	import { foodCostStatus } from '$lib/features/finance/domain/metrics';
	import type { CashflowPoint } from '$lib/features/finance/domain/metrics';

	let { data } = $props();

	let loading = $derived(navigating.to?.url.pathname === '/finanzas/resumen');
	let g = $derived(data.granTotal);
	let margen = $derived(g.ventasBrutas > 0 ? g.utilidadNeta / g.ventasBrutas : null);
	let foodCost = $derived(g.ventasBrutas > 0 ? g.compras / g.ventasBrutas : null);
	const dayLabel = (k: string) => formatDate(k + 'T12:00:00-05:00');

	// ── Filtro de período ───────────────────────────────────
	let inicio = $state('');
	let fin = $state('');
	$effect.pre(() => {
		inicio = data.inicio;
		fin = data.fin;
	});
	function aplicar(i = inicio, f = fin) {
		goto(`?inicio=${i}&fin=${f}`, { keepFocus: true, noScroll: true });
	}
	function preset(p: 'mes' | 'anterior' | '7' | '30') {
		const hoy = businessDayKey(new Date());
		const shift = (k: string, d: number) => {
			const x = new Date(k + 'T12:00:00Z');
			x.setUTCDate(x.getUTCDate() + d);
			return x.toISOString().slice(0, 10);
		};
		if (p === 'mes') {
			const r = currentRange('mensual');
			aplicar(businessDayKey(r.start), businessDayKey(new Date(r.end.getTime() - 1)));
		} else if (p === 'anterior') {
			const r = currentRange('mensual', shift(businessDayKey(currentRange('mensual').start), -1));
			aplicar(businessDayKey(r.start), businessDayKey(new Date(r.end.getTime() - 1)));
		} else aplicar(shift(hoy, -(Number(p) - 1)), hoy);
	}

	// ── Gráfico ─────────────────────────────────────────────
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let serie = $derived<CashflowPoint[]>(
		[...data.historialDias]
			.sort((a, b) => a.fecha.localeCompare(b.fecha))
			.map((d) => ({
				key: d.fecha,
				label: dayLabel(d.fecha),
				efectivo: d.efectivo,
				transferencias: d.transferencias,
				gastos: d.gastos,
				neto: d.ventasBrutas - d.gastos,
				future: false
			}))
	);

	// ── Tablas ──────────────────────────────────────────────
	let vista = $state<'dias' | 'semanas' | 'turnos' | 'gastos' | 'compras'>('dias');
	type Dia = (typeof data.historialDias)[number];
	type Semana = (typeof data.semanas)[number];
	type Turno = (typeof data.turnosDetallados)[number];
	type Gasto = (typeof data.listaGastos)[number];
	type Compra = (typeof data.compras)[number];
	const money = (v: string | number | null) => formatCOP(Number(v ?? 0));

	const diaCols: Column<Dia>[] = [
		{ id: 'fecha', header: 'Día', accessor: (d) => d.fecha, format: (v) => dayLabel(String(v)) },
		{ id: 'turnos', header: 'Turnos', accessor: (d) => d.turnos, align: 'right', hideOnMobile: true },
		{ id: 'efectivo', header: 'Efectivo', accessor: (d) => d.efectivo, format: money, align: 'right', hideOnMobile: true },
		{ id: 'nequi', header: 'Nequi', accessor: (d) => d.transferencias, format: money, align: 'right', hideOnMobile: true },
		{ id: 'ventas', header: 'Ventas', accessor: (d) => d.ventasBrutas, format: money, align: 'right' },
		{ id: 'gastos', header: 'Gastos', accessor: (d) => d.gastos, format: money, align: 'right', hideOnMobile: true },
		{ id: 'compras', header: 'Compras', accessor: (d) => d.compras, format: money, align: 'right', hideOnMobile: true },
		{ id: 'neto', header: 'Utilidad', accessor: (d) => d.utilidadNeta, format: money, align: 'right' }
	];
	const semCols: Column<Semana>[] = [
		{ id: 'lunes', header: 'Semana del', accessor: (s) => s.lunes, format: (v) => dayLabel(String(v)) },
		{ id: 'dias', header: 'Días con venta', accessor: (s) => s.diasContados, align: 'right', hideOnMobile: true },
		{ id: 'ventas', header: 'Ventas', accessor: (s) => s.ventasBrutas, format: money, align: 'right' },
		{ id: 'gastos', header: 'Gastos', accessor: (s) => s.gastos, format: money, align: 'right' },
		{ id: 'compras', header: 'Compras', accessor: (s) => s.compras, format: money, align: 'right', hideOnMobile: true },
		{ id: 'neto', header: 'Utilidad', accessor: (s) => s.utilidadNeta, format: money, align: 'right' }
	];
	const turnoCols: Column<Turno>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (t) => t.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'ayer', header: 'De ayer', accessor: (t) => t.porcionesAyer, align: 'right', hideOnMobile: true },
		{ id: 'masas', header: 'Masas usadas', accessor: (t) => t.masasUsadas, format: (v) => formatNumber(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'sobras', header: 'Sobrantes', accessor: (t) => t.porcionesSobrantes, align: 'right', hideOnMobile: true },
		{ id: 'mermas', header: 'Mermas', accessor: (t) => t.porcionesMermadas, align: 'right' },
		{ id: 'vendidas', header: 'Vendidas', accessor: (t) => t.porcionesVendidas, align: 'right' },
		{ id: 'total', header: 'Total', accessor: (t) => t.efectivo + t.transferencias, format: money, align: 'right' }
	];
	const gastoCols: Column<Gasto>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (x) => x.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'desc', header: 'Concepto', accessor: (x) => x.descripcion },
		{ id: 'monto', header: 'Monto', accessor: (x) => x.monto, format: money, align: 'right' }
	];
	const compraCols: Column<Compra>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (x) => x.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'tipo', header: 'Tipo', accessor: (x) => (x.tipo === 'entrada' ? 'Compra' : 'Conteo'), hideOnMobile: true },
		{ id: 'insumo', header: 'Insumo', accessor: (x) => x.productoNombre },
		{ id: 'cant', header: 'Cantidad', accessor: (x) => x.cantidad, format: (v, x) => `${formatNumber(Number(v))} ${x.unidadMedida}`, align: 'right' },
		{ id: 'total', header: 'Costo', accessor: (x) => x.costoTotal, format: (v) => (Number(v) > 0 ? money(v) : '—'), align: 'right' }
	];

	// ── Exportaciones ───────────────────────────────────────
	let busy = $state<'pdf' | 'xlsx' | null>(null);
	let periodo = $derived(`${dayLabel(data.inicio)} – ${dayLabel(data.fin)}`);
	let baseName = $derived(safeFileName(`${data.negocio}_Finanzas_${data.inicio}_a_${data.fin}`));

	async function pdf() {
		busy = 'pdf';
		try {
			await downloadPdfReport({
				fileName: baseName,
				negocio: data.negocio,
				title: 'Reporte financiero',
				period: periodo,
				kpis: [
					{ label: 'Ventas brutas', value: pdfMoney(g.ventasBrutas), hint: `${data.diasConVenta} días con venta` },
					{ label: 'Utilidad neta', value: pdfMoney(g.utilidadNeta), hint: margen === null ? undefined : `Margen ${formatPct(margen)}` },
					{ label: 'Gastos de caja', value: pdfMoney(g.gastos) },
					{ label: 'Food cost', value: formatPct(foodCost), hint: `Compras ${pdfMoney(g.compras)}` },
					{ label: 'Efectivo', value: pdfMoney(g.efectivo) },
					{ label: 'Nequi / transferencias', value: pdfMoney(g.transferencias) },
					{ label: 'Promedio diario', value: pdfMoney(data.promedioDiario) },
					{ label: 'Turnos', value: String(data.turnosDetallados.length) }
				],
				chart: { title: 'Flujo de caja diario', canvas: chartCanvas },
				tables: [
					{
						title: 'Resumen por día',
						head: ['Día', 'Turnos', 'Efectivo', 'Nequi', 'Ventas', 'Gastos', 'Compras', 'Utilidad'],
						numeric: [1, 2, 3, 4, 5, 6, 7],
						body: [...data.historialDias].reverse().map((d) => [dayLabel(d.fecha), d.turnos, pdfMoney(d.efectivo), pdfMoney(d.transferencias), pdfMoney(d.ventasBrutas), pdfMoney(d.gastos), pdfMoney(d.compras), pdfMoney(d.utilidadNeta)]),
						foot: ['Total', data.turnosDetallados.length, pdfMoney(g.efectivo), pdfMoney(g.transferencias), pdfMoney(g.ventasBrutas), pdfMoney(g.gastos), pdfMoney(g.compras), pdfMoney(g.utilidadNeta)]
					},
					{
						title: 'Resumen por semana',
						head: ['Semana del', 'Días', 'Ventas', 'Gastos', 'Compras', 'Utilidad'],
						numeric: [1, 2, 3, 4, 5],
						body: [...data.semanas].reverse().map((s) => [dayLabel(s.lunes), s.diasContados, pdfMoney(s.ventasBrutas), pdfMoney(s.gastos), pdfMoney(s.compras), pdfMoney(s.utilidadNeta)])
					},
					{
						title: 'Auditoría de turnos (inventario de vitrina)',
						head: ['Fecha', 'De ayer', 'Masas', 'Sobrantes', 'Mermas', 'Vendidas', 'Efectivo', 'Nequi'],
						numeric: [1, 2, 3, 4, 5, 6, 7],
						body: [...data.turnosDetallados].reverse().map((t) => [formatDateTime(t.fecha), t.porcionesAyer, formatNumber(t.masasUsadas), t.porcionesSobrantes, t.porcionesMermadas, t.porcionesVendidas, pdfMoney(t.efectivo), pdfMoney(t.transferencias)])
					},
					{
						title: 'Gastos de caja',
						head: ['Fecha', 'Concepto', 'Monto'],
						numeric: [2],
						body: data.listaGastos.map((x) => [formatDateTime(x.fecha), x.descripcion, pdfMoney(x.monto)]),
						foot: ['', 'Total', pdfMoney(g.gastos)]
					}
				],
				notes: [
					'Los días se cuentan por jornada de negocio (de 04:00 a 04:00, hora de Colombia).',
					'Utilidad = ventas (efectivo + transferencias) − gastos de caja − compras de insumos. Food cost = compras ÷ ventas.'
				]
			});
		} finally {
			busy = null;
		}
	}

	let exportMsg = $state('');
	async function excel() {
		busy = 'xlsx';
		exportMsg = '';
		try {
			const ok = await exportExcel(baseName, [
				{ name: 'Por día', rows: data.historialDias.map((d) => ({ Día: d.fecha, Turnos: d.turnos, Efectivo: d.efectivo, Nequi: d.transferencias, Ventas: d.ventasBrutas, Gastos: d.gastos, 'Compras insumos': d.compras, Utilidad: d.utilidadNeta })) },
				{ name: 'Por semana', rows: data.semanas.map((s) => ({ 'Semana del': s.lunes, 'Días con venta': s.diasContados, Ventas: s.ventasBrutas, Gastos: s.gastos, 'Compras insumos': s.compras, Utilidad: s.utilidadNeta })) },
				{ name: 'Turnos', rows: data.turnosDetallados.map((t) => ({ Turno: t.id, Fecha: formatDateTime(t.fecha), 'De ayer': t.porcionesAyer, 'Masas usadas': t.masasUsadas, Sobrantes: t.porcionesSobrantes, Mermas: t.porcionesMermadas, Vendidas: t.porcionesVendidas, Efectivo: t.efectivo, Nequi: t.transferencias, Nota: t.descripcion ?? '' })) },
				{ name: 'Gastos', rows: data.listaGastos.map((x) => ({ Fecha: formatDateTime(x.fecha), Concepto: x.descripcion, Monto: x.monto })) },
				{ name: 'Compras', rows: data.compras.map((c) => ({ Fecha: formatDateTime(c.fecha), Tipo: c.tipo === 'entrada' ? 'Compra' : 'Conteo', Insumo: c.productoNombre, Unidad: c.unidadMedida, Cantidad: c.cantidad, 'Costo unitario': c.costoUnitario, 'Costo total': c.costoTotal })) }
			]);
			if (!ok) exportMsg = 'No hay datos en este período para exportar.';
		} finally {
			busy = null;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Filtros + exportación -->
	<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
		<div class="flex flex-wrap items-end gap-2">
			<div class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 shadow-sm sm:w-auto">
				<CalendarRange size={15} class="text-muted-foreground" />
				<input type="date" bind:value={inicio} aria-label="Desde" class="min-w-0 flex-1 bg-transparent text-[13px] outline-none dark:[color-scheme:dark]" />
				<span class="text-muted-foreground">–</span>
				<input type="date" bind:value={fin} aria-label="Hasta" class="min-w-0 flex-1 bg-transparent text-[13px] outline-none dark:[color-scheme:dark]" />
			</div>
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => aplicar()} disabled={inicio === data.inicio && fin === data.fin}>Aplicar</button>
			<div class="flex flex-wrap gap-1">
				{#each [{ k: 'mes', l: 'Este mes' }, { k: 'anterior', l: 'Mes anterior' }, { k: '7', l: '7 días' }, { k: '30', l: '30 días' }] as p (p.k)}
					<button type="button" class={cn(btn.base, btn.ghost, btn.sm)} onclick={() => preset(p.k as 'mes')}>{p.l}</button>
				{/each}
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="button" class={cn(btn.base, btn.outline)} onclick={excel} disabled={busy !== null}>
				{#if busy === 'xlsx'}<LoaderCircle size={15} class="animate-spin" />{:else}<FileSpreadsheet size={15} />{/if} Excel
			</button>
			<button type="button" class={cn(btn.base, btn.primary)} onclick={pdf} disabled={busy !== null || data.historialDias.length === 0}>
				{#if busy === 'pdf'}<LoaderCircle size={15} class="animate-spin" />{:else}<FileText size={15} />{/if} Reporte PDF
			</button>
		</div>
	</div>
	{#if exportMsg}<p class="-mt-3 text-sm text-muted-foreground">{exportMsg}</p>{/if}

	{#if data.historialDias.length === 0 && !loading}
		<Card>
			<EmptyState icon={ChartLine} title="Sin movimientos en este período" description="Elige otro rango o registra cierres de turno para ver el análisis." />
		</Card>
	{:else}
		<section class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
			{#if loading}
				{#each Array(6) as _, i (i)}<Skeleton class="h-[92px]" />{/each}
			{:else}
				<StatTile label="Ventas brutas" value={formatCOP(g.ventasBrutas)} icon={Wallet} hint={`${formatCOP(data.promedioDiario)} / día`} />
				<StatTile label="Efectivo" value={formatCOP(g.efectivo)} icon={Banknote} hint={g.ventasBrutas ? `${formatPct(g.efectivo / g.ventasBrutas, 0)} de las ventas` : undefined} />
				<StatTile label="Nequi" value={formatCOP(g.transferencias)} icon={Smartphone} hint={g.ventasBrutas ? `${formatPct(g.transferencias / g.ventasBrutas, 0)} de las ventas` : undefined} />
				<StatTile label="Gastos de caja" value={formatCOP(g.gastos)} icon={Receipt} />
				<StatTile label="Compras insumos" value={formatCOP(g.compras)} icon={ShoppingCart} hint={`Food cost ${formatPct(foodCost)}`} tone={foodCostStatus(foodCost) === 'riesgo' ? 'danger' : foodCostStatus(foodCost) === 'vigilar' ? 'warning' : 'default'} />
				<StatTile label="Utilidad neta" value={formatCOP(g.utilidadNeta)} icon={ChartLine} hint={margen === null ? undefined : `Margen ${formatPct(margen)}`} tone={g.utilidadNeta < 0 ? 'danger' : 'success'} />
			{/if}
		</section>

		<Card title="Flujo de caja diario" description={periodo}>
			{#if loading}<Skeleton class="h-72 w-full" />{:else}<CashflowChart data={serie} bind:canvasEl={chartCanvas} />{/if}
		</Card>

		<Card>
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<SegmentedControl
					label="Vista de detalle"
					value={vista}
					onchange={(v) => (vista = v)}
					options={[
						{ value: 'dias', label: 'Días' },
						{ value: 'semanas', label: 'Semanas' },
						{ value: 'turnos', label: 'Turnos' },
						{ value: 'gastos', label: 'Gastos' },
						{ value: 'compras', label: 'Compras' }
					]}
				/>
				{#if data.pagosDesglose.length}
					<div class="flex flex-wrap gap-1.5">
						{#each data.pagosDesglose as p (p.plataforma)}<Badge variant="outline">{p.plataforma}: {formatCOP(p.total)}</Badge>{/each}
					</div>
				{/if}
			</div>
			{#if vista === 'dias'}
				<DataTable {loading} rows={data.historialDias} columns={diaCols} rowKey={(d) => d.fecha} initialSort={{ id: 'fecha', dir: 'desc' }} searchPlaceholder="Buscar día…">
					{#snippet cell(d, c)}
						{#if c.id === 'neto'}<span class="font-medium {d.utilidadNeta < 0 ? 'text-danger' : ''}">{money(d.utilidadNeta)}</span>{:else}{c.format ? c.format(c.accessor(d), d) : c.accessor(d)}{/if}
					{/snippet}
				</DataTable>
			{:else if vista === 'semanas'}
				<DataTable {loading} rows={data.semanas} columns={semCols} rowKey={(s) => s.lunes} initialSort={{ id: 'lunes', dir: 'desc' }} searchPlaceholder="Buscar semana…" />
			{:else if vista === 'turnos'}
				<DataTable {loading} rows={data.turnosDetallados} columns={turnoCols} rowKey={(t) => t.id} initialSort={{ id: 'fecha', dir: 'desc' }} searchPlaceholder="Buscar turno…" emptyTitle="Sin turnos" />
			{:else if vista === 'gastos'}
				<DataTable {loading} rows={data.listaGastos} columns={gastoCols} rowKey={(x) => x.id} initialSort={{ id: 'fecha', dir: 'desc' }} searchPlaceholder="Buscar gasto…" emptyTitle="Sin gastos" />
			{:else}
				<DataTable {loading} rows={data.compras} columns={compraCols} rowKey={(x) => x.id} initialSort={{ id: 'fecha', dir: 'desc' }} searchPlaceholder="Buscar insumo…" emptyTitle="Sin compras" emptyDescription="Las compras se registran en Bodega." />
			{/if}
		</Card>
	{/if}
</div>
