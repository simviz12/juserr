<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils/cn';
	interface Props {
		label: string;
		value: string;
		hint?: string;
		icon?: Component<{ size?: number; class?: string }>;
		tone?: 'default' | 'success' | 'danger' | 'warning';
		class?: string;
	}
	let { label, value, hint, icon: Icon, tone = 'default', class: className }: Props = $props();
	const tones = { default: '', success: 'text-success', danger: 'text-danger', warning: 'text-warning' };
</script>

<div class={cn('rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]', className)}>
	<div class="flex items-center justify-between gap-2">
		<p class="text-[13px] text-muted-foreground">{label}</p>
		{#if Icon}<Icon size={15} class="text-muted-foreground" />{/if}
	</div>
	<p class={cn('mt-2 text-xl font-semibold tracking-tight tabular-nums', tones[tone])}>{value}</p>
	{#if hint}<p class="mt-1 text-xs text-muted-foreground">{hint}</p>{/if}
</div>
