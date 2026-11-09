<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Trash2, Tags } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, selectClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP } from '$lib/utils/format';
	import { formatFraction } from '$lib/utils/fractions';

	let { data, form } = $props();
	type Prod = (typeof data.products)[number];

	const UNIDAD_LABEL: Record<string, string> = {
		unidad: 'Unidad',
		fraccion: 'Fracción (1/4, 1/2…)',
		kilo: 'Kilogramo',
		libra: 'Libra',
		litro: 'Litro',
		pechuga: 'Pechuga / presa',
		bulto: 'Bulto',
		paquete: 'Paquete'
	};

	let categoriaFiltro = $state<number | 0>(0);
	let rows = $derived(categoriaFiltro ? data.products.filter((p) => p.categoriaId === categoriaFiltro) : data.products);

	let open = $state(false);
	let editing = $state<Prod | null>(null);
	let f = $state({ nombre: '', categoriaId: '' as number | '', unidadMedida: 'unidad', stockMinimo: '5', precio: '' });
	function openForm(p: Prod | null) {
		editing = p;
		f = p
			? { nombre: p.nombre, categoriaId: p.categoriaId ?? '', unidadMedida: p.unidadMedida, stockMinimo: String(p.stockMinimo ?? 0), precio: Number(p.precio) > 0 ? String(Number(p.precio)) : '' }
			: { nombre: '', categoriaId: '', unidadMedida: 'unidad', stockMinimo: '5', precio: '' };
		open = true;
	}

	const columns: Column<Prod>[] = [
		{ id: 'nombre', header: 'Producto', accessor: (p) => p.nombre },
		{ id: 'cat', header: 'Categoría', accessor: (p) => p.categoriaNombre ?? '', format: (v) => (v ? String(v) : '—'), hideOnMobile: true },
		{ id: 'unidad', header: 'Unidad', accessor: (p) => p.unidadMedida, format: (v) => UNIDAD_LABEL[String(v)] ?? String(v), hideOnMobile: true },
		{ id: 'stock', header: 'Stock / mín.', accessor: (p) => p.stockActual ?? 0, align: 'right' },
		{ id: 'costo', header: 'Costo prom.', accessor: (p) => Number(p.precioCosto ?? 0), format: (v) => (Number(v) > 0 ? formatCOP(Number(v)) : '—'), align: 'right', hideOnMobile: true },
		{ id: 'precio', header: 'Precio venta', accessor: (p) => Number(p.precio ?? 0), format: (v) => (Number(v) > 0 ? formatCOP(Number(v)) : '—'), align: 'right', hideOnMobile: true },
		{ id: 'acciones', header: '', accessor: () => null, sortable: false, align: 'right' }
	];
</script>

<svelte:head><title>Productos · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6">
	<PageHeader title="Productos e insumos" description="Catálogo de lo que entra a bodega. El stock y el costo promedio se actualizan desde Bodega.">
		{#snippet actions()}
			<a href="/configuracion/categorias" class={cn(btn.base, btn.outline)}><Tags size={15} /> Categorías</a>
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => openForm(null)}><Plus size={15} /> Nuevo producto</button>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />
	<Card>
		<DataTable {rows} {columns} rowKey={(p) => p.id} initialSort={{ id: 'nombre', dir: 'asc' }} searchPlaceholder="Buscar producto…" emptyTitle="Sin productos">
			{#snippet toolbar()}
				<select bind:value={categoriaFiltro} aria-label="Filtrar por categoría" class="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm">
					<option value={0}>Todas las categorías</option>
					{#each data.categorias as c (c.id)}<option value={c.id}>{c.nombre}</option>{/each}
				</select>
			{/snippet}
			{#snippet cell(p, col)}
				{#if col.id === 'stock'}
					{@const bajo = (p.stockActual ?? 0) <= (p.stockMinimo ?? 0)}
					<span class={bajo ? 'font-medium text-danger' : ''}>{formatFraction(p.stockActual ?? 0)}</span>
					<span class="text-xs text-muted-foreground">/ {formatFraction(p.stockMinimo ?? 0)}</span>
					{#if bajo}<Badge variant="danger" class="ml-1">Bajo</Badge>{/if}
				{:else if col.id === 'acciones'}
					<div class="flex justify-end">
						<button type="button" class={cn(btn.base, btn.icon)} aria-label={`Editar ${p.nombre}`} onclick={() => openForm(p)}><Pencil size={14} /></button>
						<form method="POST" action="?/delete" use:enhance={({ cancel }) => { if (!confirm(`¿Eliminar "${p.nombre}"?`)) cancel(); }}>
							<input type="hidden" name="id" value={p.id} />
							<button class={cn(btn.base, btn.icon, 'hover:text-danger')} aria-label={`Eliminar ${p.nombre}`}><Trash2 size={14} /></button>
						</form>
					</div>
				{:else if col.id === 'nombre'}
					<span class="font-medium">{p.nombre}</span>
				{:else}
					{col.format ? col.format(col.accessor(p), p) : col.accessor(p)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>

<Dialog bind:open title={editing ? 'Editar producto' : 'Nuevo producto'}>
	<form id="prod-form" method="POST" action={editing ? '?/update' : '?/create'} class="grid gap-4 sm:grid-cols-2" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') open = false; }}>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label="Nombre" for="p-nombre" class="sm:col-span-2"><input id="p-nombre" name="nombre" bind:value={f.nombre} required maxlength="80" class={inputClass} /></Field>
		<Field label="Categoría" for="p-cat">
			<select id="p-cat" name="categoriaId" bind:value={f.categoriaId} class={selectClass}>
				<option value="">Sin categoría</option>
				{#each data.categorias as c (c.id)}<option value={c.id}>{c.nombre}</option>{/each}
			</select>
		</Field>
		<Field label="Unidad de medida" for="p-unidad">
			<select id="p-unidad" name="unidadMedida" bind:value={f.unidadMedida} class={selectClass}>
				{#each data.unidades as u (u)}<option value={u}>{UNIDAD_LABEL[u] ?? u}</option>{/each}
			</select>
		</Field>
		<Field label="Stock mínimo" for="p-min" hint="Por debajo de esto se genera una alerta"><input id="p-min" name="stockMinimo" type="number" min="0" step="0.25" bind:value={f.stockMinimo} required class={inputClass} /></Field>
		<Field label="Precio de venta" for="p-precio" hint="Solo si se vende directo (bebidas)"><input id="p-precio" name="precio" type="number" min="0" step="100" bind:value={f.precio} placeholder="0" class={inputClass} /></Field>
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.outline)} onclick={() => (open = false)}>Cancelar</button>
		<button type="submit" form="prod-form" class={cn(btn.base, btn.primary)}>Guardar</button>
	{/snippet}
</Dialog>
