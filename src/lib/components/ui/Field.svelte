<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	interface Props {
		label: string;
		for?: string;
		hint?: string;
		error?: string;
		class?: string;
		children: Snippet;
	}
	let { label, for: htmlFor, hint, error, class: className, children }: Props = $props();
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	<label for={htmlFor} class="text-sm font-medium">{label}</label>
	{@render children()}
	{#if error}
		<p class="text-xs text-danger">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
