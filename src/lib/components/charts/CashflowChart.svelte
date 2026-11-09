<script lang="ts">
	/**
	 * Flujo de caja: barras apiladas de ingresos (efectivo + transferencias) y
	 * línea de gastos, todo en el MISMO eje COP (sin doble eje).
	 * Colores leídos de los tokens CSS → se adapta solo a light/dark.
	 */
	import { onMount } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		type ChartConfiguration
	} from 'chart.js';
	import type { CashflowPoint } from '$lib/features/finance/domain/metrics';
	import { formatCOP, formatCompactCOP } from '$lib/utils/format';

	Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

	interface Props {
		data: CashflowPoint[];
		showTable?: boolean;
		/** Expone el canvas (p. ej. para incluir el gráfico en un PDF). */
		canvasEl?: HTMLCanvasElement | null;
		height?: string;
	}
	let { data, showTable = false, canvasEl = $bindable(null), height = 'h-72' }: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	let vacio = $derived(data.every((p) => p.future || (p.efectivo === 0 && p.transferencias === 0 && p.gastos === 0)));
	let chart: Chart | null = null;
	let themeTick = $state(0);

	const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

	function build(points: CashflowPoint[]): ChartConfiguration {
		const surface = token('--card');
		const muted = token('--muted-foreground');
		const grid = token('--chart-grid');
		const font = { family: 'Inter, system-ui, sans-serif', size: 11 };
		return {
			type: 'bar',
			data: {
				labels: points.map((p) => p.label),
				datasets: [
					{
						type: 'bar',
						label: 'Efectivo',
						data: points.map((p) => (p.future ? null : p.efectivo)),
						backgroundColor: token('--series-1'),
						borderColor: surface,
						borderWidth: { top: 2 },
						borderRadius: 0,
						borderSkipped: 'bottom',
						stack: 'ingresos',
						maxBarThickness: 28,
						order: 2
					},
					{
						type: 'bar',
						label: 'Transferencias',
						data: points.map((p) => (p.future ? null : p.transferencias)),
						backgroundColor: token('--series-2'),
						borderRadius: { topLeft: 4, topRight: 4 },
						borderSkipped: 'bottom',
						stack: 'ingresos',
						maxBarThickness: 28,
						order: 2
					},
					{
						type: 'line',
						label: 'Gastos',
						data: points.map((p) => (p.future ? null : p.gastos)),
						borderColor: token('--series-3'),
						backgroundColor: token('--series-3'),
						borderWidth: 2,
						pointRadius: 0,
						pointHoverRadius: 5,
						pointHoverBorderColor: surface,
						pointHoverBorderWidth: 2,
						tension: 0.35,
						order: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 450, easing: 'easeOutQuart' },
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: token('--popover'),
						titleColor: token('--foreground'),
						bodyColor: token('--foreground'),
						borderColor: token('--border'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { ...font, weight: 600 },
						bodyFont: font,
						// Sin tooltip en días futuros (no hay datos, no es $0)
						filter: (item) => !points[item.dataIndex]?.future,
						callbacks: {
							label: (ctx) => ` ${ctx.dataset.label}: ${formatCOP(Number(ctx.parsed.y))}`,
							footer: (items) => {
								const p = points[items[0]?.dataIndex ?? 0];
								return p && !p.future ? `Ventas − gastos: ${formatCOP(p.neto)}` : '';
							}
						},
						footerColor: muted,
						footerFont: { ...font, weight: 500 }
					}
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { color: muted, font, maxRotation: 0, autoSkipPadding: 12 }
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: grid },
						border: { display: false },
						ticks: { color: muted, font, maxTicksLimit: 5, callback: (v) => formatCompactCOP(Number(v)) }
					}
				}
			}
		};
	}

	onMount(() => {
		const obs = new MutationObserver(() => (themeTick += 1));
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => {
			obs.disconnect();
			chart?.destroy();
			chart = null;
		};
	});

	$effect(() => {
		void themeTick;
		if (!canvas || showTable || vacio) return;
		chart?.destroy();
		chart = new Chart(canvas, build(data));
		canvasEl = canvas;
	});

	const legend = [
		{ label: 'Efectivo', color: 'var(--series-1)', kind: 'bar' },
		{ label: 'Transferencias', color: 'var(--series-2)', kind: 'bar' },
		{ label: 'Gastos', color: 'var(--series-3)', kind: 'line' }
	];
</script>

<div class="flex flex-col gap-3">
	<ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
		{#each legend as l (l.label)}
			<li class="flex items-center gap-1.5">
				{#if l.kind === 'bar'}
					<span class="h-2.5 w-2.5 rounded-[3px]" style="background:{l.color}"></span>
				{:else}
					<span class="h-0.5 w-3 rounded-full" style="background:{l.color}"></span>
				{/if}
				{l.label}
			</li>
		{/each}
	</ul>

	{#if vacio}
		<div class="grid {height} place-items-center rounded-md border border-dashed border-border text-center">
			<div>
				<p class="text-sm font-medium">Sin movimientos en este período</p>
				<p class="mt-1 text-[13px] text-muted-foreground">Los cierres de turno y gastos aparecerán aquí.</p>
			</div>
		</div>
	{:else if showTable}
		<div class="max-h-72 overflow-auto rounded-md border border-border custom-scrollbar">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-muted text-xs text-muted-foreground">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Período</th>
						<th class="px-3 py-2 text-right font-medium">Efectivo</th>
						<th class="px-3 py-2 text-right font-medium">Transf.</th>
						<th class="px-3 py-2 text-right font-medium">Gastos</th>
						<th class="px-3 py-2 text-right font-medium">Neto</th>
					</tr>
				</thead>
				<tbody class="tabular-nums">
					{#each data.filter((p) => !p.future) as p (p.key)}
						<tr class="border-t border-border">
							<td class="px-3 py-2">{p.label}</td>
							<td class="px-3 py-2 text-right">{formatCOP(p.efectivo)}</td>
							<td class="px-3 py-2 text-right">{formatCOP(p.transferencias)}</td>
							<td class="px-3 py-2 text-right">{formatCOP(p.gastos)}</td>
							<td class="px-3 py-2 text-right font-medium {p.neto < 0 ? 'text-danger' : ''}">{formatCOP(p.neto)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="relative {height} w-full">
			<canvas bind:this={canvas} aria-label="Gráfico de flujo de caja: ingresos por canal y gastos"></canvas>
		</div>
	{/if}
</div>
