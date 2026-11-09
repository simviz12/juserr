<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		title: string;
		description?: string;
		eyebrow?: string;
		actions?: Snippet;
	}
	let { title, description, eyebrow, actions }: Props = $props();
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	<div class="min-w-0">
		{#if eyebrow}<p class="text-[13px] text-muted-foreground">{eyebrow}</p>{/if}
		<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
		{#if description}<p class="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</div>
