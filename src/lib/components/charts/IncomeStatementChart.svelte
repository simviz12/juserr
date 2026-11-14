<script lang="ts">
	/**
	 * Comparativo del estado de resultados: barras agrupadas por rubro (periodo
	 * consultado vs. periodo de comparación) en un único eje COP.
	 * Colores leídos de los tokens CSS → se adapta solo a light/dark.
	 */
	import { onMount } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		type ChartConfiguration
	} from 'chart.js';
	import { formatCOP, formatCompactCOP } from '$lib/utils/format';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

	export interface StatementChartPoint {
		label: string;
		/** Importes en pesos. */
		actual: number;
		anterior: number | null;
	}

	interface Props {
		data: StatementChartPoint[];
		actualLabel: string;
		/** Nombre de la serie de comparación; sin él solo se pinta el periodo actual. */
		anteriorLabel?: string | null;
		/** Expone el canvas (p. ej. para incluir el gráfico en un PDF). */
		canvasEl?: HTMLCanvasElement | null;
		height?: string;
	}
	let {
		data,
		actualLabel,
		anteriorLabel = null,
		canvasEl = $bindable(null),
		height = 'h-72'
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	let comparado = $derived(!!anteriorLabel && data.some((p) => p.anterior !== null));
	let vacio = $derived(data.every((p) => p.actual === 0 && !p.anterior));
	let chart: Chart | null = null;
	let themeTick = $state(0);

	const token = (name: string) =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim();

	function build(points: StatementChartPoint[], conComparativo: boolean): ChartConfiguration {
		const muted = token('--muted-foreground');
		const font = { family: 'Inter, system-ui, sans-serif', size: 11 };
		const barra = {
			borderRadius: 4,
			maxBarThickness: 44,
			categoryPercentage: 0.7,
			barPercentage: 0.85
		};
		return {
			type: 'bar',
			data: {
				labels: points.map((p) => p.label),
				datasets: [
					{
						label: actualLabel,
						data: points.map((p) => p.actual),
						backgroundColor: token('--series-1'),
						...barra
					},
					...(conComparativo
						? [
								{
									label: anteriorLabel ?? '',
									data: points.map((p) => p.anterior ?? 0),
									backgroundColor: token('--series-2'),
									...barra
								}
							]
						: [])
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
						callbacks: {
							label: (ctx) => ` ${ctx.dataset.label}: ${formatCOP(Number(ctx.parsed.y))}`
						}
					}
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { color: muted, font, maxRotation: 0, autoSkip: false }
					},
					y: {
						// La utilidad puede ser negativa: el eje incluye el cero y lo resalta.
						grid: {
							color: (ctx) => (ctx.tick.value === 0 ? token('--ring') : token('--chart-grid'))
						},
						border: { display: false },
						ticks: {
							color: muted,
							font,
							maxTicksLimit: 6,
							callback: (v) => formatCompactCOP(Number(v))
						}
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
		if (!canvas || vacio) return;
		chart?.destroy();
		chart = new Chart(canvas, build(data, comparado));
		canvasEl = canvas;
	});

	let legend = $derived([
		{ label: actualLabel, color: 'var(--series-1)' },
		...(comparado ? [{ label: anteriorLabel ?? '', color: 'var(--series-2)' }] : [])
	]);
</script>

<div class="flex flex-col gap-3">
	<ul
		class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
		aria-label="Leyenda"
	>
		{#each legend as l (l.color)}
			<li class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-[3px]" style="background:{l.color}"></span>
				{l.label}
			</li>
		{/each}
	</ul>

	{#if vacio}
		<div
			class="grid {height} place-items-center rounded-md border border-dashed border-border text-center"
		>
			<div>
				<p class="text-sm font-medium">Sin movimientos en este periodo</p>
				<p class="mt-1 text-[13px] text-muted-foreground">
					Las ventas, costos y gastos aparecerán aquí.
				</p>
			</div>
		</div>
	{:else}
		<div class="relative {height} w-full">
			<canvas
				bind:this={canvas}
				aria-label="Gráfico comparativo de ingresos, costos, gastos y utilidad neta"
			></canvas>
		</div>
	{/if}
</div>
