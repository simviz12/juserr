<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle, ShieldCheck, TriangleAlert } from '@lucide/svelte';
	import { inputClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';

	let { form } = $props();
	let enviando = $state(false);
</script>

<svelte:head><title>Consola de plataforma · MesaCapital</title></svelte:head>

<main class="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
	<div class="w-full max-w-sm">
		<div class="mb-8 flex items-center gap-3">
			<span class="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"
				><ShieldCheck size={20} /></span
			>
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Consola de plataforma</h1>
				<p class="text-sm text-muted-foreground">Acceso exclusivo de MesaCapital.</p>
			</div>
		</div>
		{#if form?.message}
			<div
				role="alert"
				class="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
			>
				<TriangleAlert size={15} />{form.message}
			</div>
		{/if}
		<form
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				enviando = true;
				return async ({ update }) => {
					await update();
					enviando = false;
				};
			}}
		>
			<div class="space-y-1.5">
				<label for="email" class="text-sm font-medium">Correo</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					value={form?.email ?? ''}
					required
					class={inputClass}
				/>
			</div>
			<div class="space-y-1.5">
				<label for="password" class="text-sm font-medium">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class={inputClass}
				/>
			</div>
			<button type="submit" disabled={enviando} class={cn(btn.base, btn.primary, 'w-full')}>
				{#if enviando}<LoaderCircle size={15} class="animate-spin" />{/if} Ingresar
			</button>
		</form>
	</div>
</main>
