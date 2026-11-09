<script lang="ts">
	import { enhance } from '$app/forms';
	import { Pizza, Flame, Sandwich, Layers, Beef, UtensilsCrossed, Plus, Pencil, Trash2, Pause, Play, Save, LoaderCircle } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { inputClass, selectClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { LINE_TOGGLES, RUBROS, itemEconomics } from '$lib/features/business/domain/lines';
	import { FOOD_COST_TARGET, foodCostStatus } from '$lib/features/finance/domain/metrics';
	import { formatCOP, formatNumber, formatPct } from '$lib/utils/format';

	let { data, form } = $props();

	const ICONS = { pizza: Pizza, chuzo: Flame, burger: Sandwich, lasana: Layers, carne: Beef } as const;
	const iconFor = (codigo: string) => ICONS[codigo as keyof typeof ICONS] ?? UtensilsCrossed;

	// Estado del formulario de ajustes (se reinicia cuando llegan datos nuevos)
	let nombreNegocio = $state('');
	let rubroPrincipal = $state('mixto');
	let flags = $state<Record<string, boolean>>({});
	$effect.pre(() => {
		nombreNegocio = data.config.nombreNegocio;
		rubroPrincipal = data.config.rubroPrincipal;
		flags = Object.fromEntries(LINE_TOGGLES.map((t) => [t.field, Boolean(data.config[t.field] ?? true)]));
	});
	let dirty = $derived(
		nombreNegocio !== data.config.nombreNegocio ||
			rubroPrincipal !== data.config.rubroPrincipal ||
			LINE_TOGGLES.some((t) => flags[t.field] !== Boolean(data.config[t.field] ?? true))
	);
	let saving = $state(false);

	// Diálogo de plato
	type Item = (typeof data.items)[number];
	let dialogOpen = $state(false);
	let editing = $state<Item | null>(null);
	let lineaId = $state(0);
	let nombre = $state('');
	let precioVenta = $state('');
	let precioCosto = $state('');
	let unidadesControl = $state('1');
	let preview = $derived(itemEconomics(Number(precioVenta) || 0, Number(precioCosto) || 0));
	let lineaDialog = $derived(data.lineas.find((l) => l.id === lineaId));
	const controlDe = (productoId: number | null) => data.insumos.find((p) => p.id === productoId);

	function openNew(id: number) {
		editing = null;
		lineaId = id;
		nombre = '';
		precioVenta = '';
		precioCosto = '';
		unidadesControl = '1';
		dialogOpen = true;
	}
	function openEdit(item: Item) {
		editing = item;
		lineaId = item.lineaId;
		nombre = item.nombre;
		precioVenta = String(Number(item.precioVenta));
		precioCosto = String(Number(item.precioCosto ?? 0));
		unidadesControl = String(Number(item.unidadesControl ?? 1));
		dialogOpen = true;
	}

	const fcVariant = (fc: number | null) => {
		const s = foodCostStatus(fc);
		return s === 'saludable' ? 'success' : s === 'vigilar' ? 'warning' : s === 'riesgo' ? 'danger' : 'neutral';
	};
</script>

<svelte:head><title>Líneas y combos · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6">
	<PageHeader
		title="Líneas y combos"
		description="Define qué vende tu negocio y el costo de cada plato. Estos ajustes cambian el menú lateral, los reportes y el cierre de turno."
	/>

	<FormFeedback {form} />

	<!-- Ajustes del negocio -->
	<form
		method="POST"
		action="?/actualizarRubros"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		<Card title="Identidad del negocio" description="El nombre aparece en el menú lateral, en los reportes PDF y en el reporte de cierre por WhatsApp.">
			{#snippet actions()}
				<button type="submit" class={cn(btn.base, btn.primary)} disabled={!dirty || saving}>
					{#if saving}<LoaderCircle size={15} class="animate-spin" />{:else}<Save size={15} />{/if}
					{dirty ? 'Guardar ajustes' : 'Guardado'}
				</button>
			{/snippet}

			<div class="grid gap-4 md:grid-cols-2">
				<Field label="Nombre comercial" for="nombre_negocio">
					<input id="nombre_negocio" name="nombre_negocio" bind:value={nombreNegocio} required maxlength="80" class={inputClass} />
				</Field>
				<Field label="Tipo de negocio" for="rubro_principal" hint="Ajusta los textos del cierre de turno (p. ej. 'pinchos' en vez de 'porciones').">
					<select id="rubro_principal" name="rubro_principal" bind:value={rubroPrincipal} class={selectClass}>
						{#each RUBROS as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
					</select>
				</Field>
			</div>

			<div class="mt-6">
				<p class="text-sm font-medium">Líneas activas</p>
				<p class="text-xs text-muted-foreground">Una línea apagada se oculta del catálogo. Apagar Pizzas también oculta la conciliación de pizzas en el cierre de turno.</p>
				<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each LINE_TOGGLES as t (t.field)}
						{@const Icon = iconFor(t.codigo)}
						<li
							class="flex flex-col gap-2 rounded-lg border p-3 transition-colors {flags[t.field]
								? 'border-border bg-card'
								: 'border-dashed border-border bg-muted/40 opacity-70'}"
						>
							<!-- Ícono, nombre e interruptor arriba; la descripción usa todo el ancho (legible en móvil) -->
							<div class="flex items-center gap-3">
								<span class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted"><Icon size={16} /></span>
								<p class="min-w-0 flex-1 text-sm font-medium">{t.label}</p>
								<Switch name={t.form} label={`Activar ${t.label}`} bind:checked={flags[t.field]} />
							</div>
							<p class="text-xs text-muted-foreground">{t.description}</p>
						</li>
					{/each}
				</ul>
			</div>
		</Card>
	</form>

	<!-- Catálogo -->
	<div>
		<h2 class="text-lg font-semibold tracking-tight">Menú y costeo</h2>
		<p class="text-sm text-muted-foreground">
			Precio de venta y costo de insumos por plato. El food cost ideal está entre {formatPct(FOOD_COST_TARGET.ideal, 0)} y {formatPct(FOOD_COST_TARGET.max, 0)}.
		</p>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		{#each data.lineas as linea (linea.id)}
			{@const Icon = iconFor(linea.codigo)}
			{@const items = data.items.filter((i) => i.lineaId === linea.id)}
			{@const activos = items.filter((i) => i.activo)}
			{@const avgFc = activos.length
				? activos.reduce((a, i) => a + (itemEconomics(Number(i.precioVenta), Number(i.precioCosto ?? 0)).foodCost ?? 0), 0) / activos.length
				: null}
			<Card class={linea.activo ? '' : 'opacity-60'} bodyClass="p-0">
				<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
					<div class="flex min-w-0 items-center gap-3">
						<span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted"><Icon size={17} /></span>
						<div class="min-w-0">
							<h3 class="truncate text-sm font-semibold">{linea.nombre}</h3>
							<p class="text-xs text-muted-foreground">
								{items.length} {items.length === 1 ? 'plato' : 'platos'} · unidad: {linea.unidadPorcion}
								{#if avgFc !== null}· food cost prom. {formatPct(avgFc, 0)}{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if !linea.activo}<Badge variant="outline">Inactiva</Badge>{/if}
						<button type="button" class={cn(btn.base, btn.outline, btn.sm)} onclick={() => openNew(linea.id)} disabled={!linea.activo}>
							<Plus size={14} /> Plato
						</button>
					</div>
				</header>

				{#if linea.codigo !== 'pizza' && linea.activo}
					{@const control = controlDe(linea.productoControlId)}
					<form method="POST" action="?/actualizarControl" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs sm:px-5">
						<input type="hidden" name="linea_id" value={linea.id} />
						<span class="text-muted-foreground">En el cierre se cuenta:</span>
						<select
							name="producto_control_id"
							value={linea.productoControlId ?? ''}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
							aria-label={`Insumo de control de ${linea.nombre}`}
							class="h-7 min-w-36 max-w-full flex-1 rounded border border-input bg-card px-2 text-xs sm:flex-none"
						>
							{#each data.insumos as p (p.id)}<option value={p.id}>{p.nombre}</option>{/each}
						</select>
						{#if control}
							<span class="ml-auto text-muted-foreground tabular-nums">En bodega: <span class="font-medium text-foreground">{formatNumber(control.stock ?? 0)}</span></span>
						{/if}
					</form>
				{/if}

				{#if items.length === 0}
					<EmptyState icon={Icon} title="Sin platos" description={linea.activo ? 'Agrega el primero con el botón “Plato”.' : 'Activa la línea para agregar platos.'} />
				{:else}
					<ul class="divide-y divide-border">
						{#each items as item (item.id)}
							{@const venta = Number(item.precioVenta)}
							{@const eco = itemEconomics(venta, Number(item.precioCosto ?? 0))}
							<li class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:flex-nowrap sm:px-5 {item.activo ? '' : 'opacity-50'}">
								<div class="min-w-0 flex-1 basis-full sm:basis-auto">
									<p class="truncate text-sm font-medium">{item.nombre}{#if !item.activo}<span class="ml-2 text-xs font-normal text-muted-foreground">(pausado)</span>{/if}</p>
									<p class="text-xs text-muted-foreground tabular-nums">Costo {formatCOP(Number(item.precioCosto ?? 0))} · margen {formatCOP(eco.margen)}</p>
								</div>
								<Badge variant={fcVariant(eco.foodCost)}>{formatPct(eco.foodCost, 0)}</Badge>
								<span class="ml-auto text-right text-sm font-semibold tabular-nums sm:ml-0 sm:w-20">{formatCOP(venta)}</span>
								<div class="flex">
									<button type="button" class={cn(btn.base, btn.icon)} aria-label={`Editar ${item.nombre}`} onclick={() => openEdit(item)}><Pencil size={14} /></button>
									<form method="POST" action="?/toggleItem" use:enhance>
										<input type="hidden" name="id" value={item.id} />
										<button class={cn(btn.base, btn.icon)} aria-label={item.activo ? `Pausar ${item.nombre}` : `Reactivar ${item.nombre}`} title={item.activo ? 'Pausar' : 'Reactivar'}>
											{#if item.activo}<Pause size={14} />{:else}<Play size={14} />{/if}
										</button>
									</form>
									<form
										method="POST"
										action="?/eliminarItem"
										use:enhance={({ cancel }) => {
											if (!confirm(`¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`)) cancel();
										}}
									>
										<input type="hidden" name="id" value={item.id} />
										<button class={cn(btn.base, btn.icon, 'hover:text-danger')} aria-label={`Eliminar ${item.nombre}`} title="Eliminar"><Trash2 size={14} /></button>
									</form>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		{/each}
	</div>
</div>

<Dialog bind:open={dialogOpen} title={editing ? 'Editar plato' : 'Nuevo plato'} description={data.lineas.find((l) => l.id === lineaId)?.nombre}>
	<form
		id="item-form"
		method="POST"
		action={editing ? '?/actualizarItem' : '?/crearItem'}
		class="flex flex-col gap-4"
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') dialogOpen = false;
			}}
	>
		<input type="hidden" name="linea_id" value={lineaId} />
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label="Nombre" for="item-nombre">
			<input id="item-nombre" name="nombre" bind:value={nombre} required maxlength="120" placeholder="Ej: Hamburguesa doble queso + papas" class={inputClass} />
		</Field>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Precio de venta" for="item-venta">
				<input id="item-venta" name="precio_venta" type="number" min="1" step="100" bind:value={precioVenta} required class={inputClass} />
			</Field>
			<Field label="Costo de insumos" for="item-costo">
				<input id="item-costo" name="precio_costo" type="number" min="0" step="100" bind:value={precioCosto} class={inputClass} />
			</Field>
		</div>
		{#if lineaDialog && lineaDialog.codigo !== 'pizza'}
			{@const control = controlDe(lineaDialog.productoControlId)}
			<Field
				label={`¿Cuántos “${control?.nombre ?? 'insumo de control'}” usa una venta?`}
				for="item-unidades"
				hint="Normalmente 1. Ej: un combo doble que lleva 2 panes = 2. Así el cierre sabe cuántas ventas salieron de lo contado."
			>
				<input id="item-unidades" name="unidades_control" type="number" min="0.25" max="50" step="0.25" bind:value={unidadesControl} required class={cn(inputClass, 'w-28')} />
			</Field>
		{:else}
			<input type="hidden" name="unidades_control" value="1" />
		{/if}
		{#if Number(precioVenta) > 0}
			<div class="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
				<span class="text-muted-foreground">Margen <span class="font-medium text-foreground tabular-nums">{formatCOP(preview.margen)}</span></span>
				<Badge variant={fcVariant(preview.foodCost)}>Food cost {formatPct(preview.foodCost, 0)}</Badge>
			</div>
		{/if}
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.outline)} onclick={() => (dialogOpen = false)}>Cancelar</button>
		<button type="submit" form="item-form" class={cn(btn.base, btn.primary)}>{editing ? 'Guardar cambios' : 'Agregar plato'}</button>
	{/snippet}
</Dialog>
