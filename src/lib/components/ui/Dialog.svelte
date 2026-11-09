<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
		footer?: Snippet;
	}
	let { open = $bindable(), title, description, size = 'md', children, footer }: Props = $props();

	const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
	const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;

	function onKey(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<div class="fixed inset-0 z-50 grid place-items-center p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
			aria-label="Cerrar"
			onclick={() => (open = false)}
			transition:fade={{ duration: 150 }}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			class="relative flex max-h-[90dvh] w-full {widths[size]} flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
			transition:scale={{ start: 0.96, duration: 180 }}
		>
			<header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div>
					<h2 id={titleId} class="text-base font-semibold tracking-tight">{title}</h2>
					{#if description}<p class="mt-0.5 text-sm text-muted-foreground">{description}</p>{/if}
				</div>
				<button
					type="button"
					class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label="Cerrar"
					onclick={() => (open = false)}><X size={16} /></button
				>
			</header>
			<div class="overflow-y-auto px-5 py-4 custom-scrollbar">{@render children()}</div>
			{#if footer}
				<footer class="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">{@render footer()}</footer>
			{/if}
		</div>
	</div>
{/if}
