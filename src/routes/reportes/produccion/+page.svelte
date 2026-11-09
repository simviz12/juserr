<script lang="ts">
	import { goto } from '$app/navigation';
	import { CalendarRange, Layers, Pizza, Flame, Percent, Download } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatNumber, formatPct } from '$lib/utils/format';
	import { exportExcel } from '$lib/utils/export';
	import { PORCIONES_POR_MASA } from '$lib/features/shifts/domain/close-shift';

	let { data } = $props();
	const dayLabel = (k: string) => formatDate(k + 'T12:00:00-05:00');

	let inicio = $state('');
	let fin = $state('');
	$effect.pre(() => {
		inicio = data.inicio;
		fin = data.fin;
	});

	let t = $derived(data.totales);
	let tasaMerma = $derived(t.vendidas + t.mermas > 0 ? t.mermas / (t.vendidas + t.mermas) : null);
	// Rendimiento: porciones vendidas por masa usada (ideal = 8)
	let rendimiento = $derived(t.masas > 0 ? t.vendidas / t.masas : null);
	let max = $derived(Math.max(1, ...data.produccion.map((d) => d.vendidas + d.mermas)));

	type Dia = (typeof data.produccion)[number];
	const columns: Column<Dia>[] = [
		{ id: 'fecha', header: 'Día', accessor: (d) => d.fecha, format: (v) => dayLabel(String(v)) },
		{ id: 'turnos', header: 'Turnos', accessor: (d) => d.turnos, align: 'right', hideOnMobile: true },
		{ id: 'masas', header: 'Masas usadas', accessor: (d) => d.masas, format: (v) => formatNumber(Number(v)), align: 'right' },
		{ id: 'vendidas', header: 'Vendidas', accessor: (d) => d.vendidas, align: 'right' },
		{ id: 'mermas', header: 'Mermas', accessor: (d) => d.mermas, align: 'right' },
		{ id: 'rend', header: 'Porc./masa', accessor: (d) => (d.masas > 0 ? d.vendidas / d.masas : 0), format: (v) => (Number(v) > 0 ? formatNumber(Number(v)) : '—'), align: 'right', hideOnMobile: true }
	];

	async function exportar() {
		await exportExcel(`MesaCapital_Produccion_${data.inicio}_a_${data.fin}`, [
			{ name: 'Producción', rows: data.produccion.map((d) => ({ Día: d.fecha, Turnos: d.turnos, 'Masas usadas': d.masas, Vendidas: d.vendidas, Mermas: d.mermas })) }
		]);
	}
</script>

<svelte:head><title>Producción · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6">
	<PageHeader title="Producción" description="Masas usadas, porciones vendidas y desperdicio por día.">
		{#snippet actions()}
			<div class="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 shadow-sm">
				<CalendarRange size={15} class="text-muted-foreground" />
				<input type="date" bind:value={inicio} aria-label="Desde" class="bg-transparent text-[13px] outline-none dark:[color-scheme:dark]" />
				<span class="text-muted-foreground">–</span>
				<input type="date" bind:value={fin} aria-label="Hasta" class="bg-transparent text-[13px] outline-none dark:[color-scheme:dark]" />
			</div>
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => goto(`?inicio=${inicio}&fin=${fin}`, { noScroll: true, keepFocus: true })}>Aplicar</button>
			<button type="button" class={cn(btn.base, btn.outline)} onclick={exportar} disabled={data.produccion.length === 0}><Download size={15} /> Excel</button>
		{/snippet}
	</PageHeader>

	{#if data.produccion.length === 0}
		<Card><EmptyState icon={Layers} title="Sin turnos en este rango" /></Card>
	{:else}
		<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatTile label="Masas usadas" value={formatNumber(t.masas)} icon={Layers} />
			<StatTile label="Porciones vendidas" value={formatNumber(t.vendidas)} icon={Pizza} />
			<StatTile label="Mermas" value={formatNumber(t.mermas)} icon={Flame} hint={`Tasa ${formatPct(tasaMerma)}`} tone={tasaMerma !== null && tasaMerma > 0.05 ? 'warning' : 'default'} />
			<StatTile label="Rendimiento" value={rendimiento === null ? '—' : `${formatNumber(rendimiento)} porc./masa`} icon={Percent} hint={`Ideal: ${PORCIONES_POR_MASA}`} tone={rendimiento !== null && rendimiento < PORCIONES_POR_MASA * 0.9 ? 'warning' : 'default'} />
		</section>

		<Card title="Porciones por día" description="Vendidas y mermas">
			<ul class="flex h-56 items-end gap-1.5 overflow-x-auto pb-6 custom-scrollbar" aria-label="Porciones por día">
				{#each data.produccion as d (d.fecha)}
					<li class="group relative flex h-full min-w-6 flex-1 flex-col justify-end" title={`${dayLabel(d.fecha)}: ${d.vendidas} vendidas, ${d.mermas} mermas`}>
						<div class="flex w-full flex-col gap-[2px]">
							{#if d.mermas > 0}<div class="w-full rounded-t-[3px] bg-series-2" style="height:{(d.mermas / max) * 190}px"></div>{/if}
							<div class="w-full bg-series-1 {d.mermas > 0 ? '' : 'rounded-t-[3px]'}" style="height:{(d.vendidas / max) * 190}px"></div>
						</div>
						<span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground">{Number(d.fecha.slice(8))}</span>
					</li>
				{/each}
			</ul>
			<div class="mt-2 flex gap-4 text-xs text-muted-foreground">
				<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-[3px] bg-series-1"></span>Vendidas</span>
				<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-[3px] bg-series-2"></span>Mermas</span>
			</div>
		</Card>

		<Card title="Detalle diario">
			<DataTable rows={data.produccion} {columns} rowKey={(d) => d.fecha} initialSort={{ id: 'fecha', dir: 'desc' }} searchPlaceholder="Buscar día…" />
		</Card>
	{/if}
</div>
