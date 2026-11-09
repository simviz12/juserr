<script lang="ts">
	import { CircleCheck, CircleAlert, Info, TriangleAlert } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Variant = 'success' | 'danger' | 'warning' | 'info';
	interface Props {
		variant?: Variant;
		title?: string;
		class?: string;
		children?: Snippet;
	}
	let { variant = 'info', title, class: className, children }: Props = $props();

	const styles: Record<Variant, string> = {
		success: 'border-success/30 bg-success-soft text-success',
		danger: 'border-danger/30 bg-danger-soft text-danger',
		warning: 'border-warning/30 bg-warning-soft text-warning',
		info: 'border-border bg-muted text-foreground'
	};
	const icons = { success: CircleCheck, danger: CircleAlert, warning: TriangleAlert, info: Info };
	let Icon = $derived(icons[variant]);
</script>

<div
	role={variant === 'danger' ? 'alert' : 'status'}
	class={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', styles[variant], className)}
	in:fly={{ y: -4, duration: 180 }}
>
	<Icon size={16} class="mt-0.5 shrink-0" />
	<div class="min-w-0">
		{#if title}<p class="font-medium">{title}</p>{/if}
		{#if children}<div class={title ? 'mt-0.5 opacity-90' : ''}>{@render children()}</div>{/if}
	</div>
</div>
