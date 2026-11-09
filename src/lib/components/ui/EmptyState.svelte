<script lang="ts">
	import type { Component } from 'svelte';
	interface Props {
		icon?: Component<{ size?: number; class?: string }>;
		title: string;
		description?: string;
	}
	let { icon: Icon, title, description }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center px-4 py-10 text-center">
	{#if Icon}
		<div class="mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted">
			<Icon size={18} class="text-muted-foreground" />
		</div>
	{/if}
	<p class="text-sm font-medium">{title}</p>
	{#if description}<p class="mt-1 max-w-xs text-[13px] text-muted-foreground">{description}</p>{/if}
</div>
