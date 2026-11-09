<script lang="ts">
	import { Pizza } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formatCOP, formatNumber } from '$lib/utils/format';

	interface Item {
		nombre: string;
		vendidas: number;
		ingresos: number;
	}
	let { items, loading = false }: { items: Item[]; loading?: boolean } = $props();
	// La barra mide ingresos (orden del ranking); si no hay precio, unidades
	const valor = (i: Item) => (i.ingresos > 0 ? i.ingresos : i.vendidas);
	let max = $derived(Math.max(1, ...items.map(valor)));
</script>

<Card title="Productos más vendidos" description="Sabores de pizza y platos, por ingresos">
	{#if loading}
		<div class="space-y-4">{#each Array(4) as _, i (i)}<Skeleton class="h-7 w-full" />{/each}</div>
	{:else if items.length === 0}
		<EmptyState icon={Pizza} title="Sin ventas registradas" description="Al cerrar turnos verás aquí el ranking." />
	{:else}
		<ol class="space-y-3.5">
			{#each items as item, i (item.nombre)}
				<li>
					<div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
						<span class="flex min-w-0 items-center gap-2">
							<span class="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
							<span class="truncate font-medium">{item.nombre}</span>
						</span>
						<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
							{formatNumber(item.vendidas)} und.{#if item.ingresos > 0}<span class="text-foreground"> · {formatCOP(item.ingresos)}</span>{/if}
						</span>
					</div>
					<div class="ml-6 h-1.5 rounded-full bg-muted">
						<div class="h-full rounded-full bg-series-1 transition-[width] duration-700" style="width:{(valor(item) / max) * 100}%"></div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</Card>
