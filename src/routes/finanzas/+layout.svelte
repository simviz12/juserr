<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ChartPie, Inbox, Scale, FileText, ReceiptText, Lock } from '@lucide/svelte';
	import { rutaDisponible } from '$lib/modules/registry';
	let { children, data } = $props();

	const tabs = [
		{
			name: 'Resumen',
			path: '/finanzas/resumen',
			href: resolve('/finanzas/resumen'),
			icon: ChartPie
		},
		{
			name: 'Estado de resultados',
			path: '/finanzas/estado-resultados',
			href: resolve('/finanzas/estado-resultados'),
			icon: ReceiptText
		},
		{ name: 'Caja diaria', path: '/finanzas/caja', href: resolve('/finanzas/caja'), icon: Inbox },
		{
			name: 'Corte semanal',
			path: '/finanzas/semanal',
			href: resolve('/finanzas/semanal'),
			icon: Scale
		},
		{
			name: 'Reporte mensual',
			path: '/finanzas/mensual',
			href: resolve('/finanzas/mensual'),
			icon: FileText
		}
	];
	// Pestañas de add-ons no contratados: con candado, llevan al catálogo de módulos.
	const bloqueada = (path: string) => (data.plan ? !rutaDisponible(path, data.plan) : false);
</script>

<svelte:head><title>Finanzas · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Centro financiero</h1>
		<p class="text-sm text-muted-foreground">
			Conciliación de caja, cortes y reportes del negocio.
		</p>
	</div>

	<nav
		class="no-scrollbar -mb-px flex gap-1 overflow-x-auto border-b border-border"
		aria-label="Secciones de finanzas"
	>
		{#each tabs as tab (tab.path)}
			{@const Icon = tab.icon}
			{@const active = page.url.pathname === tab.path}
			{@const locked = bloqueada(tab.path)}
			<a
				href={locked ? resolve('/modulos') : tab.href}
				aria-current={active ? 'page' : undefined}
				title={locked ? 'Módulo adicional no contratado' : undefined}
				class="flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors {active
					? 'border-foreground font-medium text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'} {locked
					? 'opacity-60'
					: ''}"
			>
				<Icon size={15} />{tab.name}
				{#if locked}<Lock size={12} aria-label="Bloqueado" />{/if}
			</a>
		{/each}
	</nav>

	<div class="animate-fade-in">
		{@render children()}
	</div>
</div>
