<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, Inbox } from '@lucide/svelte';
	import Skeleton from '../ui/Skeleton.svelte';
	import EmptyState from '../ui/EmptyState.svelte';
	import type { Column, SortDir } from './types';
	import { cn } from '$lib/utils/cn';

	interface Props {
		rows: T[];
		columns: Column<T>[];
		rowKey: (row: T) => string | number;
		searchPlaceholder?: string;
		pageSizes?: number[];
		loading?: boolean;
		emptyTitle?: string;
		emptyDescription?: string;
		initialSort?: { id: string; dir: SortDir };
		/** Filtros extra (selects, chips) que se pintan junto al buscador. */
		toolbar?: Snippet;
		cell?: Snippet<[T, Column<T>]>;
	}

	let {
		rows,
		columns,
		rowKey,
		searchPlaceholder = 'Buscar…',
		pageSizes = [10, 25, 50],
		loading = false,
		emptyTitle = 'Sin resultados',
		emptyDescription,
		initialSort,
		toolbar,
		cell
	}: Props = $props();

	let query = $state('');
	let sortId = $state<string | null>(null);
	let sortDir = $state<SortDir>('desc');
	let pageSize = $state(10);
	let pageIndex = $state(0);

	$effect.pre(() => {
		if (sortId === null && initialSort) {
			sortId = initialSort.id;
			sortDir = initialSort.dir;
		}
	});

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) =>
			columns.some((c) => {
				const raw = c.accessor(r);
				const shown = c.format ? c.format(raw, r) : String(raw ?? '');
				return shown.toLowerCase().includes(q) || String(raw ?? '').toLowerCase().includes(q);
			})
		);
	});

	let sorted = $derived.by(() => {
		const col = columns.find((c) => c.id === sortId);
		if (!col) return filtered;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...filtered].sort((a, b) => {
			const va = col.accessor(a);
			const vb = col.accessor(b);
			if (va === vb) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			return (va < vb ? -1 : 1) * dir;
		});
	});

	let pageCount = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
	let page = $derived(sorted.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize));

	// Volver a la primera página cuando cambian filtros o tamaño.
	$effect(() => {
		void query;
		void pageSize;
		void rows;
		pageIndex = 0;
	});

	function toggleSort(id: string) {
		if (sortId === id) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortId = id;
			sortDir = 'desc';
		}
	}

	const display = (c: Column<T>, r: T) => {
		const v = c.accessor(r);
		return c.format ? c.format(v, r) : String(v ?? '—');
	};
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<label class="relative w-full sm:max-w-xs">
			<span class="sr-only">Buscar</span>
			<Search size={15} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
			<input
				type="search"
				bind:value={query}
				placeholder={searchPlaceholder}
				class="h-9 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
			/>
		</label>
		{#if toolbar}<div class="flex flex-wrap items-center gap-2">{@render toolbar()}</div>{/if}
	</div>

	<div class="overflow-x-auto rounded-md border border-border custom-scrollbar">
		<table class="w-full text-sm">
			<thead class="bg-muted/60 text-left">
				<tr class="border-b border-border">
					{#each columns as c (c.id)}
						<th
							scope="col"
							aria-sort={sortId === c.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
							class={cn(
								'h-10 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground',
								c.align === 'right' && 'text-right',
								c.hideOnMobile && 'hidden md:table-cell'
							)}
						>
							{#if c.sortable !== false}
								<button
									type="button"
									onclick={() => toggleSort(c.id)}
									class={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground', c.align === 'right' && 'flex-row-reverse')}
								>
									{c.header}
									{#if sortId === c.id}
										{#if sortDir === 'asc'}<ArrowUp size={12} />{:else}<ArrowDown size={12} />{/if}
									{:else}
										<ChevronsUpDown size={12} class="opacity-50" />
									{/if}
								</button>
							{:else}
								{c.header}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if loading}
					{#each Array(5) as _, i (i)}
						<tr class="border-b border-border last:border-0">
							{#each columns as c (c.id)}
								<td class={cn('px-3 py-3', c.hideOnMobile && 'hidden md:table-cell')}><Skeleton class="h-4 w-full max-w-28" /></td>
							{/each}
						</tr>
					{/each}
				{:else if page.length === 0}
					<tr>
						<td colspan={columns.length}>
							<EmptyState icon={Inbox} title={emptyTitle} description={query ? `Nada coincide con “${query}”.` : emptyDescription} />
						</td>
					</tr>
				{:else}
					{#each page as row (rowKey(row))}
						<tr class="border-b border-border transition-colors last:border-0 hover:bg-muted/50">
							{#each columns as c (c.id)}
								<td
									class={cn(
										'px-3 py-2.5 whitespace-nowrap',
										c.align === 'right' && 'text-right tabular-nums',
										c.hideOnMobile && 'hidden md:table-cell'
									)}
								>
									{#if cell}{@render cell(row, c)}{:else}{display(c, row)}{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="flex flex-col-reverse items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
		<p class="tabular-nums">
			{sorted.length === 0
				? '0 registros'
				: `${pageIndex * pageSize + 1}–${Math.min(sorted.length, (pageIndex + 1) * pageSize)} de ${sorted.length}`}
		</p>
		<div class="flex items-center gap-3">
			<label class="flex items-center gap-2">
				Filas
				<select bind:value={pageSize} class="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground">
					{#each pageSizes as s (s)}<option value={s}>{s}</option>{/each}
				</select>
			</label>
			<span class="tabular-nums">Pág. {pageIndex + 1} / {pageCount}</span>
			<div class="flex gap-1">
				<button
					type="button"
					class="grid h-8 w-8 place-items-center rounded-md border border-input bg-card text-foreground disabled:opacity-40"
					disabled={pageIndex === 0}
					onclick={() => (pageIndex -= 1)}
					aria-label="Página anterior"><ChevronLeft size={15} /></button
				>
				<button
					type="button"
					class="grid h-8 w-8 place-items-center rounded-md border border-input bg-card text-foreground disabled:opacity-40"
					disabled={pageIndex >= pageCount - 1}
					onclick={() => (pageIndex += 1)}
					aria-label="Página siguiente"><ChevronRight size={15} /></button
				>
			</div>
		</div>
	</div>
</div>
