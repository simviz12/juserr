<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Plus, Inbox } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';
	import { nombreModulo } from '$lib/modules/registry';

	let { data, form } = $props();
	const money = (c: number) => formatCOP(fromCents(c));
	const dia = (k: string | null) => (k ? formatDate(k + 'T12:00:00-05:00') : '—');

	const ESTADO = {
		'al-dia': { label: 'Al día', variant: 'success' },
		gracia: { label: 'En gracia', variant: 'warning' },
		'solo-lectura': { label: 'Solo lectura', variant: 'danger' },
		suspendido: { label: 'Suspendido', variant: 'danger' }
	} as const;

	let filtro = $state('');
	let lista = $derived(
		data.restaurantes.filter((r) => {
			const q = filtro.trim().toLowerCase();
			return !q || r.nombre.toLowerCase().includes(q) || r.codigo.includes(q);
		})
	);
</script>

<svelte:head><title>Restaurantes · Plataforma</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Restaurantes"
		description="Clientes de la plataforma, su plan y su estado de pago."
	>
		{#snippet actions()}
			<a href={resolve('/plataforma/restaurantes/nuevo')} class={cn(btn.base, btn.primary)}
				><Plus size={15} /> Nuevo restaurante</a
			>
		{/snippet}
	</PageHeader>

	<FormFeedback {form} />

	<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Restaurantes activos" value={String(data.resumen.activos)} />
		<StatTile label="Ingreso mensual (MRR)" value={money(data.resumen.mrrCents)} tone="success" />
		<StatTile
			label="Vencen en ≤ 5 días"
			value={String(data.resumen.porVencer)}
			tone={data.resumen.porVencer ? 'warning' : 'default'}
		/>
		<StatTile
			label="Vencidos"
			value={String(data.resumen.vencidos)}
			tone={data.resumen.vencidos ? 'danger' : 'default'}
		/>
	</section>

	{#if data.solicitudes.length}
		<Card
			title="Solicitudes de módulos"
			description="Pedidos hechos desde la página Módulos de cada restaurante."
		>
			<ul class="divide-y divide-border">
				{#each data.solicitudes as s (s.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
						<p class="text-sm">
							<span class="font-medium">{s.tenant}</span> pide
							<span class="font-medium">{s.nombreModulo}</span>
							<span class="text-xs text-muted-foreground">· {formatDate(s.createdAt)}</span>
						</p>
						<div class="flex gap-2">
							<a
								href={resolve('/plataforma/restaurantes/[id]', { id: String(s.tenantId) })}
								class={cn(btn.base, btn.outline, btn.sm)}>Atender</a
							>
							<form method="POST" action="?/descartar" use:enhance>
								<input type="hidden" name="id" value={s.id} />
								<button type="submit" class={cn(btn.base, btn.ghost, btn.sm)}>Descartar</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}

	<Card>
		<input
			type="search"
			bind:value={filtro}
			placeholder="Buscar por nombre o código…"
			aria-label="Buscar restaurante"
			class="mb-4 h-9 w-full rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
		/>
		{#if lista.length === 0}
			<EmptyState
				icon={Inbox}
				title="No hay restaurantes"
				description="Crea el primero con «Nuevo restaurante»."
			/>
		{:else}
			<div class="custom-scrollbar overflow-x-auto rounded-md border border-border">
				<table class="w-full text-sm">
					<thead class="bg-muted/60 text-left text-xs text-muted-foreground">
						<tr>
							<th class="h-10 px-3 font-medium">Restaurante</th>
							<th class="h-10 px-3 font-medium">Estado</th>
							<th class="hidden h-10 px-3 font-medium md:table-cell">Pagado hasta</th>
							<th class="hidden h-10 px-3 font-medium lg:table-cell">Módulos</th>
							<th class="h-10 px-3 text-right font-medium">Mensual</th>
						</tr>
					</thead>
					<tbody>
						{#each lista as r (r.id)}
							{@const e = ESTADO[r.estado === 'activo' ? r.estadoCore : 'suspendido']}
							<tr class="border-t border-border hover:bg-muted/40">
								<td class="px-3 py-2.5">
									<a
										href={resolve('/plataforma/restaurantes/[id]', { id: String(r.id) })}
										class="font-medium hover:underline">{r.nombre}</a
									>
									<span class="block text-xs text-muted-foreground"
										>{r.codigo} · {r.usuarios} usuario(s)</span
									>
								</td>
								<td class="px-3 py-2.5"
									><Badge variant={r.estado === 'cancelado' ? 'neutral' : e.variant}
										>{r.estado === 'cancelado' ? 'Cancelado' : e.label}</Badge
									></td
								>
								<td class="hidden px-3 py-2.5 whitespace-nowrap md:table-cell"
									>{dia(r.coreVigenteHasta)}</td
								>
								<td class="hidden px-3 py-2.5 text-xs lg:table-cell"
									>{r.modulos.map(nombreModulo).join(' · ')}</td
								>
								<td class="px-3 py-2.5 text-right tabular-nums">{money(r.mensualCents)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
