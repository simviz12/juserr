<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { FileText, LoaderCircle, Wallet, Banknote, Receipt, ShoppingCart, ChevronLeft, ChevronRight, Scale } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import KpiCard from '$lib/components/ui/KpiCard.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import CashflowChart from '$lib/components/charts/CashflowChart.svelte';
	import TopProductsCard from '$lib/features/finance/components/TopProductsCard.svelte';
	import SalesByLineCard from '$lib/features/finance/components/SalesByLineCard.svelte';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate, formatNumber, formatPct } from '$lib/utils/format';
	import { safeFileName } from '$lib/utils/export';
	import { downloadPdfReport, pdfMoney } from '$lib/features/finance/reports/pdf';

	let { data } = $props();

	let loading = $derived(navigating.to?.url.pathname === '/finanzas/mensual');
	let r = $derived(data.report);
	let s = $derived(r.summary);
	const dayLabel = (k: string | null) => (k ? formatDate(k + 'T12:00:00-05:00') : '—');
	let pasado = $derived(r.cashflow.filter((p) => !p.future));
	let mejorDia = $derived(pasado.reduce<(typeof pasado)[number] | null>((m, p) => (!m || p.efectivo + p.transferencias > m.efectivo + m.transferencias ? p : m), null));
	let diasConVenta = $derived(pasado.filter((p) => p.efectivo + p.transferencias > 0).length);
	let totalCortesDif = $derived(data.cortes.reduce((a, c) => a + c.diferencia, 0));

	function mover(delta: number) {
		const [y, m] = data.mes.split('-').map(Number);
		const d = new Date(Date.UTC(y, m - 1 + delta, 1));
		goto(`?mes=${d.toISOString().slice(0, 7)}`, { noScroll: true, keepFocus: true });
	}

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let busy = $state(false);
	async function pdf() {
		busy = true;
		try {
			await downloadPdfReport({
				fileName: safeFileName(`${data.negocio}_Reporte_${data.mes}`),
				negocio: data.negocio,
				title: 'Reporte mensual',
				period: data.monthLabel,
				kpis: [
					{ label: 'Ventas brutas', value: pdfMoney(s.ventasBrutas), hint: r.deltas.ventas.pct === null ? undefined : `${r.deltas.ventas.pct >= 0 ? '+' : ''}${formatPct(r.deltas.ventas.pct)} vs mes anterior` },
					{ label: 'Utilidad neta', value: pdfMoney(s.utilidadNeta), hint: s.margen === null ? undefined : `Margen ${formatPct(s.margen)}` },
					{ label: 'Gastos de caja', value: pdfMoney(s.gastos) },
					{ label: 'Food cost', value: formatPct(s.foodCost), hint: `Compras ${pdfMoney(s.compras)}` },
					{ label: 'Efectivo', value: pdfMoney(s.efectivo) },
					{ label: 'Nequi', value: pdfMoney(s.transferencias) },
					{ label: 'Porciones vendidas', value: formatNumber(s.porciones), hint: `Mermas ${formatNumber(s.mermas)}` },
					{ label: 'Turnos', value: String(s.turnos), hint: s.ticketPorTurno ? `Ticket ${pdfMoney(s.ticketPorTurno)}` : undefined }
				],
				chart: { title: 'Ventas y gastos por día', canvas: chartCanvas },
				tables: [
					{
						title: 'Comparativo con el mes anterior',
						head: ['Indicador', r.range.partial ? 'Mes anterior (mismos días)' : 'Mes anterior', data.monthLabel, 'Variación'],
						numeric: [1, 2, 3],
						body: [
							['Ventas brutas', pdfMoney(r.previous.ventasBrutas), pdfMoney(s.ventasBrutas), r.deltas.ventas.pct === null ? '—' : formatPct(r.deltas.ventas.pct)],
							['Gastos de caja', pdfMoney(r.previous.gastos), pdfMoney(s.gastos), r.deltas.gastos.pct === null ? '—' : formatPct(r.deltas.gastos.pct)],
							['Utilidad neta', pdfMoney(r.previous.utilidadNeta), pdfMoney(s.utilidadNeta), r.deltas.utilidad.pct === null ? '—' : formatPct(r.deltas.utilidad.pct)],
							['Food cost', formatPct(r.previous.foodCost), formatPct(s.foodCost), '—'],
							['Porciones', formatNumber(r.previous.porciones), formatNumber(s.porciones), r.deltas.porciones.pct === null ? '—' : formatPct(r.deltas.porciones.pct)]
						]
					},
					{
						title: 'Ventas por día',
						head: ['Día', 'Efectivo', 'Nequi', 'Gastos de caja', 'Ventas − gastos'],
						numeric: [1, 2, 3, 4],
						body: pasado.filter((p) => p.efectivo + p.transferencias + p.gastos > 0).map((p) => [dayLabel(p.key), pdfMoney(p.efectivo), pdfMoney(p.transferencias), pdfMoney(p.gastos), pdfMoney(p.neto)]),
						foot: ['Total', pdfMoney(s.efectivo), pdfMoney(s.transferencias), pdfMoney(s.gastos), pdfMoney(s.ventasBrutas - s.gastos)]
					},
					{
						title: 'Gastos por concepto',
						head: ['Concepto', 'Veces', 'Total', '% de gastos'],
						numeric: [1, 2, 3],
						body: data.gastosPorConcepto.map((g) => [g.concepto, g.veces, pdfMoney(g.total), s.gastos ? formatPct(g.total / s.gastos, 0) : '—'])
					},
					{
						title: 'Ventas por línea (según inventario)',
						head: ['Línea', 'Unidades', 'Venta estimada', 'Participación'],
						numeric: [1, 2, 3],
						body: r.ventasPorLinea.map((l) => [l.nombre, formatNumber(l.unidades), pdfMoney(l.venta), formatPct(l.participacion, 0)])
					},
					{
						title: 'Productos más vendidos',
						head: ['Producto', 'Unidades', 'Ingresos estimados'],
						numeric: [1, 2],
						body: r.topSabores.map((t) => [t.nombre, formatNumber(t.vendidas), t.ingresos > 0 ? pdfMoney(t.ingresos) : '—'])
					},
					{
						title: 'Cortes de efectivo del mes',
						head: ['Rango', 'Esperado', 'Contado', 'Diferencia'],
						numeric: [1, 2, 3],
						body: data.cortes.map((c) => [`${dayLabel(c.desde)} – ${dayLabel(c.hasta)}`, pdfMoney(c.esperado), pdfMoney(c.real), pdfMoney(c.diferencia)])
					}
				],
				notes: ['Días contados por jornada de negocio (04:00 a 04:00, hora de Colombia).', 'Utilidad neta = ventas − gastos de caja − compras de insumos. Food cost = compras de insumos registradas en Bodega ÷ ventas.']
			});
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-1">
			<button type="button" class={cn(btn.base, 'h-9 w-9 border border-input bg-card text-foreground shadow-sm hover:bg-accent')} onclick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
			<input
				type="month"
				value={data.mes}
				onchange={(e) => e.currentTarget.value && goto(`?mes=${e.currentTarget.value}`, { noScroll: true, keepFocus: true })}
				aria-label="Mes"
				class="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm dark:[color-scheme:dark]"
			/>
			<button type="button" class={cn(btn.base, 'h-9 w-9 border border-input bg-card text-foreground shadow-sm hover:bg-accent')} onclick={() => mover(1)} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
			<h2 class="ml-2 text-lg font-semibold tracking-tight">{data.monthLabel}</h2>
		</div>
		<button type="button" class={cn(btn.base, btn.primary)} onclick={pdf} disabled={busy || loading || s.turnos === 0}>
			{#if busy}<LoaderCircle size={15} class="animate-spin" />{:else}<FileText size={15} />{/if} Descargar PDF
		</button>
	</div>

	{#if s.turnos === 0 && s.gastos === 0 && !loading}
		<Card><EmptyState icon={Scale} title="Sin movimientos en {data.monthLabel}" description="Elige otro mes con las flechas." /></Card>
	{:else}
		<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<KpiCard label="Ventas brutas" icon={Wallet} value={formatCOP(s.ventasBrutas)} delta={r.deltas.ventas} comparison={r.range.partial ? 'vs. mismos días del mes anterior' : 'vs. mes anterior'} {loading} />
			<KpiCard label="Utilidad neta" icon={Banknote} value={formatCOP(s.utilidadNeta)} delta={r.deltas.utilidad} comparison={s.margen === null ? '' : `margen ${formatPct(s.margen)}`} {loading} />
			<KpiCard label="Gastos de caja" icon={Receipt} value={formatCOP(s.gastos)} delta={r.deltas.gastos} inverse comparison={r.range.partial ? 'vs. mismos días del mes anterior' : 'vs. mes anterior'} {loading} />
			<KpiCard label="Food cost" icon={ShoppingCart} value={formatPct(s.foodCost)} delta={r.deltas.foodCost} inverse comparison={`compras ${formatCOP(s.compras)}`} {loading} />
		</section>

		<Card title="Ventas y gastos por día" description={mejorDia && mejorDia.efectivo + mejorDia.transferencias > 0 ? `${diasConVenta} días con venta · mejor día: ${dayLabel(mejorDia.key)} (${formatCOP(mejorDia.efectivo + mejorDia.transferencias)})` : undefined}>
			{#if loading}<Skeleton class="h-72 w-full" />{:else}<CashflowChart data={r.cashflow} bind:canvasEl={chartCanvas} />{/if}
		</Card>

		<SalesByLineCard lineas={r.ventasPorLinea} {loading} />

		<div class="grid gap-4 lg:grid-cols-3">
			<Card title="Gastos por concepto" description="¿En qué se fue el dinero de caja?">
				{#if data.gastosPorConcepto.length === 0}
					<p class="py-6 text-center text-sm text-muted-foreground">Sin gastos este mes.</p>
				{:else}
					<ul class="flex flex-col gap-3">
						{#each data.gastosPorConcepto.slice(0, 8) as g (g.concepto)}
							<li>
								<div class="mb-1 flex justify-between gap-2 text-sm">
									<span class="truncate">{g.concepto} <span class="text-xs text-muted-foreground">×{g.veces}</span></span>
									<span class="shrink-0 font-medium tabular-nums">{formatCOP(g.total)}</span>
								</div>
								<div class="h-1.5 rounded-full bg-muted"><div class="h-full rounded-full bg-series-3" style="width:{(g.total / (data.gastosPorConcepto[0]?.total || 1)) * 100}%"></div></div>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
			<TopProductsCard items={r.topSabores} {loading} />
			<Card title="Cortes de efectivo" description={data.cortes.length ? `Diferencia acumulada: ${totalCortesDif > 0 ? '+' : ''}${formatCOP(totalCortesDif)}` : 'Registrados en Corte semanal'}>
				{#if data.cortes.length === 0}
					<p class="py-6 text-center text-sm text-muted-foreground">Sin cortes este mes.</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each data.cortes as c (c.id)}
							<li class="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
								<span class="text-muted-foreground">{dayLabel(c.desde)} – {dayLabel(c.hasta)}</span>
								<span class="font-medium tabular-nums {Math.abs(c.diferencia) < 1 ? 'text-success' : c.diferencia > 0 ? 'text-warning' : 'text-danger'}">{c.diferencia > 0 ? '+' : ''}{formatCOP(c.diferencia)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		</div>
	{/if}
</div>
