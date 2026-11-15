<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn, inputClass, selectClass } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP, formatDate, formatDateTime } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';
	import { nombreModulo } from '$lib/modules/registry';

	let { data, form } = $props();
	const money = (c: number) => formatCOP(fromCents(c));
	const dia = (k: string | null) => (k ? formatDate(k + 'T12:00:00-05:00') : '—');
	const METODO: Record<string, string> = {
		transferencia: 'Transferencia',
		nequi: 'Nequi',
		daviplata: 'Daviplata',
		efectivo: 'Efectivo',
		tarjeta: 'Tarjeta',
		otro: 'Otro'
	};
	const SITUACION = {
		vigente: ['Al día', 'success'],
		gracia: ['En gracia', 'warning'],
		vencido: ['Vencido', 'danger']
	} as const;
	const ESTADO_CORE = {
		'al-dia': ['Al día', 'success'],
		gracia: ['En gracia', 'warning'],
		'solo-lectura': ['Solo lectura', 'danger'],
		suspendido: ['Suspendido', 'danger']
	} as const;

	let r = $derived(data.restaurante);
	let activos = $derived(data.modulos.filter((m) => m.estado === 'activa'));

	// Pago: por defecto cubre todos los módulos activos, 1 mes.
	// Editable con los checkboxes; se recalcula cuando cambian los módulos del restaurante.
	let pagoModulos = $derived(
		data.modulos.filter((m) => m.estado === 'activa').map((m) => m.modulo)
	);
	let meses = $state(1);
	let calculado = $derived(
		activos
			.filter((m) => pagoModulos.includes(m.modulo))
			.reduce((a, m) => a + m.precioMensualCents, 0) * (Number(meses) || 0)
	);

	let confirmarEstado = $state<string | null>(null);
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head><title>{r.nombre} · Plataforma</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<a
				href={resolve('/plataforma')}
				class="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
				><ArrowLeft size={14} /> Restaurantes</a
			>
			<h1 class="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
				{r.nombre}
				{#if r.estado !== 'activo'}<Badge variant="danger">{r.estado}</Badge>{:else}{@const e =
						ESTADO_CORE[data.plan.estadoCore]}<Badge variant={e[1]}>{e[0]}</Badge>{/if}
			</h1>
			<p class="text-sm text-muted-foreground">
				Código de acceso: <span class="font-mono font-medium text-foreground">{r.codigo}</span> ·
				Cliente desde {formatDate(r.createdAt)}
			</p>
		</div>
		<div class="text-right">
			<p class="text-xs text-muted-foreground">Mensualidad</p>
			<p class="text-2xl font-semibold tabular-nums">{money(data.totalMensualCents)}</p>
		</div>
	</div>

	{#if data.creado}<Alert variant="success" title="Restaurante creado"
			>Entrega al cliente el código <b>{r.codigo}</b>, su usuario Jefe y la contraseña inicial.</Alert
		>{/if}
	<FormFeedback {form} />

	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Módulos -->
		<Card class="lg:col-span-3" title="Módulos contratados">
			<ul class="divide-y divide-border">
				{#each data.modulos as m (m.modulo)}
					{@const s = SITUACION[m.situacion]}
					<li
						class="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<p class="flex flex-wrap items-center gap-2 text-sm font-medium">
								{m.nombre}
								{#if m.estado === 'cancelada'}<Badge>Cancelado</Badge>{:else}<Badge variant={s[1]}
										>{s[0]}</Badge
									>{/if}
								{#if data.solicitudes.includes(m.modulo)}<Badge variant="warning">Solicitado</Badge
									>{/if}
							</p>
							<p class="text-xs text-muted-foreground">
								Hasta {dia(m.vigenteHasta)} · {money(m.precioMensualCents)}/mes
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<form
								method="POST"
								action="?/precio"
								use:enhance={keep}
								class="flex items-center gap-1"
							>
								<input type="hidden" name="modulo" value={m.modulo} />
								<input
									name="precio"
									inputmode="decimal"
									placeholder="Nuevo precio"
									aria-label="Nuevo precio de {m.nombre}"
									class={cn(inputClass, 'h-8 w-28 text-xs')}
								/>
								<button type="submit" class={cn(btn.base, btn.ghost, btn.sm)}>Cambiar</button>
							</form>
							{#if !m.esCore}
								{#if m.estado === 'activa'}
									<form method="POST" action="?/cancelar" use:enhance>
										<input type="hidden" name="modulo" value={m.modulo} />
										<button type="submit" class={cn(btn.base, btn.ghost, btn.sm, 'text-danger')}
											>Cancelar</button
										>
									</form>
								{:else}
									<form method="POST" action="?/activar" use:enhance>
										<input type="hidden" name="modulo" value={m.modulo} />
										<button type="submit" class={cn(btn.base, btn.outline, btn.sm)}
											>Reactivar</button
										>
									</form>
								{/if}
							{/if}
						</div>
					</li>
				{/each}
			</ul>

			{#if data.disponibles.length}
				<form
					method="POST"
					action="?/activar"
					use:enhance={keep}
					class="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
				>
					<p class="text-sm font-medium sm:col-span-2">Activar un módulo</p>
					<Field label="Módulo" for="act-modulo">
						<select id="act-modulo" name="modulo" class={selectClass} required>
							{#each data.disponibles as d (d.codigo)}<option value={d.codigo}
									>{d.exclusivo ? '★ ' : ''}{d.nombre} · {money(
										d.precioMensualCents
									)}/mes{data.solicitudes.includes(d.codigo) ? ' (solicitado)' : ''}</option
								>{/each}
						</select>
					</Field>
					<Field label="Precio pactado (opcional)" for="act-precio" hint="Vacío = precio de lista."
						><input id="act-precio" name="precio" inputmode="decimal" class={inputClass} /></Field
					>
					<label class="flex items-center gap-2 text-sm sm:col-span-2"
						><input type="checkbox" name="cobrar" class="h-4 w-4" /> Registrar el cobro del prorrateo
						hasta el vencimiento del Core</label
					>
					<Field label="Método" for="act-metodo"
						><select id="act-metodo" name="metodo" class={selectClass}
							>{#each data.metodos as mt (mt)}<option value={mt}>{METODO[mt]}</option
								>{/each}</select
						></Field
					>
					<Field label="Referencia" for="act-ref"
						><input id="act-ref" name="referencia" class={inputClass} /></Field
					>
					<div class="sm:col-span-2">
						<button type="submit" class={cn(btn.base, btn.primary)}>Activar módulo</button>
					</div>
				</form>
			{/if}
		</Card>

		<!-- Registrar pago -->
		<Card
			class="lg:col-span-2"
			title="Registrar pago"
			description="Extiende la vigencia de los módulos que cubre."
		>
			<form method="POST" action="?/pagar" use:enhance={keep} class="flex flex-col gap-3">
				<fieldset class="flex flex-col gap-1.5">
					<legend class="mb-1 text-sm font-medium">Cubre</legend>
					{#each activos as m (m.modulo)}
						<label class="flex items-center justify-between gap-2 text-sm">
							<span class="flex items-center gap-2"
								><input
									type="checkbox"
									name="modulos"
									value={m.modulo}
									bind:group={pagoModulos}
									class="h-4 w-4"
								/>{m.nombre}</span
							>
							<span class="text-xs text-muted-foreground tabular-nums"
								>{money(m.precioMensualCents)}</span
							>
						</label>
					{/each}
				</fieldset>
				<div class="grid grid-cols-2 gap-3">
					<Field label="Meses" for="pago-meses"
						><input
							id="pago-meses"
							name="meses"
							type="number"
							min="1"
							max="24"
							bind:value={meses}
							required
							class={inputClass}
						/></Field
					>
					<Field label="Método" for="pago-metodo"
						><select id="pago-metodo" name="metodo" class={selectClass}
							>{#each data.metodos as mt (mt)}<option value={mt}>{METODO[mt]}</option
								>{/each}</select
						></Field
					>
				</div>
				<Field
					label="Monto recibido"
					for="pago-recibido"
					hint={`Calculado: ${money(calculado)}. Vacío = ese valor.`}
					><input
						id="pago-recibido"
						name="recibido"
						inputmode="decimal"
						class={inputClass}
					/></Field
				>
				<Field label="Referencia / comprobante" for="pago-ref"
					><input id="pago-ref" name="referencia" class={inputClass} /></Field
				>
				<Field label="Nota" for="pago-nota"
					><input id="pago-nota" name="nota" class={inputClass} /></Field
				>
				<button type="submit" class={cn(btn.base, btn.primary)} disabled={pagoModulos.length === 0}
					>Registrar pago de {money(calculado)}</button
				>
			</form>
		</Card>
	</div>

	<Card title="Pagos">
		{#if data.pagos.length === 0}
			<p class="text-sm text-muted-foreground">Sin pagos registrados.</p>
		{:else}
			<div class="custom-scrollbar overflow-x-auto rounded-md border border-border">
				<table class="w-full text-sm">
					<thead class="bg-muted/60 text-left text-xs text-muted-foreground"
						><tr
							><th class="h-10 px-3 font-medium">Fecha</th><th class="h-10 px-3 font-medium"
								>Cubre</th
							><th class="hidden h-10 px-3 font-medium md:table-cell">Método · Ref.</th><th
								class="h-10 px-3 text-right font-medium">Valor</th
							></tr
						></thead
					>
					<tbody>
						{#each data.pagos as p (p.id)}
							<tr class="border-t border-border">
								<td class="px-3 py-2.5 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
								<td class="px-3 py-2.5 text-xs"
									>{#each p.detalle as d (d.modulo)}<span class="block"
											>{nombreModulo(d.modulo)} · hasta {dia(d.hasta)}</span
										>{/each}</td
								>
								<td class="hidden px-3 py-2.5 text-xs md:table-cell"
									>{METODO[p.metodo] ?? p.metodo}{p.referencia
										? ` · ${p.referencia}`
										: ''}{#if p.nota}<span class="block text-muted-foreground">{p.nota}</span
										>{/if}</td
								>
								<td class="px-3 py-2.5 text-right tabular-nums">{money(p.montoCents)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card title="Datos del restaurante">
			<form method="POST" action="?/editar" use:enhance={keep} class="grid gap-3 sm:grid-cols-2">
				<Field label="Nombre" for="ed-nombre" class="sm:col-span-2"
					><input
						id="ed-nombre"
						name="nombre"
						value={r.nombre}
						required
						class={inputClass}
					/></Field
				>
				<Field label="Contacto" for="ed-contacto"
					><input
						id="ed-contacto"
						name="contacto_nombre"
						value={r.contactoNombre ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Teléfono" for="ed-tel"
					><input
						id="ed-tel"
						name="contacto_telefono"
						value={r.contactoTelefono ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Correo" for="ed-email" class="sm:col-span-2"
					><input
						id="ed-email"
						name="contacto_email"
						type="email"
						value={r.contactoEmail ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Límite de usuarios" for="ed-limite" hint="Vacío = sin límite."
					><input
						id="ed-limite"
						name="limite_usuarios"
						type="number"
						min="1"
						value={r.limiteUsuarios ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Días de gracia" for="ed-gracia"
					><input
						id="ed-gracia"
						name="dias_gracia"
						type="number"
						min="0"
						max="60"
						value={r.diasGracia}
						required
						class={inputClass}
					/></Field
				>
				<div class="sm:col-span-2">
					<button type="submit" class={cn(btn.base, btn.outline)}>Guardar datos</button>
				</div>
			</form>
		</Card>

		<Card
			title="Estado del servicio"
			description="Suspendido: solo ve Facturación. Cancelado: no puede iniciar sesión."
		>
			<form
				method="POST"
				action="?/estado"
				use:enhance={() =>
					async ({ update }) => {
						await update();
						confirmarEstado = null;
					}}
				class="flex flex-wrap gap-2"
			>
				{#each ['activo', 'suspendido', 'cancelado'] as est (est)}
					{#if est !== r.estado}
						{#if confirmarEstado === est}
							<input type="hidden" name="estado" value={est} />
							<button
								type="submit"
								class={cn(btn.base, est === 'activo' ? btn.primary : btn.danger, btn.sm)}
								>Confirmar: {est}</button
							>
							<button
								type="button"
								class={cn(btn.base, btn.ghost, btn.sm)}
								onclick={() => (confirmarEstado = null)}>No</button
							>
						{:else if confirmarEstado === null}
							<button
								type="button"
								class={cn(btn.base, btn.outline, btn.sm)}
								onclick={() => (confirmarEstado = est)}
							>
								{est === 'activo'
									? 'Reactivar'
									: est === 'suspendido'
										? 'Suspender'
										: 'Cancelar cuenta'}
							</button>
						{/if}
					{/if}
				{/each}
			</form>
			<p class="mt-4 mb-2 text-sm font-medium">Actividad reciente</p>
			<ul class="space-y-1 text-xs text-muted-foreground">
				{#each data.auditoria as a (a.id)}<li>
						{formatDateTime(a.createdAt)} · {a.accion}
					</li>{:else}<li>Sin actividad.</li>{/each}
			</ul>
		</Card>
	</div>
</div>
