<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, Clock, Lock, Sparkles } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';

	let { data, form } = $props();
	let enviando = $state<string | null>(null);
	let pedido = $derived(data.modulos.find((m) => m.codigo === data.bloqueado));
</script>

<svelte:head><title>Módulos · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6">
	<PageHeader
		title="Módulos adicionales"
		description="Amplía MesaCapital con lo que tu restaurante necesita. Cada módulo se suma a tu mensualidad y lo puedes cancelar cuando quieras."
	/>

	{#if pedido && !pedido.activo}
		<Alert variant="warning" title={`"${pedido.nombre}" no está incluido en tu plan`}
			>Solicítalo aquí y lo activamos el mismo día hábil.</Alert
		>
	{/if}
	<FormFeedback {form} />

	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.modulos as m (m.codigo)}
			<article
				class={cn(
					'flex flex-col rounded-lg border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
					m.codigo === data.bloqueado && !m.activo
						? 'border-warning/60 ring-2 ring-warning/20'
						: 'border-border'
				)}
			>
				<div class="flex items-start justify-between gap-2">
					<div>
						<h2 class="font-semibold tracking-tight">{m.nombre}</h2>
						{#if m.exclusivo}<p
								class="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand"
							>
								<Sparkles size={11} /> Hecho para tu restaurante
							</p>{/if}
					</div>
					{#if m.activo}<Badge variant="success"><CircleCheck size={11} /> Activo</Badge>
					{:else if m.solicitado}<Badge variant="warning"><Clock size={11} /> Solicitado</Badge>
					{:else}<Badge variant="outline"><Lock size={11} /> No incluido</Badge>{/if}
				</div>
				<p class="mt-2 flex-1 text-sm text-muted-foreground">{m.descripcion}</p>
				<p class="mt-4 text-xl font-semibold tabular-nums">
					{formatCOP(fromCents(m.precioMensualCents))}<span
						class="text-xs font-normal text-muted-foreground"
					>
						/mes</span
					>
				</p>
				{#if m.exclusivo && !m.activo}
					<p class="mt-4 text-xs text-muted-foreground">
						Esta función es exclusiva de tu restaurante. Renuévala desde Facturación.
					</p>
				{:else if !m.activo}
					<form
						method="POST"
						action="?/solicitar"
						class="mt-4"
						use:enhance={() => {
							enviando = m.codigo;
							return async ({ update }) => {
								await update();
								enviando = null;
							};
						}}
					>
						<input type="hidden" name="modulo" value={m.codigo} />
						<button
							type="submit"
							class={cn(btn.base, m.solicitado ? btn.outline : btn.primary, 'w-full')}
							disabled={m.solicitado || enviando !== null}
						>
							<Sparkles size={15} />{m.solicitado ? 'Solicitud enviada' : 'Solicitar activación'}
						</button>
					</form>
				{/if}
			</article>
		{/each}
	</section>
</div>
