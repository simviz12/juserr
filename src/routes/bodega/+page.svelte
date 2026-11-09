<script lang="ts">
	import { enhance } from '$app/forms';
	import { Download, PackagePlus, ClipboardCheck, Boxes, TriangleAlert, Coins, LoaderCircle, CalendarDays, X } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, selectClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { parseFraction, formatFraction } from '$lib/utils/fractions';
	import { formatCOP, formatDateTime, formatNumber } from '$lib/utils/format';
	import { exportExcel, todayStamp } from '$lib/utils/export';
	import { businessDayKey } from '$lib/features/finance/domain/period';

	let { data, form } = $props();

	type Producto = (typeof data.productos)[number];
	type Movimiento = (typeof data.historialMovimientos)[number];

	// ── Resumen ───────────────────────────────────────────────
	const estado = (p: Producto) => {
		const s = p.stockActual ?? 0;
		return s <= 0 ? 'agotado' : s <= (p.stockMinimo ?? 0) ? 'bajo' : 'ok';
	};
	let valorInventario = $derived(data.productos.reduce((a, p) => a + Math.max(0, p.stockActual ?? 0) * Number(p.precioCosto ?? 0), 0));
	let criticos = $derived(data.productos.filter((p) => estado(p) !== 'ok').length);
	let agotados = $derived(data.productos.filter((p) => estado(p) === 'agotado').length);
	const fmtQty = (n: number | null | undefined) => formatFraction(Number(n ?? 0));

	// ── Formulario de movimiento ──────────────────────────────
	let tipo = $state<'entrada' | 'ajuste'>('entrada');
	let productoId = $state<number>(0);
	$effect.pre(() => {
		if (!data.productos.some((p) => p.id === productoId)) productoId = data.productos[0]?.id ?? 0;
	});
	let cantidad = $state('');
	let precioTotal = $state('');
	let submitting = $state(false);

	let seleccionado = $derived(data.productos.find((p) => p.id === Number(productoId)));
	let cantidadNum = $derived(parseFraction(cantidad));
	let cantidadValida = $derived(Number.isFinite(cantidadNum) && cantidadNum >= 0 && cantidad.trim() !== '');
	let stockResultante = $derived(
		!seleccionado || !cantidadValida ? null : tipo === 'entrada' ? (seleccionado.stockActual ?? 0) + cantidadNum : cantidadNum
	);
	let costoUnitario = $derived(cantidadValida && cantidadNum > 0 ? (Number(precioTotal) || 0) / cantidadNum : 0);

	function addFraction(frac: string) {
		const c = cantidad.trim();
		if (!c || c === '0') cantidad = frac;
		else if (!c.includes('/')) cantidad = `${c} ${frac}`;
	}

	function selectForCount(p: Producto) {
		productoId = p.id;
		tipo = 'ajuste';
		cantidad = '';
		document.getElementById('movimiento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ── Inventario ────────────────────────────────────────────
	let filtroEstado = $state<'todos' | 'criticos'>('todos');
	let inventario = $derived(filtroEstado === 'criticos' ? data.productos.filter((p) => estado(p) !== 'ok') : data.productos);
	const invColumns: Column<Producto>[] = [
		{ id: 'nombre', header: 'Insumo', accessor: (p) => p.nombre },
		{ id: 'categoria', header: 'Categoría', accessor: (p) => p.categoria ?? '', format: (v) => (v ? String(v) : '—'), hideOnMobile: true },
		{ id: 'stock', header: 'Stock', accessor: (p) => p.stockActual ?? 0, align: 'right' },
		{ id: 'minimo', header: 'Mínimo', accessor: (p) => p.stockMinimo ?? 0, format: (v) => fmtQty(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'costo', header: 'Costo prom.', accessor: (p) => Number(p.precioCosto ?? 0), format: (v) => formatCOP(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'estado', header: 'Estado', accessor: (p) => estado(p), sortable: false },
		{ id: 'acciones', header: '', accessor: () => null, sortable: false }
	];

	// ── Historial ─────────────────────────────────────────────
	let desde = $state('');
	let hasta = $state('');
	let tipoMov = $state<'todos' | 'entrada' | 'ajuste'>('todos');
	let historial = $derived(
		data.historialMovimientos.filter((m) => {
			if (tipoMov !== 'todos' && m.tipo !== tipoMov) return false;
			if (!m.fecha) return !desde && !hasta;
			const k = businessDayKey(m.fecha);
			return (!desde || k >= desde) && (!hasta || k <= hasta);
		})
	);
	let totalCompras = $derived(historial.reduce((a, m) => a + (m.tipo === 'entrada' ? Number(m.costoTotal ?? 0) : 0), 0));
	const histColumns: Column<Movimiento>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (m) => m.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'tipo', header: 'Tipo', accessor: (m) => m.tipo, sortable: false },
		{ id: 'insumo', header: 'Insumo', accessor: (m) => m.productoNombre },
		{ id: 'cantidad', header: 'Cantidad', accessor: (m) => m.cantidad, align: 'right' },
		{ id: 'unitario', header: 'Costo unit.', accessor: (m) => Number(m.costoUnitario ?? 0), align: 'right', hideOnMobile: true },
		{ id: 'total', header: 'Costo total', accessor: (m) => Number(m.costoTotal ?? 0), align: 'right' }
	];

	let exporting = $state(false);
	let exportMsg = $state('');
	async function exportar() {
		exporting = true;
		exportMsg = '';
		const ok = await exportExcel(`MesaCapital_Bodega_${todayStamp()}`, [
			{
				name: 'Inventario',
				rows: data.productos.map((p) => ({
					Insumo: p.nombre,
					Categoría: p.categoria ?? '',
					Unidad: p.unidadMedida,
					Stock: Number(p.stockActual ?? 0),
					Mínimo: Number(p.stockMinimo ?? 0),
					'Costo promedio': Number(p.precioCosto ?? 0),
					'Valor en bodega': Math.max(0, p.stockActual ?? 0) * Number(p.precioCosto ?? 0),
					Estado: estado(p)
				}))
			},
			{
				name: 'Movimientos',
				rows: historial.map((m) => ({
					Fecha: formatDateTime(m.fecha),
					Tipo: m.tipo === 'entrada' ? 'Compra' : 'Ajuste de conteo',
					Insumo: m.productoNombre,
					Unidad: m.unidadMedida,
					Cantidad: m.cantidad,
					'Costo unitario': Number(m.costoUnitario ?? 0),
					'Costo total': Number(m.costoTotal ?? 0)
				}))
			}
		]);
		exporting = false;
		if (!ok) exportMsg = 'No hay datos para exportar.';
	}
</script>

<svelte:head><title>Bodega · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6">
	<PageHeader title="Bodega e insumos" description="Registra compras, haz conteos físicos y controla el valor de tu inventario.">
		{#snippet actions()}
			<button type="button" class={cn(btn.base, btn.outline)} onclick={exportar} disabled={exporting}>
				{#if exporting}<LoaderCircle size={15} class="animate-spin" />{:else}<Download size={15} />{/if}
				Exportar Excel
			</button>
		{/snippet}
	</PageHeader>
	{#if exportMsg}<p class="-mt-3 text-sm text-muted-foreground">{exportMsg}</p>{/if}

	<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Insumos" value={formatNumber(data.productos.length)} icon={Boxes} />
		<StatTile label="Valor en bodega" value={formatCOP(valorInventario)} icon={Coins} hint="stock × costo promedio" />
		<StatTile label="Bajo mínimo" value={formatNumber(criticos)} icon={TriangleAlert} tone={criticos > 0 ? 'warning' : 'default'} />
		<StatTile label="Agotados" value={formatNumber(agotados)} icon={TriangleAlert} tone={agotados > 0 ? 'danger' : 'default'} />
	</section>

	<FormFeedback {form} />

	<!-- Movimiento -->
	<div id="movimiento" class="scroll-mt-20">
		<Card title="Registrar movimiento" description={tipo === 'entrada' ? 'Compra o pedido recibido: la cantidad se SUMA al stock y recalcula el costo promedio.' : 'Conteo físico: el stock queda EXACTAMENTE en la cantidad que cuentes.'}>
			{#snippet actions()}
				<SegmentedControl
					label="Tipo de movimiento"
					value={tipo}
					onchange={(v) => (tipo = v)}
					options={[
						{ value: 'entrada', label: 'Compra' },
						{ value: 'ajuste', label: 'Conteo físico' }
					]}
				/>
			{/snippet}

			<form
				method="POST"
				class="grid gap-4 md:grid-cols-3"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						await update({ reset: false });
						submitting = false;
						if (result.type === 'success') {
							cantidad = '';
							precioTotal = '';
						}
					};
				}}
			>
				<input type="hidden" name="tipo_operacion" value={tipo} />
				<input type="hidden" name="cantidad" value={cantidadValida ? cantidadNum : ''} />

				<Field label="Insumo" for="tipo_insumo" hint={seleccionado ? `En sistema: ${fmtQty(seleccionado.stockActual)} ${seleccionado.unidadMedida}` : undefined}>
					<select id="tipo_insumo" name="tipo_insumo" bind:value={productoId} class={selectClass}>
						{#each data.productos as p (p.id)}<option value={p.id}>{p.nombre} ({p.unidadMedida})</option>{/each}
					</select>
				</Field>

				<Field
					label={tipo === 'entrada' ? 'Cantidad comprada' : 'Cantidad contada'}
					for="cantidad"
					error={cantidad.trim() && !cantidadValida ? 'Usa un número o fracción: 6, 2.5, 3/4, 6 1/4' : undefined}
					hint={stockResultante !== null && seleccionado ? `Quedará en ${fmtQty(stockResultante)} ${seleccionado.unidadMedida}` : undefined}
				>
					<input id="cantidad" bind:value={cantidad} required inputmode="decimal" placeholder="Ej: 6 1/4" class={inputClass} />
					<div class="flex gap-1">
						{#each ['1/4', '1/2', '3/4'] as f (f)}
							<button type="button" class="h-6 rounded border border-border px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onclick={() => addFraction(f)}>+{f}</button>
						{/each}
					</div>
				</Field>

				{#if tipo === 'entrada'}
					<Field label="Costo total de la compra" for="precioTotalCompra" hint={costoUnitario > 0 && seleccionado ? `${formatCOP(costoUnitario)} por ${seleccionado.unidadMedida}` : 'Opcional, alimenta el food cost'}>
						<input id="precioTotalCompra" name="precioTotalCompra" type="number" min="0" step="100" bind:value={precioTotal} placeholder="0" class={inputClass} />
					</Field>
				{:else}
					<div class="hidden md:block"></div>
				{/if}

				<div class="flex justify-end md:col-span-3">
					<button type="submit" class={cn(btn.base, btn.primary)} disabled={submitting || !cantidadValida}>
						{#if submitting}<LoaderCircle size={15} class="animate-spin" />{:else if tipo === 'entrada'}<PackagePlus size={15} />{:else}<ClipboardCheck size={15} />{/if}
						{tipo === 'entrada' ? 'Registrar compra' : 'Guardar conteo'}
					</button>
				</div>
			</form>
		</Card>
	</div>

	<!-- Inventario -->
	<Card title="Inventario actual">
		<DataTable rows={inventario} columns={invColumns} rowKey={(p) => p.id} searchPlaceholder="Buscar insumo…" initialSort={{ id: 'nombre', dir: 'asc' }} emptyTitle="Sin insumos">
			{#snippet toolbar()}
				<SegmentedControl
					label="Filtrar inventario"
					value={filtroEstado}
					onchange={(v) => (filtroEstado = v)}
					options={[
						{ value: 'todos', label: 'Todos' },
						{ value: 'criticos', label: `Críticos (${criticos})` }
					]}
				/>
			{/snippet}
			{#snippet cell(p, c)}
				{#if c.id === 'stock'}
					<span class="font-medium">{fmtQty(p.stockActual)}</span> <span class="text-xs text-muted-foreground">{p.unidadMedida}</span>
				{:else if c.id === 'estado'}
					{@const e = estado(p)}
					<Badge variant={e === 'agotado' ? 'danger' : e === 'bajo' ? 'warning' : 'success'}>{e === 'agotado' ? 'Agotado' : e === 'bajo' ? 'Bajo' : 'OK'}</Badge>
				{:else if c.id === 'acciones'}
					<button type="button" class="text-xs font-medium text-muted-foreground hover:text-foreground" onclick={() => selectForCount(p)}>Contar</button>
				{:else}
					{c.format ? c.format(c.accessor(p), p) : c.accessor(p)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>

	<!-- Historial -->
	<Card title="Historial de movimientos" description={`Compras en la selección: ${formatCOP(totalCompras)}`}>
		<DataTable rows={historial} columns={histColumns} rowKey={(m) => m.id} searchPlaceholder="Buscar insumo…" initialSort={{ id: 'fecha', dir: 'desc' }} emptyTitle="Sin movimientos">
			{#snippet toolbar()}
				<select bind:value={tipoMov} class="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm" aria-label="Tipo de movimiento">
					<option value="todos">Todos</option>
					<option value="entrada">Compras</option>
					<option value="ajuste">Conteos</option>
				</select>
				<div class="flex h-9 w-full items-center gap-1.5 rounded-md border border-input bg-card px-2 shadow-sm sm:w-auto">
					<CalendarDays size={14} class="text-muted-foreground" />
					<input type="date" bind:value={desde} aria-label="Desde" class="min-w-0 flex-1 bg-transparent text-xs outline-none dark:[color-scheme:dark]" />
					<span class="text-muted-foreground">–</span>
					<input type="date" bind:value={hasta} aria-label="Hasta" class="min-w-0 flex-1 bg-transparent text-xs outline-none dark:[color-scheme:dark]" />
					{#if desde || hasta}
						<button type="button" class="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent" aria-label="Quitar fechas" onclick={() => { desde = ''; hasta = ''; }}><X size={13} /></button>
					{/if}
				</div>
			{/snippet}
			{#snippet cell(m, c)}
				{#if c.id === 'tipo'}
					<Badge variant={m.tipo === 'entrada' ? 'success' : 'neutral'}>{m.tipo === 'entrada' ? 'Compra' : 'Conteo'}</Badge>
				{:else if c.id === 'cantidad'}
					<span class={m.cantidad > 0 ? 'text-success' : m.cantidad < 0 ? 'text-danger' : ''}>{m.cantidad > 0 ? '+' : ''}{fmtQty(m.cantidad)}</span>
					<span class="text-xs text-muted-foreground">{m.unidadMedida}</span>
				{:else if c.id === 'unitario' || c.id === 'total'}
					{@const v = Number(c.accessor(m))}
					{v > 0 ? formatCOP(v) : '—'}
				{:else}
					{c.format ? c.format(c.accessor(m), m) : c.accessor(m)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>
