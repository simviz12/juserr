<script lang="ts">
	/**
	 * Desglose (drill-down) de una línea del estado de resultados: los registros
	 * individuales que suman su importe. Los gastos de caja se pueden recategorizar
	 * y los registros manuales se pueden anular, sin salir del informe.
	 */
	import { enhance } from '$app/forms';
	import { Ban } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { btn, selectClass } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDateTime, formatDate } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';
	import type { Movimiento } from '$lib/features/finance/domain/income-statement';

	interface Props {
		movimientos: Movimiento[];
		/** Categoría de cada gasto (id de movimiento → categoría). */
		categorias: Record<string, { codigo: string; automatica: boolean }>;
		catalogo: { codigo: string; nombre: string }[];
		/** Query string del informe (para volver al mismo periodo si no hay JavaScript). */
		query: string;
	}
	let { movimientos, categorias, catalogo, query }: Props = $props();

	const PAGINA = 50;
	let verTodos = $state(false);
	let visibles = $derived(verTodos ? movimientos : movimientos.slice(0, PAGINA));
	let porConfirmar = $state<string | null>(null);
	let enviando = $state<string | null>(null);

	const nombreCategoria = (codigo: string) =>
		catalogo.find((c) => c.codigo === codigo)?.nombre ?? codigo;
	// Los registros manuales se guardan a mediodía: la hora no aporta, solo el día.
	const fecha = (m: Movimiento) =>
		m.origen === 'ajuste' ? formatDate(m.fecha) : formatDateTime(m.fecha);
	const accion = (nombre: string) => `?/${nombre}${query ? `&${query}` : ''}`;
</script>

<div class="rounded-md border border-border bg-card">
	<ul class="divide-y divide-border">
		{#each visibles as m (m.id)}
			{@const cat = categorias[m.id]}
			<li class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
				<div class="min-w-0 flex-1">
					<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span class="break-words">{m.concepto}</span>
						{#if m.origen === 'ajuste'}<Badge variant="outline">Manual</Badge>{/if}
					</p>
					<p class="text-xs text-muted-foreground">
						{fecha(m)}{#if m.detalle}&nbsp;· {m.detalle}{/if}
					</p>
				</div>

				<div class="flex items-center justify-between gap-3 sm:justify-end">
					{#if m.origen === 'gasto' && cat}
						<form
							method="POST"
							action={accion('categorizar')}
							use:enhance={() => {
								enviando = m.id;
								return async ({ update }) => {
									await update({ reset: false });
									enviando = null;
								};
							}}
						>
							<input type="hidden" name="id" value={m.refId} />
							<select
								name="categoria"
								aria-label="Categoría de {m.concepto}"
								class={cn(selectClass, 'h-8 w-48 text-xs')}
								disabled={enviando === m.id}
								value={cat.automatica ? '' : cat.codigo}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							>
								<option value="">Automática · {nombreCategoria(cat.codigo)}</option>
								{#each catalogo as c (c.codigo)}<option value={c.codigo}>{c.nombre}</option>{/each}
							</select>
							<noscript
								><button type="submit" class={cn(btn.base, btn.outline, btn.sm)}>Guardar</button
								></noscript
							>
						</form>
					{:else if m.origen === 'ajuste'}
						<form
							method="POST"
							action={accion('anular')}
							use:enhance={() => {
								enviando = m.id;
								return async ({ update }) => {
									await update();
									enviando = null;
									porConfirmar = null;
								};
							}}
						>
							<input type="hidden" name="id" value={m.refId} />
							{#if porConfirmar === m.id}
								<span class="flex items-center gap-1">
									<button
										type="submit"
										class={cn(btn.base, btn.danger, btn.sm)}
										disabled={enviando === m.id}>Sí, anular</button
									>
									<button
										type="button"
										class={cn(btn.base, btn.ghost, btn.sm)}
										onclick={() => (porConfirmar = null)}>No</button
									>
								</span>
							{:else}
								<button
									type="button"
									class={cn(btn.base, btn.ghost, btn.sm, 'text-muted-foreground hover:text-danger')}
									onclick={() => (porConfirmar = m.id)}
								>
									<Ban size={13} /> Anular
								</button>
							{/if}
						</form>
					{/if}
					<span class="shrink-0 text-sm font-medium tabular-nums"
						>{formatCOP(fromCents(m.cents))}</span
					>
				</div>
			</li>
		{/each}
	</ul>

	{#if movimientos.length > PAGINA}
		<div
			class="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground"
		>
			<span>Mostrando {visibles.length} de {movimientos.length} registros</span>
			<button
				type="button"
				class={cn(btn.base, btn.ghost, btn.sm)}
				onclick={() => (verTodos = !verTodos)}
			>
				{verTodos ? 'Ver menos' : 'Ver todos'}
			</button>
		</div>
	{/if}
</div>
