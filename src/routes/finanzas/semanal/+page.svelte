<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { Scale, LoaderCircle, Banknote, Smartphone, Receipt, ClipboardList } from '@lucide/svelte';
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

	let { data, form } = $props();

	let loading = $derived(navigating.to?.url.pathname === '/finanzas/semanal');
	let submitting = $state(false);
	let desde = $state('');
	let hasta = $state('');
	let contado = $state('');
	$effect.pre(() => {
		desde = data.desde;
		hasta = data.hasta;
	});
	const dayLabel = (k: string | null) => (k ? formatDate(k + 'T12:00:00-05:00') : '—');

	let p = $derived(data.preview);
	let contadoNum = $derived(contado === '' ? null : parseFloat(contado));
	let diferencia = $derived(contadoNum === null || !Number.isFinite(contadoNum) ? null : contadoNum - p.efectivo);

	function previsualizar() {
		if (desde && hasta) goto(`?desde=${desde}&hasta=${hasta}`, { keepFocus: true, noScroll: true, replaceState: true });
	}

	type Corte = (typeof data.cortes)[number];
	const money = (v: string | number | null) => formatCOP(Number(v ?? 0));
	const columns: Column<Corte>[] = [
		{ id: 'fecha', header: 'Realizado', accessor: (c) => c.fechaCorte, format: (v) => (v ? formatDate(String(v)) : '—') },
		{ id: 'rango', header: 'Rango', accessor: (c) => c.desde, format: (_, c) => `${dayLabel(c.desde)} – ${dayLabel(c.hasta)}`, hideOnMobile: true },
		{ id: 'esperado', header: 'Esperado', accessor: (c) => c.esperado, format: money, align: 'right' },
		{ id: 'real', header: 'Contado', accessor: (c) => c.real, format: money, align: 'right' },
		{ id: 'diferencia', header: 'Diferencia', accessor: (c) => c.diferencia, align: 'right' }
	];
</script>

<div class="flex flex-col gap-6">
	<FormFeedback {form} />

	<div class="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
		<Card title="Nuevo corte de efectivo" description="Cuenta el efectivo guardado y compáralo con lo que registraron los turnos.">
			<form
				method="POST"
				class="flex flex-col gap-4"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						await update({ reset: false });
						submitting = false;
						if (result.type === 'success') contado = '';
					};
				}}
			>
				<div class="grid grid-cols-2 gap-3">
					<Field label="Desde" for="rangoInicio">
						<input id="rangoInicio" name="rangoInicio" type="date" bind:value={desde} onchange={previsualizar} required class={inputClass} />
					</Field>
					<Field label="Hasta" for="rangoFin">
						<input id="rangoFin" name="rangoFin" type="date" bind:value={hasta} onchange={previsualizar} required class={inputClass} />
					</Field>
				</div>
				<Field label="Efectivo contado" for="totalReal" hint="Todo el efectivo físico del período, contado a mano.">
					<input id="totalReal" name="totalReal" type="number" min="0" step="100" bind:value={contado} required placeholder="0" class={cn(inputClass, 'h-10 text-base tabular-nums')} />
				</Field>

				{#if diferencia !== null && !loading}
					<div class="flex items-center justify-between rounded-md bg-muted px-3 py-2.5 text-sm">
						<span class="text-muted-foreground">Diferencia</span>
						<span class="flex items-center gap-2">
							<span class="font-semibold tabular-nums {Math.abs(diferencia) < 1 ? 'text-success' : diferencia > 0 ? 'text-warning' : 'text-danger'}">{diferencia > 0 ? '+' : ''}{formatCOP(diferencia)}</span>
							<Badge variant={Math.abs(diferencia) < 1 ? 'success' : diferencia > 0 ? 'warning' : 'danger'}>{Math.abs(diferencia) < 1 ? 'Cuadra' : diferencia > 0 ? 'Sobrante' : 'Faltante'}</Badge>
						</span>
					</div>
				{/if}

				<button type="submit" class={cn(btn.base, btn.primary)} disabled={submitting || loading || contado === ''}>
					{#if submitting}<LoaderCircle size={15} class="animate-spin" />{:else}<Scale size={15} />{/if} Guardar corte
				</button>
			</form>
		</Card>

		<div class="flex flex-col gap-3">
			<p class="text-sm text-muted-foreground">Según los turnos del {dayLabel(data.desde)} al {dayLabel(data.hasta)}:</p>
			<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
				{#if loading}
					{#each Array(4) as _, i (i)}<Skeleton class="h-[92px]" />{/each}
				{:else}
					<StatTile label="Efectivo esperado" value={formatCOP(p.efectivo)} icon={Banknote} hint="Ya descontados los gastos" />
					<StatTile label="Turnos" value={String(p.turnos)} icon={ClipboardList} />
					<StatTile label="Nequi" value={formatCOP(p.transferencias)} icon={Smartphone} hint="No está en efectivo" />
					<StatTile label="Gastos pagados" value={formatCOP(p.gastos)} icon={Receipt} />
				{/if}
			</div>
		</div>
	</div>

	<Card title="Cortes anteriores">
		<DataTable rows={data.cortes} {columns} rowKey={(c) => c.id} initialSort={{ id: 'fecha', dir: 'desc' }} emptyTitle="Aún no hay cortes" searchPlaceholder="Buscar…">
			{#snippet cell(c, col)}
				{#if col.id === 'diferencia'}
					<span class="font-medium {Math.abs(c.diferencia) < 1 ? 'text-success' : c.diferencia > 0 ? 'text-warning' : 'text-danger'}">{c.diferencia > 0 ? '+' : ''}{formatCOP(c.diferencia)}</span>
				{:else}
					{col.format ? col.format(col.accessor(c), c) : col.accessor(c)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>
