<script lang="ts" module>
	/** Fila del historial tal como la entrega el load de /turnos/cierre. */
	export interface TurnoHistorial {
		id: number;
		fecha: string | null;
		monto: string;
		transferencias: string | null;
		descripcion: string | null;
		porcionesVendidas: number | null;
		porcionesMermadas: number | null;
		totalGastos: number;
	}
</script>

<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { formatCOP, formatDateTime } from '$lib/utils/format';

	let { turnos }: { turnos: TurnoHistorial[] } = $props();

	type Turno = TurnoHistorial;
	const columns: Column<Turno>[] = [
		{
			id: 'fecha',
			header: 'Fecha',
			accessor: (t) => t.fecha,
			format: (v) => formatDateTime(v as string | null)
		},
		{ id: 'id', header: 'Turno', accessor: (t) => t.id, format: (v) => `#${v}` },
		{
			id: 'porciones',
			header: 'Vendidas',
			accessor: (t) => t.porcionesVendidas ?? 0,
			align: 'right',
			hideOnMobile: true
		},
		{
			id: 'mermas',
			header: 'Mermas',
			accessor: (t) => t.porcionesMermadas ?? 0,
			align: 'right',
			hideOnMobile: true
		},
		{
			id: 'efectivo',
			header: 'Efectivo',
			accessor: (t) => Number(t.monto),
			format: (v) => formatCOP(Number(v)),
			align: 'right',
			hideOnMobile: true
		},
		{
			id: 'nequi',
			header: 'Nequi',
			accessor: (t) => Number(t.transferencias ?? 0),
			format: (v) => formatCOP(Number(v)),
			align: 'right',
			hideOnMobile: true
		},
		{ id: 'gastos', header: 'Gastos', accessor: (t) => t.totalGastos, align: 'right' },
		{
			id: 'total',
			header: 'Total',
			accessor: (t) => Number(t.monto) + Number(t.transferencias ?? 0) + t.totalGastos,
			format: (v) => formatCOP(Number(v)),
			align: 'right'
		}
	];
</script>

<Card title="Últimos turnos" description="Los 20 cierres más recientes.">
	<DataTable
		rows={turnos}
		{columns}
		rowKey={(t) => t.id}
		searchPlaceholder="Buscar turno o nota…"
		initialSort={{ id: 'fecha', dir: 'desc' }}
		emptyTitle="Aún no hay turnos"
		emptyDescription="El primer cierre aparecerá aquí."
	>
		{#snippet cell(t, c)}
			{#if c.id === 'gastos'}
				<span class={t.totalGastos > 0 ? 'text-danger' : 'text-muted-foreground'}
					>{t.totalGastos > 0 ? `−${formatCOP(t.totalGastos)}` : '—'}</span
				>
			{:else if c.id === 'total'}
				<span class="font-medium">{c.format?.(c.accessor(t), t)}</span>
			{:else if c.id === 'fecha'}
				<span>{formatDateTime(t.fecha)}</span>
				{#if t.descripcion}<span
						class="block max-w-52 truncate text-xs text-muted-foreground"
						title={t.descripcion}>{t.descripcion}</span
					>{/if}
			{:else}
				{c.format ? c.format(c.accessor(t), t) : c.accessor(t)}
			{/if}
		{/snippet}
	</DataTable>
</Card>
