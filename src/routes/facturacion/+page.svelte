<script lang="ts">
	import { resolve } from '$app/paths';
	import { CreditCard, Receipt, Puzzle, MessageCircle } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';
	import { nombreModulo } from '$lib/modules/registry';

	let { data } = $props();

	const money = (cents: number) => formatCOP(fromCents(cents));
	const dia = (k: string | null) => (k ? formatDate(k + 'T12:00:00-05:00') : '—');
	const SITUACION = {
		vigente: { label: 'Al día', variant: 'success' },
		gracia: { label: 'En gracia', variant: 'warning' },
		vencido: { label: 'Vencido', variant: 'danger' }
	} as const;
	const METODO: Record<string, string> = {
		transferencia: 'Transferencia',
		nequi: 'Nequi',
		daviplata: 'Daviplata',
		efectivo: 'Efectivo',
		tarjeta: 'Tarjeta',
		otro: 'Otro'
	};

	let whatsapp = $derived(
		data.cuenta?.contacto
			? `https://wa.me/${data.cuenta.contacto.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, soy de ${data.tenant?.nombre ?? 'mi restaurante'} (código ${data.tenant?.codigo ?? ''}). Quiero pagar mi plan de MesaCapital.`)}`
			: null
	);
</script>

<svelte:head><title>Facturación · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6">
	<PageHeader
		title="Facturación"
		description="Tu plan, los módulos contratados y el historial de pagos."
	/>

	{#if data.motivo === 'modulo' && data.moduloVencido}
		<Alert variant="warning" title={`"${nombreModulo(data.moduloVencido)}" está vencido`}>
			Esta función hecha para tu restaurante se reactiva apenas registremos el pago.
		</Alert>
	{:else if data.motivo === 'solo-lectura'}
		<Alert variant="danger" title="El plan está vencido">
			Puedes consultar y exportar tu información, pero no registrar turnos, compras ni cambios hasta
			renovar.
		</Alert>
	{:else if data.motivo === 'suspendido' || data.plan?.estadoCore === 'suspendido'}
		<Alert variant="danger" title="Servicio suspendido"
			>Comunícate con MesaCapital para reactivar el servicio.</Alert
		>
	{/if}

	{#if !data.esJefe}
		<Card>
			<EmptyState
				icon={CreditCard}
				title="Solo el administrador ve la facturación"
				description="Si el sistema no te deja registrar, avísale al administrador del restaurante para que renueve el plan."
			/>
		</Card>
	{:else if data.cuenta}
		{@const c = data.cuenta}
		<section class="grid gap-4 md:grid-cols-3">
			<Card class="md:col-span-2" title="Tu plan" description="Lo que pagas cada mes">
				<ul class="divide-y divide-border">
					{#each c.modulos as m (m.modulo)}
						{@const s = SITUACION[m.situacion]}
						<li class="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
							<div class="min-w-0">
								<p class="flex flex-wrap items-center gap-2 text-sm font-medium">
									{m.nombre ?? nombreModulo(m.modulo)}
									{#if m.esCore}<Badge variant="outline">Base</Badge>{/if}
									{#if m.estado === 'cancelada'}<Badge>Cancelado</Badge>{:else}<Badge
											variant={s.variant}>{s.label}</Badge
										>{/if}
								</p>
								<p class="text-xs text-muted-foreground">Pagado hasta el {dia(m.vigenteHasta)}</p>
							</div>
							<span class="text-sm tabular-nums"
								>{m.estado === 'activa' ? money(m.precioMensualCents) : '—'}<span
									class="text-xs text-muted-foreground">/mes</span
								></span
							>
						</li>
					{/each}
				</ul>
				<div class="mt-4 flex items-center justify-between border-t border-border pt-4">
					<span class="text-sm font-medium">Total mensual</span>
					<span class="text-lg font-semibold tabular-nums">{money(c.totalMensualCents)}</span>
				</div>
			</Card>

			<Card title="Cómo pagar">
				{#if c.instrucciones.length}
					<ol class="list-decimal space-y-1.5 pl-4 text-sm">
						{#each c.instrucciones as paso, i (i)}<li>{paso}</li>{/each}
					</ol>
				{:else}
					<p class="text-sm text-muted-foreground">Escríbenos y te enviamos los datos de pago.</p>
				{/if}
				<p class="mt-3 text-xs text-muted-foreground">
					Incluye el código <span class="font-medium text-foreground">{data.tenant?.codigo}</span> en
					la referencia. Activamos tu pago el mismo día hábil.
				</p>
				{#if whatsapp}
					<a
						href={whatsapp}
						target="_blank"
						rel="external noopener noreferrer"
						class={cn(btn.base, btn.primary, 'mt-4 w-full')}
					>
						<MessageCircle size={15} /> Enviar comprobante por WhatsApp
					</a>
				{/if}
				<a href={resolve('/modulos')} class={cn(btn.base, btn.outline, 'mt-2 w-full')}
					><Puzzle size={15} /> Ver módulos adicionales</a
				>
			</Card>
		</section>

		<Card title="Historial de pagos">
			{#if c.pagos.length === 0}
				<EmptyState icon={Receipt} title="Aún no hay pagos registrados" />
			{:else}
				<div class="custom-scrollbar overflow-x-auto rounded-md border border-border">
					<table class="w-full text-sm">
						<thead class="bg-muted/60 text-left text-xs text-muted-foreground">
							<tr>
								<th class="h-10 px-3 font-medium">Fecha</th>
								<th class="h-10 px-3 font-medium">Cubre</th>
								<th class="hidden h-10 px-3 font-medium sm:table-cell">Método</th>
								<th class="h-10 px-3 text-right font-medium">Valor</th>
							</tr>
						</thead>
						<tbody>
							{#each c.pagos as p (p.id)}
								<tr class="border-t border-border">
									<td class="px-3 py-2.5 whitespace-nowrap">{formatDate(p.createdAt)}</td>
									<td class="px-3 py-2.5">
										{#each p.detalle as d (d.modulo)}
											<span class="block text-xs"
												><span class="font-medium">{nombreModulo(d.modulo)}</span> · {dia(d.desde)} –
												{dia(d.hasta)}</span
											>
										{/each}
									</td>
									<td class="hidden px-3 py-2.5 sm:table-cell">{METODO[p.metodo] ?? p.metodo}</td>
									<td class="px-3 py-2.5 text-right tabular-nums">{money(p.montoCents)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>
	{/if}
</div>
