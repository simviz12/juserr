<script lang="ts">
	import { ArrowDownRight, ArrowUpRight, Minus } from '@lucide/svelte';
	import type { Delta } from '$lib/features/finance/domain/metrics';
	import { formatPct } from '$lib/utils/format';
	import { cn } from '$lib/utils/cn';

	interface Props {
		delta: Delta;
		/** true cuando subir es malo (gastos, food cost). */
		inverse?: boolean;
		class?: string;
	}
	let { delta, inverse = false, class: className }: Props = $props();

	let good = $derived(delta.trend === 'flat' ? null : (delta.trend === 'up') !== inverse);
	let label = $derived(
		delta.pct === null ? (delta.trend === 'flat' ? '0%' : 'nuevo') : formatPct(Math.abs(delta.pct))
	);
</script>

<span
	class={cn(
		'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
		good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
		className
	)}
	aria-label={`Variación ${delta.trend === 'up' ? 'al alza' : delta.trend === 'down' ? 'a la baja' : 'estable'} ${label}`}
>
	{#if delta.trend === 'up'}
		<ArrowUpRight size={13} strokeWidth={2.25} />
	{:else if delta.trend === 'down'}
		<ArrowDownRight size={13} strokeWidth={2.25} />
	{:else}
		<Minus size={13} strokeWidth={2.25} />
	{/if}
	{label}
</span>
