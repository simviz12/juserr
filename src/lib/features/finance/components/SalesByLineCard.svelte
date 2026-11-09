<script lang="ts">
	import { Store } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formatCOP, formatNumber, formatPct } from '$lib/utils/format';

	interface Linea {
		nombre: string;
		venta: number;
		unidades: number;
		participacion: number;
	}
	let { lineas, loading = false }: { lineas: Linea[]; loading?: boolean } = $props();
	let max = $derived(Math.max(1, ...lineas.map((l) => l.venta)));
</script>

<Card title="Ventas por línea" description="Estimadas por conteo de inventario en cada cierre">
	{#if loading}
		<div class="space-y-4">{#each Array(3) as _, i (i)}<Skeleton class="h-7 w-full" />{/each}</div>
	{:else if lineas.length === 0}
		<EmptyState icon={Store} title="Sin cierres con inventario" description="Al cerrar turnos contando panes, chuzos o porciones verás cada línea aquí." />
	{:else}
		<ul class="space-y-3.5">
			{#each lineas as l (l.nombre)}
				<li>
					<div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
						<span class="truncate font-medium">{l.nombre}</span>
						<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
							{formatNumber(l.unidades)} und · <span class="text-foreground">{formatCOP(l.venta)}</span> · {formatPct(l.participacion, 0)}
						</span>
					</div>
					<div class="h-1.5 rounded-full bg-muted">
						<div class="h-full rounded-full bg-series-3 transition-[width] duration-700" style="width:{(l.venta / max) * 100}%"></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Card>
