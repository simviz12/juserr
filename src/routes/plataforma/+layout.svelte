<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { LogOut, ShieldCheck, Store, Plus, Tags } from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let { data, children } = $props();
	const links = [
		{ name: 'Restaurantes', path: '/plataforma', href: resolve('/plataforma'), icon: Store },
		{
			name: 'Nuevo restaurante',
			path: '/plataforma/restaurantes/nuevo',
			href: resolve('/plataforma/restaurantes/nuevo'),
			icon: Plus
		},
		{
			name: 'Catálogo y precios',
			path: '/plataforma/catalogo',
			href: resolve('/plataforma/catalogo'),
			icon: Tags
		}
	];
</script>

{#if data.admin}
	<div class="min-h-dvh bg-background text-foreground">
		<header class="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
			<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
				<a
					href={resolve('/plataforma')}
					class="flex items-center gap-2 font-semibold tracking-tight"
				>
					<span
						class="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground"
						><ShieldCheck size={15} /></span
					>
					<span class="hidden sm:inline">MesaCapital · Plataforma</span>
				</a>
				<nav class="no-scrollbar flex flex-1 gap-1 overflow-x-auto" aria-label="Consola">
					{#each links as l (l.path)}
						{@const Icon = l.icon}
						{@const active = page.url.pathname === l.path}
						<a
							href={l.href}
							aria-current={active ? 'page' : undefined}
							class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap {active
								? 'bg-accent font-medium'
								: 'text-muted-foreground hover:text-foreground'}"
						>
							<Icon size={14} />{l.name}
						</a>
					{/each}
				</nav>
				<ThemeToggle />
				<form method="POST" action="/plataforma/logout">
					<button
						type="submit"
						class="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"
						aria-label="Cerrar sesión"
						title={`Cerrar sesión (${data.admin.email})`}><LogOut size={15} /></button
					>
				</form>
			</div>
		</header>
		<main class="mx-auto max-w-6xl px-4 py-6 md:py-8">{@render children()}</main>
	</div>
{:else}
	{@render children()}
{/if}
