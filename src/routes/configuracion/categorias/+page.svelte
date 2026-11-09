<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Trash2 } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';

	let { data, form } = $props();
	type Cat = (typeof data.categorias)[number];

	let open = $state(false);
	let editing = $state<Cat | null>(null);
	let nombre = $state('');
	function openForm(c: Cat | null) {
		editing = c;
		nombre = c?.nombre ?? '';
		open = true;
	}

	const columns: Column<Cat>[] = [
		{ id: 'nombre', header: 'Categoría', accessor: (c) => c.nombre },
		{ id: 'productos', header: 'Productos', accessor: (c) => c.productos, align: 'right' },
		{ id: 'acciones', header: '', accessor: () => null, sortable: false, align: 'right' }
	];
</script>

<svelte:head><title>Categorías · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6">
	<PageHeader title="Categorías" description="Agrupa los insumos de bodega (lácteos, cárnicos, bebidas…).">
		{#snippet actions()}
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => openForm(null)}><Plus size={15} /> Nueva categoría</button>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />
	<Card>
		<DataTable rows={data.categorias} {columns} rowKey={(c) => c.id} initialSort={{ id: 'nombre', dir: 'asc' }} searchPlaceholder="Buscar categoría…" emptyTitle="Sin categorías">
			{#snippet cell(c, col)}
				{#if col.id === 'acciones'}
					<div class="flex justify-end">
						<button type="button" class={cn(btn.base, btn.icon)} aria-label={`Editar ${c.nombre}`} onclick={() => openForm(c)}><Pencil size={14} /></button>
						<form method="POST" action="?/delete" use:enhance={({ cancel }) => { if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) cancel(); }}>
							<input type="hidden" name="id" value={c.id} />
							<button class={cn(btn.base, btn.icon, 'hover:text-danger')} aria-label={`Eliminar ${c.nombre}`} disabled={c.productos > 0} title={c.productos > 0 ? 'Tiene productos asignados' : 'Eliminar'}><Trash2 size={14} /></button>
						</form>
					</div>
				{:else if col.id === 'productos'}
					<Badge variant={c.productos > 0 ? 'neutral' : 'outline'}>{c.productos}</Badge>
				{:else}
					<span class="font-medium">{c.nombre}</span>
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>

<Dialog bind:open title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm">
	<form id="cat-form" method="POST" action={editing ? '?/update' : '?/create'} use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') open = false; }}>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label="Nombre" for="cat-nombre">
			<input id="cat-nombre" name="nombre" bind:value={nombre} required maxlength="60" class={inputClass} />
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.outline)} onclick={() => (open = false)}>Cancelar</button>
		<button type="submit" form="cat-form" class={cn(btn.base, btn.primary)}>Guardar</button>
	{/snippet}
</Dialog>
