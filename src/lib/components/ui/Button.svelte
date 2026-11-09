<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'icon';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		href?: string;
		children: Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		href,
		class: className,
		children,
		...rest
	}: Props = $props();

	const variants: Record<Variant, string> = {
		default: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
		secondary: 'bg-muted text-foreground hover:bg-accent',
		outline: 'border border-input bg-card hover:bg-accent text-foreground shadow-sm',
		ghost: 'hover:bg-accent text-foreground',
		danger: 'bg-danger text-white hover:opacity-90'
	};
	const sizes: Record<Size, string> = {
		sm: 'h-8 px-3 text-xs gap-1.5',
		md: 'h-9 px-4 text-sm gap-2',
		icon: 'h-9 w-9'
	};

	let classes = $derived(
		cn(
			'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
			variants[variant],
			sizes[size],
			className as string
		)
	);
</script>

{#if href}
	<a {href} class={classes}>{@render children()}</a>
{:else}
	<button class={classes} {...rest}>{@render children()}</button>
{/if}
