<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { LockKeyhole, LoaderCircle, CircleCheck, Banknote, Smartphone, Receipt, ClipboardList } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate } from '$lib/utils/format';
	import { businessDayKey } from '$lib/features/finance/domain/period';

	let { data, form } = $props();

	let p = $derived(data.preview);
	let loading = $derived(navigating.to?.url.pathname === '/finanzas/caja');
	let submitting = $state(false);
	let fecha = $state('');
	$effect.pre(() => {
		fecha = p.dayKey;
	});
	const hoy = businessDayKey(new Date());
	const dayLabel = (k: string) => formatDate(k + 'T12:00:00-05:00');

	type Cierre = (typeof data.ultimosCierres)[number];
	const money = (v: string | number | null) => formatCOP(Number(v ?? 0));
	const columns: Column<Cierre>[] = [
		{ id: 'fecha', header: 'Día', accessor: (c) => (c.fecha ? c.fecha.slice(0, 10) : ''), format: (v) => (v ? dayLabel(String(v)) : '—') },
		{ id: 'efectivo', header: 'Efectivo', accessor: (c) => c.efectivo, format: money, align: 'right' },
		{ id: 'nequi', header: 'Nequi', accessor: (c) => c.transferencias, format: money, align: 'right', hideOnMobile: true },
		{ id: 'gastos', header: 'Gastos', accessor: (c) => c.gastos, format: money, align: 'right', hideOnMobile: true },
		{ id: 'total', header: 'Total', accessor: (c) => c.efectivo + c.transferencias, format: money, align: 'right' }
	];
</script>

<div class="flex flex-col gap-6">
	<FormFeedback {form} />

	<div class="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
		<Card title="Cerrar caja del día" description="Consolida todos los turnos de una jornada en un cierre diario.">
			<form
				method="POST"
				class="flex flex-col gap-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<Field label="Jornada" for="fecha" hint="De 04:00 a 04:00 del día siguiente">
					<input id="fecha" name="fecha" type="date" max={hoy} bind:value={fecha} onchange={() => goto(`?fecha=${fecha}`, { keepFocus: true, noScroll: true, replaceState: true })} required class={inputClass} />
				</Field>
				{#if p.yaCerrado}
					<Badge variant="success" class="self-start"><CircleCheck size={12} /> Este día ya está cerrado</Badge>
				{/if}
				<button type="submit" class={cn(btn.base, btn.primary)} disabled={submitting || loading || p.yaCerrado || (p.turnos === 0 && p.gastos === 0)}>
					{#if submitting}<LoaderCircle size={15} class="animate-spin" />{:else}<LockKeyhole size={15} />{/if}
					Cerrar caja del {dayLabel(p.dayKey)}
				</button>
				{#if !p.yaCerrado && p.turnos === 0 && p.gastos === 0 && !loading}
					<p class="text-xs text-muted-foreground">No hay movimientos en esta jornada.</p>
				{/if}
			</form>
		</Card>

		<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
			{#if loading}
				{#each Array(4) as _, i (i)}<Skeleton class="h-[92px]" />{/each}
			{:else}
				<StatTile label="Turnos" value={String(p.turnos)} icon={ClipboardList} hint={dayLabel(p.dayKey)} />
				<StatTile label="Efectivo" value={formatCOP(p.efectivo)} icon={Banknote} />
				<StatTile label="Nequi" value={formatCOP(p.transferencias)} icon={Smartphone} />
				<StatTile label="Gastos" value={formatCOP(p.gastos)} icon={Receipt} hint={`Total ventas ${formatCOP(p.efectivo + p.transferencias)}`} />
			{/if}
		</div>
	</div>

	<Card title="Cierres registrados" description="Últimos 30 días cerrados.">
		<DataTable rows={data.ultimosCierres} {columns} rowKey={(c) => c.id} initialSort={{ id: 'fecha', dir: 'desc' }} emptyTitle="Aún no hay cierres" searchPlaceholder="Buscar…" />
	</Card>
</div>
