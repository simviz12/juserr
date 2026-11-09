<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle, TriangleAlert } from '@lucide/svelte';
	import { BRAND } from '$lib/config/brand';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Iniciar sesión · {BRAND.name}</title></svelte:head>

<div class="grid min-h-dvh bg-background lg:grid-cols-2">
	<!-- Panel de marca -->
	<aside class="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex lg:flex-col lg:justify-between">
		<div
			class="pointer-events-none absolute inset-0 opacity-40"
			style="background: radial-gradient(60% 50% at 20% 10%, rgb(16 185 129 / 0.25), transparent 70%), radial-gradient(50% 40% at 90% 90%, rgb(42 120 214 / 0.25), transparent 70%);"
		></div>
		<div class="relative flex items-center gap-2.5">
			<span class="grid h-9 w-9 place-items-center rounded-lg bg-zinc-50 text-zinc-950">
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
			</span>
			<span class="text-lg font-semibold tracking-tight">{BRAND.name}</span>
		</div>
		<div class="relative max-w-md">
			<p class="text-3xl leading-tight font-semibold tracking-tight">Cada turno cuadrado. Cada peso con nombre.</p>
			<p class="mt-4 text-sm text-zinc-400">
				Cierres de caja, food cost, inventario y flujo de caja de tu restaurante en un solo panel.
			</p>
		</div>
		<p class="relative text-xs text-zinc-500">© {new Date().getFullYear()} {BRAND.name}</p>
	</aside>

	<!-- Formulario -->
	<main class="relative flex items-center justify-center p-6">
		<div class="absolute top-4 right-4"><ThemeToggle /></div>
		<div class="w-full max-w-sm animate-slide-up">
			<div class="mb-8">
				<h1 class="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
				<p class="mt-1 text-sm text-muted-foreground">Ingresa con tu usuario del equipo.</p>
			</div>

			{#if form?.message}
				<div role="alert" class="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
					<TriangleAlert size={15} />{form.message}
				</div>
			{/if}

			<form
				method="POST"
				class="space-y-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<div class="space-y-1.5">
					<label for="username" class="text-sm font-medium">Usuario</label>
					<input
						id="username"
						name="username"
						type="text"
						autocomplete="username"
						required
						class="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
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
						class="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
					/>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
				>
					{#if submitting}<LoaderCircle size={16} class="animate-spin" /> Ingresando…{:else}Ingresar{/if}
				</button>
			</form>
		</div>
	</main>
</div>
