<script lang="ts">
	import { PackageCheck, ArrowRight } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formatNumber } from '$lib/utils/format';

	interface Item {
		id: number;
		nombre: string;
		stockActual: number | null;
		stockMinimo: number | null;
		unidadMedida: string;
	}
	let { items, loading = false }: { items: Item[]; loading?: boolean } = $props();
</script>

<Card title="Inventario crítico" description="Insumos en o bajo el stock mínimo">
	{#snippet actions()}
		<a href="/bodega" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
			Bodega <ArrowRight size={13} />
		</a>
	{/snippet}

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _, i (i)}<Skeleton class="h-10 w-full" />{/each}</div>
	{:else if items.length === 0}
		<EmptyState icon={PackageCheck} title="Todo en orden" description="Ningún insumo está bajo el mínimo." />
	{:else}
		<ul class="divide-y divide-border">
			{#each items as item (item.id)}
				{@const stock = item.stockActual ?? 0}
				<li class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{item.nombre}</p>
						<p class="text-xs text-muted-foreground tabular-nums">
							{formatNumber(stock)} {item.unidadMedida} · mín. {formatNumber(item.stockMinimo ?? 0)}
						</p>
					</div>
					<Badge variant={stock <= 0 ? 'danger' : 'warning'}>{stock <= 0 ? 'Agotado' : 'Bajo'}</Badge>
				</li>
			{/each}
		</ul>
	{/if}
</Card>
