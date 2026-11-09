<script lang="ts">
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import type { TransactionRow } from '../server/dashboard.service';
	import { formatCOP, formatDateTime, formatNumber } from '$lib/utils/format';

	let { rows, loading = false }: { rows: TransactionRow[]; loading?: boolean } = $props();

	type Filter = 'todos' | 'con-gastos' | 'solo-efectivo' | 'con-transferencias';
	let filter = $state<Filter>('todos');

	let visible = $derived(
		rows.filter((r) =>
			filter === 'con-gastos'
				? r.gastos > 0
				: filter === 'solo-efectivo'
					? r.transferencias === 0
					: filter === 'con-transferencias'
						? r.transferencias > 0
						: true
		)
	);

	const money = (v: string | number | null) => formatCOP(Number(v ?? 0));

	const columns: Column<TransactionRow>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (r) => r.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'turno', header: 'Turno', accessor: (r) => r.id, format: (v) => `#${v}` },
		{ id: 'nota', header: 'Nota', accessor: (r) => r.descripcion ?? '', format: (v) => (v ? String(v) : '—'), sortable: false, hideOnMobile: true },
		{ id: 'efectivo', header: 'Efectivo', accessor: (r) => r.efectivo, format: money, align: 'right', hideOnMobile: true },
		{ id: 'transf', header: 'Transf.', accessor: (r) => r.transferencias, format: money, align: 'right', hideOnMobile: true },
		{ id: 'gastos', header: 'Gastos', accessor: (r) => r.gastos, format: money, align: 'right' },
		{ id: 'porciones', header: 'Porc.', accessor: (r) => r.porciones, format: (v) => formatNumber(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'total', header: 'Total', accessor: (r) => r.total, format: money, align: 'right' }
	];

	const filters: { value: Filter; label: string }[] = [
		{ value: 'todos', label: 'Todos' },
		{ value: 'con-transferencias', label: 'Con transferencias' },
		{ value: 'solo-efectivo', label: 'Solo efectivo' },
		{ value: 'con-gastos', label: 'Con gastos' }
	];
</script>

<DataTable
	rows={visible}
	{columns}
	{loading}
	rowKey={(r) => r.id}
	searchPlaceholder="Buscar turno, nota o monto…"
	initialSort={{ id: 'fecha', dir: 'desc' }}
	emptyTitle="Sin turnos en este período"
	emptyDescription="Los cierres de turno aparecerán aquí."
>
	{#snippet toolbar()}
		<label class="sr-only" for="shift-filter">Filtrar turnos</label>
		<select
			id="shift-filter"
			bind:value={filter}
			class="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm"
		>
			{#each filters as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
		</select>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.id === 'total'}
			<span class="font-medium">{money(row.total)}</span>
		{:else if col.id === 'gastos'}
			<span class={row.gastos > 0 ? 'text-danger' : 'text-muted-foreground'}>{row.gastos > 0 ? `−${money(row.gastos)}` : '—'}</span>
		{:else if col.id === 'nota'}
			<span class="block max-w-56 truncate text-muted-foreground" title={row.descripcion ?? ''}>{row.descripcion || '—'}</span>
		{:else}
			{col.format ? col.format(col.accessor(row), row) : col.accessor(row)}
		{/if}
	{/snippet}
</DataTable>
