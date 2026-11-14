<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import { btn, inputClass } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatCOP } from '$lib/utils/format';
	import { fromCents } from '$lib/features/finance/domain/money';
	import { sugerirCodigo } from '$lib/billing/domain';

	let { data, form } = $props();
	let enviando = $state(false);

	let nombre = $state('');
	let codigo = $state('');
	let codigoTocado = $state(false);
	let elegidos = $state<string[]>([]);
	$effect.pre(() => {
		if (form?.valores) {
			nombre = form.valores.nombre;
			codigo = form.valores.codigo;
			codigoTocado = true;
			elegidos = form.valores.modulos;
		}
	});
	// El código se sugiere desde el nombre hasta que el operador lo edita.
	let codigoFinal = $derived(codigoTocado ? codigo : sugerirCodigo(nombre));
	let total = $derived(
		data.modulos
			.filter((m) => m.esCore || elegidos.includes(m.codigo))
			.reduce((a, m) => a + m.precioMensualCents, 0)
	);
</script>

<svelte:head><title>Nuevo restaurante · Plataforma</title></svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	<PageHeader
		title="Nuevo restaurante"
		description="Crea la cuenta, el usuario administrador y los módulos con días de prueba."
	/>
	<FormFeedback {form} />

	<form
		method="POST"
		class="flex flex-col gap-6"
		use:enhance={() => {
			enviando = true;
			return async ({ update }) => {
				await update({ reset: false });
				enviando = false;
			};
		}}
	>
		<Card title="Restaurante">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Nombre comercial" for="nombre"
					><input
						id="nombre"
						name="nombre"
						bind:value={nombre}
						required
						maxlength="80"
						class={inputClass}
					/></Field
				>
				<Field
					label="Código de acceso"
					for="codigo"
					hint="Con esto inician sesión. Minúsculas, números y guiones."
				>
					<input
						id="codigo"
						name="codigo"
						value={codigoFinal}
						oninput={(e) => {
							codigo = e.currentTarget.value;
							codigoTocado = true;
						}}
						required
						pattern="[a-z0-9]+(-[a-z0-9]+)*"
						minlength="3"
						maxlength="40"
						class={inputClass}
					/>
				</Field>
				<Field label="Contacto" for="contacto_nombre"
					><input
						id="contacto_nombre"
						name="contacto_nombre"
						value={form?.valores?.contactoNombre ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Teléfono / WhatsApp" for="contacto_telefono"
					><input
						id="contacto_telefono"
						name="contacto_telefono"
						type="tel"
						value={form?.valores?.contactoTelefono ?? ''}
						class={inputClass}
					/></Field
				>
				<Field label="Correo" for="contacto_email" class="sm:col-span-2"
					><input
						id="contacto_email"
						name="contacto_email"
						type="email"
						value={form?.valores?.contactoEmail ?? ''}
						class={inputClass}
					/></Field
				>
			</div>
		</Card>

		<Card
			title="Usuario administrador (Jefe)"
			description="Entrégale estos datos al cliente; puede cambiar la contraseña desde Personal."
		>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Usuario" for="jefe_usuario"
					><input
						id="jefe_usuario"
						name="jefe_usuario"
						value={form?.valores?.jefeUsuario ?? 'admin'}
						required
						maxlength="60"
						autocomplete="off"
						class={inputClass}
					/></Field
				>
				<Field label="Contraseña inicial" for="jefe_password" hint="Mínimo 8 caracteres."
					><input
						id="jefe_password"
						name="jefe_password"
						type="password"
						required
						minlength="8"
						autocomplete="new-password"
						class={inputClass}
					/></Field
				>
			</div>
		</Card>

		<Card title="Plan" description="El Plan Core siempre va incluido.">
			<ul class="divide-y divide-border">
				{#each data.modulos as m (m.codigo)}
					<li class="flex items-center justify-between gap-3 py-2.5 first:pt-0">
						<label class="flex items-center gap-2.5 text-sm">
							{#if m.esCore}
								<input type="checkbox" checked disabled class="h-4 w-4" />
							{:else}
								<input
									type="checkbox"
									name="modulos"
									value={m.codigo}
									bind:group={elegidos}
									class="h-4 w-4"
								/>
							{/if}
							{m.nombre}
						</label>
						<span class="text-sm text-muted-foreground tabular-nums"
							>{formatCOP(fromCents(m.precioMensualCents))}/mes</span
						>
					</li>
				{/each}
			</ul>
			<div class="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
				<Field label="Días de prueba" for="dias_prueba" hint="Gratis antes del primer cobro."
					><input
						id="dias_prueba"
						name="dias_prueba"
						type="number"
						min="1"
						max="90"
						value={form?.valores?.diasPrueba ?? 15}
						required
						class={inputClass}
					/></Field
				>
				<Field label="Límite de usuarios" for="limite_usuarios" hint="Vacío = sin límite."
					><input
						id="limite_usuarios"
						name="limite_usuarios"
						type="number"
						min="1"
						value={form?.valores?.limiteUsuarios ?? ''}
						class={inputClass}
					/></Field
				>
				<div class="flex flex-col justify-end text-right">
					<span class="text-xs text-muted-foreground">Mensualidad</span>
					<span class="text-lg font-semibold tabular-nums">{formatCOP(fromCents(total))}</span>
				</div>
			</div>
		</Card>

		<div class="flex justify-end">
			<button type="submit" disabled={enviando} class={cn(btn.base, btn.primary)}
				>{#if enviando}<LoaderCircle size={15} class="animate-spin" />{/if} Crear restaurante</button
			>
		</div>
	</form>
</div>
