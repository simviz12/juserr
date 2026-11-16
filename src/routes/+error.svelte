<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head><title>{page.status} · MesaCapital</title></svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
	<p class="text-4xl font-semibold tabular-nums">{page.status}</p>
	<p class="mt-2 text-sm text-muted-foreground">
		{page.status === 404 ? 'La página que buscas no existe.' : page.error?.message}
	</p>
	{#if page.error?.errorId}
		<p class="mt-3 text-xs text-muted-foreground">
			Código de soporte: <code class="font-mono">{page.error.errorId}</code>
		</p>
	{/if}
	<div class="mt-6">
		<Button href={resolve('/')} variant="outline">Volver al inicio</Button>
	</div>
</div>
