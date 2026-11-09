<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Users, CalendarClock, CreditCard, LoaderCircle } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate } from '$lib/utils/format';

	let { data, form } = $props();

	type Ciclo = 'mensual' | 'trimestral' | 'anual';
	const DESCUENTO: Record<Ciclo, number> = { mensual: 1, trimestral: 0.91, anual: 0.833 };
	let ciclo = $state<Ciclo>('mensual');
	let sub = $derived(data.suscripcion);
	let actual = $derived(sub.planCodigo);
	let enviando = $state<string | null>(null);
	const precio = (mes: number) => Math.round(mes * DESCUENTO[ciclo]);
	let limite = $derived(sub.limiteUsuarios ?? 0);
	let usoPct = $derived(limite > 0 ? Math.min(1, data.conteoUsuarios / limite) : 0);
</script>

<svelte:head><title>Suscripción · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6">
	<PageHeader title="Suscripción" description="Tu plan actual, uso y opciones para crecer." />
	<FormFeedback {form} />

	<section class="grid gap-3 sm:grid-cols-3">
		<StatTile label="Plan actual" value={sub.planNombre} icon={CreditCard} hint={`${formatCOP(Number(sub.montoMensual))} / mes · ${sub.cicloFacturacion}`} />
		<StatTile
			label="Renovación"
			value={sub.diasRestantes === null ? '—' : `${sub.diasRestantes} días`}
			icon={CalendarClock}
			hint={sub.fechaRenovacion ? formatDate(sub.fechaRenovacion) : undefined}
			tone={sub.diasRestantes !== null && sub.diasRestantes <= 5 ? 'warning' : 'default'}
		/>
		<div class="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
			<div class="flex items-center justify-between"><p class="text-[13px] text-muted-foreground">Usuarios</p><Users size={15} class="text-muted-foreground" /></div>
			<p class="mt-2 text-xl font-semibold tabular-nums">{data.conteoUsuarios} <span class="text-sm font-normal text-muted-foreground">de {limite >= 99 ? 'ilimitados' : limite}</span></p>
			{#if limite < 99}
				<div class="mt-2 h-1.5 rounded-full bg-muted"><div class="h-full rounded-full {usoPct >= 1 ? 'bg-danger' : 'bg-brand'}" style="width:{usoPct * 100}%"></div></div>
			{/if}
		</div>
	</section>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Planes</h2>
		<SegmentedControl
			label="Ciclo de facturación"
			value={ciclo}
			onchange={(v) => (ciclo = v)}
			options={[
				{ value: 'mensual', label: 'Mensual' },
				{ value: 'trimestral', label: 'Trimestral −9%' },
				{ value: 'anual', label: 'Anual −17%' }
			]}
		/>
	</div>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each data.planes as plan (plan.codigo)}
			{@const esActual = plan.codigo === actual}
			<Card class={cn('flex flex-col', plan.destacado && 'ring-2 ring-foreground/80', esActual && 'ring-2 ring-brand')} bodyClass="flex flex-1 flex-col gap-4 p-5">
				<div class="flex items-start justify-between gap-2">
					<div>
						<h3 class="font-semibold">{plan.nombre}</h3>
						<p class="text-xs text-muted-foreground">{plan.badge}</p>
					</div>
					{#if esActual}<Badge variant="success">Actual</Badge>{:else if plan.destacado}<Badge variant="neutral">Recomendado</Badge>{/if}
				</div>
				<div>
					<p class="text-3xl font-semibold tracking-tight tabular-nums">{formatCOP(precio(plan.precioMes))}</p>
					<p class="text-xs text-muted-foreground">por mes{ciclo !== 'mensual' ? `, facturado ${ciclo}` : ''}</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2 text-sm">
					{#each plan.caracteristicas as c (c)}
						<li class="flex gap-2"><Check size={15} class="mt-0.5 shrink-0 text-brand" /><span>{c}</span></li>
					{/each}
				</ul>
				<form
					method="POST"
					action="?/cambiarPlan"
					use:enhance={({ cancel }) => {
						if (!confirm(`¿Cambiar al plan ${plan.nombre} (${ciclo}) por ${formatCOP(precio(plan.precioMes))}/mes?`)) return cancel();
						enviando = plan.codigo;
						return async ({ update }) => {
							await update();
							enviando = null;
						};
					}}
				>
					<input type="hidden" name="plan_codigo" value={plan.codigo} />
					<input type="hidden" name="ciclo" value={ciclo} />
					<button class={cn(btn.base, 'w-full', esActual && sub.cicloFacturacion === ciclo ? btn.outline : btn.primary)} disabled={(esActual && sub.cicloFacturacion === ciclo) || enviando !== null}>
						{#if enviando === plan.codigo}<LoaderCircle size={15} class="animate-spin" />{/if}
						{esActual && sub.cicloFacturacion === ciclo ? 'Plan actual' : esActual ? `Pasar a ${ciclo}` : 'Elegir plan'}
					</button>
				</form>
			</Card>
		{/each}
	</div>
	<p class="text-xs text-muted-foreground">Precios en pesos colombianos (COP). El límite de usuarios se aplica al crear personal.</p>
</div>
