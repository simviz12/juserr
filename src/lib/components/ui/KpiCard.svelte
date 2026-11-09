<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { Delta } from '$lib/features/finance/domain/metrics';
	import Skeleton from './Skeleton.svelte';
	import TrendBadge from './TrendBadge.svelte';
	import Sparkline from './Sparkline.svelte';

	interface Props {
		label: string;
		value: string;
		icon?: Component<{ size?: number; class?: string }>;
		delta?: Delta;
		inverse?: boolean;
		/** Texto que acompaña a la variación, p. ej. "vs. ayer". */
		comparison?: string;
		spark?: number[];
		loading?: boolean;
		footer?: Snippet;
	}

	let { label, value, icon: Icon, delta, inverse, comparison, spark, loading = false, footer }: Props =
		$props();
</script>

<article
	class="group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-200 hover:shadow-md animate-slide-up"
>
	<div class="flex items-center justify-between gap-2">
		<p class="text-[13px] font-medium text-muted-foreground">{label}</p>
		{#if Icon}<Icon size={16} class="text-muted-foreground" />{/if}
	</div>

	{#if loading}
		<Skeleton class="h-8 w-36" />
		<Skeleton class="h-4 w-24" />
	{:else}
		<div class="flex items-end justify-between gap-3">
			<p class="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
			{#if spark && spark.length > 1}<Sparkline values={spark} />{/if}
		</div>
		<div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
			{#if delta}<TrendBadge {delta} {inverse} />{/if}
			{#if comparison}<span>{comparison}</span>{/if}
			{#if footer}{@render footer()}{/if}
		</div>
	{/if}
</article>
