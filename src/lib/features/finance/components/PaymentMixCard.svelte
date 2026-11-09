<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { PeriodSummary } from '../domain/metrics';
	import { formatCOP, formatPct } from '$lib/utils/format';

	let { summary, loading = false }: { summary: PeriodSummary; loading?: boolean } = $props();

	let channels = $derived([
		{ label: 'Efectivo', value: summary.efectivo, color: 'var(--series-1)' },
		{ label: 'Nequi / transferencias', value: summary.transferencias, color: 'var(--series-2)' }
	]);
	let total = $derived(summary.ventasBrutas);
	const share = (v: number) => (total > 0 ? v / total : 0);
</script>

<Card title="Mezcla de cobro" description="Participación de cada canal en las ventas">
	{#if loading}
		<Skeleton class="h-3 w-full" />
		<div class="mt-5 space-y-3"><Skeleton class="h-5 w-full" /><Skeleton class="h-5 w-4/5" /></div>
	{:else}
		<div class="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribución de canales de pago">
			{#each channels as c (c.label)}
				{#if c.value > 0}
					<div class="h-full transition-[width] duration-500" style="width:{share(c.value) * 100}%;background:{c.color}"></div>
				{/if}
			{/each}
		</div>
		<ul class="mt-5 space-y-3 text-sm">
			{#each channels as c (c.label)}
				<li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
					<span class="flex items-center gap-2 text-muted-foreground">
						<span class="h-2.5 w-2.5 rounded-[3px]" style="background:{c.color}"></span>{c.label}
					</span>
					<span class="flex items-baseline gap-2 tabular-nums">
						<span class="font-medium">{formatCOP(c.value)}</span>
						<span class="w-12 text-right text-xs text-muted-foreground">{total > 0 ? formatPct(share(c.value), 0) : '—'}</span>
					</span>
				</li>
			{/each}
			<li class="flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-3">
				<span class="text-muted-foreground">Gastos de caja</span>
				<span class="font-medium tabular-nums {summary.gastos > 0 ? 'text-danger' : 'text-muted-foreground'}">{summary.gastos > 0 ? '−' : ''}{formatCOP(summary.gastos)}</span>
			</li>
		</ul>
	{/if}
</Card>
