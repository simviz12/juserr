<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn, inputClass, textareaClass } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';

	let { data, form } = $props();
	const pesos = (c: number) => Math.round(c / 100).toLocaleString('es-CO');
</script>

<svelte:head><title>Catálogo · Plataforma</title></svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6">
	<PageHeader
		title="Catálogo y precios"
		description="Precios de lista mensuales. Cada restaurante conserva el precio pactado al contratar; cámbialo en su ficha si hace falta."
	/>
	<FormFeedback {form} />
	{#each data.modulos as m (m.codigo)}
		<Card>
			<form
				method="POST"
				action="?/guardar"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="grid gap-3 sm:grid-cols-[1fr_12rem]"
			>
				<input type="hidden" name="codigo" value={m.codigo} />
				<div class="flex flex-wrap items-center gap-2 sm:col-span-2">
					<h2 class="font-semibold">{m.nombre}</h2>
					<code class="text-xs text-muted-foreground">{m.codigo}</code>
					{#if m.esCore}<Badge variant="outline">Base</Badge>{/if}
				</div>
				<Field label="Descripción (la ve el cliente)" for="d-{m.codigo}"
					><textarea id="d-{m.codigo}" name="descripcion" class={textareaClass}
						>{m.descripcion}</textarea
					></Field
				>
				<div class="flex flex-col gap-3">
					<Field label="Precio mensual (COP)" for="p-{m.codigo}"
						><input
							id="p-{m.codigo}"
							name="precio"
							inputmode="decimal"
							value={pesos(m.precioMensualCents)}
							required
							class={inputClass}
						/></Field
					>
					{#if !m.esCore}<label class="flex items-center gap-2 text-sm"
							><input type="checkbox" name="publico" checked={m.publico} class="h-4 w-4" /> Visible para
							clientes</label
						>{:else}<input type="hidden" name="publico" value="on" />{/if}
					<button type="submit" class={cn(btn.base, btn.outline)}>Guardar</button>
				</div>
			</form>
		</Card>
	{/each}
</div>
