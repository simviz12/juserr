<script lang="ts">
	import { goto } from '$app/navigation';
	import { page, navigating } from '$app/state';
	import {
		Banknote,
		Wallet,
		Receipt,
		ReceiptText,
		CalendarDays,
		X,
		Table2,
		ChartColumn,
		Flame,
		Pizza
	} from '@lucide/svelte';
	import KpiCard from '$lib/components/ui/KpiCard.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import CashflowChart from '$lib/components/charts/CashflowChart.svelte';
	import PaymentMixCard from '$lib/features/finance/components/PaymentMixCard.svelte';
	import FoodCostCard from '$lib/features/finance/components/FoodCostCard.svelte';
	import TopProductsCard from '$lib/features/finance/components/TopProductsCard.svelte';
	import StockAlertsCard from '$lib/features/finance/components/StockAlertsCard.svelte';
	import ShiftsTable from '$lib/features/finance/components/ShiftsTable.svelte';
	import SalesByLineCard from '$lib/features/finance/components/SalesByLineCard.svelte';
	import { businessDayKey, type RangeType } from '$lib/features/finance/domain/period';
	import { formatCOP, formatDate, formatNumber, formatPct } from '$lib/utils/format';

	let { data } = $props();

	const RANGES: { value: RangeType; label: string }[] = [
		{ value: 'diario', label: 'Hoy' },
		{ value: 'semanal', label: 'Semana' },
		{ value: 'mensual', label: 'Mes' },
		{ value: 'anual', label: 'Año' }
	];
	const COMPARISON: Record<RangeType, string> = {
		diario: 'vs. ayer',
		semanal: 'vs. semana anterior',
		mensual: 'vs. mes anterior',
		anual: 'vs. año anterior'
	};

	let fecha = $state('');
	$effect.pre(() => {
		fecha = data.range.dateKey;
	});

	// Skeletons mientras se recalcula el mismo dashboard (cambio de período/fecha)
	let loading = $derived(navigating.to?.url.pathname === '/dashboard');
	let showTable = $state(false);

	let s = $derived(data.summary);
	let cmp = $derived(COMPARISON[data.range.type] + (data.range.partial ? ' (mismo tramo)' : ''));
	let pasado = $derived(data.cashflow.filter((p) => !p.future));
	let sparkVentas = $derived(pasado.map((p) => p.efectivo + p.transferencias));
	let sparkNeto = $derived(pasado.map((p) => p.neto));
	let periodLabel = $derived.by(() => {
		// Fechas por día de negocio (la jornada termina a las 04:00 del día siguiente)
		const day = (iso: string) => formatDate(businessDayKey(iso) + 'T12:00:00-05:00');
		const lastDay = new Date(new Date(data.range.end).getTime() - 1).toISOString();
		return data.range.type === 'diario'
			? day(data.range.start)
			: `${day(data.range.start)} – ${day(lastDay)}`;
	});

	function navigate(params: { rango?: RangeType; fecha?: string }) {
		const q = new URLSearchParams(page.url.searchParams);
		if (params.rango) q.set('rango', params.rango);
		if (params.fecha !== undefined) {
			if (params.fecha) q.set('fecha', params.fecha);
			else q.delete('fecha');
		}
		goto(`?${q}`, { keepFocus: true, noScroll: true, replaceState: true });
	}
</script>

<svelte:head><title>Dashboard · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-6">
	<!-- Encabezado + filtros (una sola fila sobre los gráficos) -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<p class="text-[13px] text-muted-foreground">{periodLabel}</p>
			<h1 class="text-2xl font-semibold tracking-tight">Resumen financiero</h1>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<SegmentedControl label="Período" options={RANGES} value={data.range.type} onchange={(v) => navigate({ rango: v })} />
			<div class="flex h-9 items-center gap-2 rounded-md border border-input bg-card pr-1 pl-3 shadow-sm">
				<CalendarDays size={15} class="text-muted-foreground" />
				<label class="sr-only" for="ref-date">Fecha de referencia</label>
				<input
					id="ref-date"
					type="date"
					bind:value={fecha}
					onchange={() => navigate({ fecha })}
					class="bg-transparent text-[13px] outline-none dark:[color-scheme:dark]"
				/>
				{#if fecha}
					<button
						type="button"
						class="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
						onclick={() => navigate({ fecha: '' })}
						aria-label="Volver a hoy"><X size={14} /></button
					>
				{/if}
			</div>
		</div>
	</div>

	<!-- KPIs principales -->
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores clave">
		<KpiCard
			label="Ventas brutas"
			icon={Wallet}
			value={formatCOP(s.ventasBrutas)}
			delta={data.deltas.ventas}
			comparison={cmp}
			spark={sparkVentas}
			{loading}
		/>
		<KpiCard
			label="Utilidad neta"
			icon={Banknote}
			value={formatCOP(s.utilidadNeta)}
			delta={data.deltas.utilidad}
			comparison={cmp}
			spark={sparkNeto}
			{loading}
		>
			{#snippet footer()}
				{#if s.margen !== null}
					<Badge variant={s.margen < 0 ? 'danger' : 'outline'}>Margen {formatPct(s.margen)}</Badge>
				{/if}
			{/snippet}
		</KpiCard>
		<KpiCard
			label="Gastos operativos"
			icon={Receipt}
			value={formatCOP(s.gastos)}
			delta={data.deltas.gastos}
			inverse
			comparison={cmp}
			{loading}
		/>
		<KpiCard
			label="Ticket promedio por turno"
			icon={ReceiptText}
			value={s.ticketPorTurno === null ? '—' : formatCOP(s.ticketPorTurno)}
			delta={data.deltas.ticket}
			comparison={`${s.turnos} ${s.turnos === 1 ? 'turno' : 'turnos'}`}
			{loading}
		/>
	</section>

	<!-- Flujo de caja + mezcla de cobro -->
	<section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
		<Card
			class="xl:col-span-2"
			title="Flujo de caja"
			description={data.range.type === 'diario' ? 'Últimos 7 días' : data.range.type === 'anual' ? 'Por mes' : 'Por día'}
		>
			{#snippet actions()}
				<button
					type="button"
					onclick={() => (showTable = !showTable)}
					class="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
					aria-pressed={showTable}
				>
					{#if showTable}<ChartColumn size={14} /> Gráfico{:else}<Table2 size={14} /> Tabla{/if}
				</button>
			{/snippet}
			{#if loading}
				<Skeleton class="h-72 w-full" />
			{:else}
				<CashflowChart data={data.cashflow} {showTable} />
			{/if}
		</Card>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
			<PaymentMixCard summary={s} {loading} />
			<FoodCostCard summary={s} status={data.foodCostStatus} delta={data.deltas.foodCost} {loading} />
		</div>
	</section>

	<!-- Operación -->
	<section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card title="Producción" description="Porciones y desperdicio">
			{#if loading}
				<Skeleton class="h-24 w-full" />
			{:else}
				<dl class="grid grid-cols-2 gap-4">
					<div>
						<dt class="flex items-center gap-1.5 text-xs text-muted-foreground"><Pizza size={13} /> Vendidas</dt>
						<dd class="mt-1 text-xl font-semibold tabular-nums">{formatNumber(s.porciones)}</dd>
					</div>
					<div>
						<dt class="flex items-center gap-1.5 text-xs text-muted-foreground"><Flame size={13} /> Mermas</dt>
						<dd class="mt-1 text-xl font-semibold tabular-nums">{formatNumber(s.mermas)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Tasa de merma</dt>
						<dd class="mt-1 flex items-center gap-2 text-sm font-medium tabular-nums">
							{formatPct(s.tasaMerma)}
							{#if s.tasaMerma !== null && s.tasaMerma > 0.05}<Badge variant="warning">Alta</Badge>{/if}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Masas en bodega</dt>
						<dd class="mt-1 text-sm font-medium tabular-nums">{formatNumber(data.stockMasa)}</dd>
					</div>
				</dl>
			{/if}
		</Card>
		<SalesByLineCard lineas={data.ventasPorLinea} {loading} />
		<TopProductsCard items={data.topSabores} {loading} />
		<StockAlertsCard items={data.lowStock} {loading} />
	</section>

	<!-- Transacciones -->
	<Card title="Cierres de turno" description="Detalle de los turnos del período">
		<ShiftsTable rows={data.transactions} {loading} />
	</Card>
</div>
