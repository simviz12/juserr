<script lang="ts">
	import { CircleCheck, TriangleAlert, OctagonAlert, CircleHelp } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import TrendBadge from '$lib/components/ui/TrendBadge.svelte';
	import { FOOD_COST_TARGET, type Delta, type FoodCostStatus, type PeriodSummary } from '../domain/metrics';
	import { formatCOP, formatPct } from '$lib/utils/format';

	interface Props {
		summary: PeriodSummary;
		status: FoodCostStatus;
		delta: Delta;
		loading?: boolean;
	}
	let { summary, status, delta, loading = false }: Props = $props();

	const SCALE_MAX = 0.6; // el medidor llega a 60 %
	const STATUS = {
		saludable: { label: 'Saludable', variant: 'success', icon: CircleCheck },
		vigilar: { label: 'Vigilar', variant: 'warning', icon: TriangleAlert },
		riesgo: { label: 'En riesgo', variant: 'danger', icon: OctagonAlert },
		'sin-datos': { label: 'Sin datos', variant: 'neutral', icon: CircleHelp }
	} as const;

	let meta = $derived(STATUS[status]);
	let fill = $derived(Math.min(1, (summary.foodCost ?? 0) / SCALE_MAX));
	let barColor = $derived(
		status === 'riesgo' ? 'var(--danger)' : status === 'vigilar' ? 'var(--warning)' : 'var(--success)'
	);
</script>

<Card title="Food cost" description="Compras de insumos ÷ ventas del período">
	{#snippet actions()}
		{@const Icon = meta.icon}
		<Badge variant={meta.variant}><Icon size={12} />{meta.label}</Badge>
	{/snippet}

	{#if loading}
		<Skeleton class="h-9 w-28" />
		<Skeleton class="mt-4 h-2 w-full" />
	{:else}
		<div class="flex items-end gap-2">
			<p class="text-3xl font-semibold tracking-tight tabular-nums">{formatPct(summary.foodCost)}</p>
			{#if summary.foodCost !== null}<TrendBadge {delta} inverse class="mb-1" />{/if}
		</div>

		<div class="relative mt-5">
			<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div class="h-full rounded-full transition-[width] duration-700" style="width:{fill * 100}%;background:{barColor}"></div>
			</div>
			{#each [FOOD_COST_TARGET.ideal, FOOD_COST_TARGET.max] as mark (mark)}
				<div class="absolute -top-1 h-4 w-px bg-foreground/40" style="left:{(mark / SCALE_MAX) * 100}%"></div>
				<span class="absolute top-4 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums" style="left:{(mark / SCALE_MAX) * 100}%">
					{formatPct(mark, 0)}
				</span>
			{/each}
		</div>

		<dl class="mt-8 grid grid-cols-2 gap-3 text-sm">
			<div>
				<dt class="text-xs text-muted-foreground">Compras de insumos</dt>
				<dd class="font-medium tabular-nums">{formatCOP(summary.compras)}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">Meta del sector</dt>
				<dd class="font-medium tabular-nums">{formatPct(FOOD_COST_TARGET.ideal, 0)}–{formatPct(FOOD_COST_TARGET.max, 0)}</dd>
			</div>
		</dl>
	{/if}
</Card>
