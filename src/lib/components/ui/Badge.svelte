<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'outline';

	interface Props {
		variant?: BadgeVariant;
		class?: string;
		children: Snippet;
	}
	let { variant = 'neutral', class: className, children }: Props = $props();

	const variants: Record<BadgeVariant, string> = {
		neutral: 'bg-muted text-muted-foreground',
		success: 'bg-success-soft text-success',
		warning: 'bg-warning-soft text-warning',
		danger: 'bg-danger-soft text-danger',
		outline: 'border border-border text-muted-foreground'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
		variants[variant],
		className
	)}
>
	{@render children()}
</span>
