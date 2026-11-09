<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Trash2, Power } from '@lucide/svelte';
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
	import { formatCOP, formatNumber } from '$lib/utils/format';
	import { PORCIONES_POR_MASA } from '$lib/features/shifts/domain/close-shift';

	let { data, form } = $props();
	type Sabor = (typeof data.sabores)[number];

	let open = $state(false);
	let editing = $state<Sabor | null>(null);
	let nombre = $state('');
	let precioPorcion = $state('');
	let precioRueda = $state('');
	function openForm(s: Sabor | null) {
		editing = s;
		nombre = s?.nombre ?? '';
		precioPorcion = s ? String(Number(s.precioPorcion ?? 0)) : '';
		precioRueda = s && Number(s.precioRueda) > 0 ? String(Number(s.precioRueda)) : '';
		open = true;
	}

	const columns: Column<Sabor>[] = [
		{ id: 'nombre', header: 'Sabor', accessor: (s) => s.nombre },
		{ id: 'porcion', header: 'Porción', accessor: (s) => Number(s.precioPorcion ?? 0), format: (v) => formatCOP(Number(v)), align: 'right' },
		{ id: 'rueda', header: 'Pizza entera', accessor: (s) => Number(s.precioRueda ?? 0), format: (v) => (Number(v) > 0 ? formatCOP(Number(v)) : '—'), align: 'right', hideOnMobile: true },
		{ id: 'vendidas', header: 'Porciones vendidas', accessor: (s) => s.vendidas, format: (v) => formatNumber(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'estado', header: 'Estado', accessor: (s) => (s.activo ? 1 : 0) },
		{ id: 'acciones', header: '', accessor: () => null, sortable: false, align: 'right' }
	];
</script>

<svelte:head><title>Sabores · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6">
	<PageHeader title="Sabores de pizza" description="El precio por porción se usa para calcular la venta esperada en el cierre de turno y el ranking de ventas.">
		{#snippet actions()}
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => openForm(null)}><Plus size={15} /> Nuevo sabor</button>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />
	<Card>
		<DataTable rows={data.sabores} {columns} rowKey={(s) => s.id} initialSort={{ id: 'nombre', dir: 'asc' }} searchPlaceholder="Buscar sabor…" emptyTitle="Sin sabores">
			{#snippet cell(s, col)}
				{#if col.id === 'estado'}
					<Badge variant={s.activo ? 'success' : 'outline'}>{s.activo ? 'Activo' : 'Inactivo'}</Badge>
				{:else if col.id === 'acciones'}
					<div class="flex justify-end">
						<button type="button" class={cn(btn.base, btn.icon)} aria-label={`Editar ${s.nombre}`} onclick={() => openForm(s)}><Pencil size={14} /></button>
						<form method="POST" action="?/toggle" use:enhance>
							<input type="hidden" name="id" value={s.id} />
							<button class={cn(btn.base, btn.icon)} aria-label={s.activo ? `Desactivar ${s.nombre}` : `Activar ${s.nombre}`} title={s.activo ? 'Desactivar' : 'Activar'}><Power size={14} /></button>
						</form>
						<form method="POST" action="?/delete" use:enhance={({ cancel }) => { if (!confirm(`¿Eliminar "${s.nombre}"?`)) cancel(); }}>
							<input type="hidden" name="id" value={s.id} />
							<button class={cn(btn.base, btn.icon, 'hover:text-danger')} aria-label={`Eliminar ${s.nombre}`} disabled={s.vendidas > 0} title={s.vendidas > 0 ? 'Tiene ventas: desactívalo' : 'Eliminar'}><Trash2 size={14} /></button>
						</form>
					</div>
				{:else if col.id === 'nombre'}
					<span class="font-medium {s.activo ? '' : 'text-muted-foreground'}">{s.nombre}</span>
				{:else}
					{col.format ? col.format(col.accessor(s), s) : col.accessor(s)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>

<Dialog bind:open title={editing ? 'Editar sabor' : 'Nuevo sabor'} size="sm">
	<form id="sabor-form" method="POST" action={editing ? '?/update' : '?/create'} class="flex flex-col gap-4" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') open = false; }}>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label="Nombre" for="s-nombre"><input id="s-nombre" name="nombre" bind:value={nombre} required maxlength="60" class={inputClass} /></Field>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Precio por porción" for="s-porcion"><input id="s-porcion" name="precioPorcion" type="number" min="1" step="100" bind:value={precioPorcion} required class={inputClass} /></Field>
			<Field label="Pizza entera" for="s-rueda" hint={Number(precioPorcion) > 0 && !precioRueda ? `Por defecto ${formatCOP(Number(precioPorcion) * PORCIONES_POR_MASA)}` : 'Opcional'}>
				<input id="s-rueda" name="precioRueda" type="number" min="0" step="100" bind:value={precioRueda} class={inputClass} />
			</Field>
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.outline)} onclick={() => (open = false)}>Cancelar</button>
		<button type="submit" form="sabor-form" class={cn(btn.base, btn.primary)}>Guardar</button>
	{/snippet}
</Dialog>
