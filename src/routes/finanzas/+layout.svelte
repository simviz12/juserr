<script lang="ts">
	import { page } from '$app/state';
	import { ChartPie, Inbox, Scale, FileText } from '@lucide/svelte';
	let { children } = $props();

	const tabs = [
		{ name: 'Resumen', path: '/finanzas/resumen', icon: ChartPie },
		{ name: 'Caja diaria', path: '/finanzas/caja', icon: Inbox },
		{ name: 'Corte semanal', path: '/finanzas/semanal', icon: Scale },
		{ name: 'Reporte mensual', path: '/finanzas/mensual', icon: FileText }
	];
</script>

<svelte:head><title>Finanzas · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Centro financiero</h1>
		<p class="text-sm text-muted-foreground">Conciliación de caja, cortes y reportes del negocio.</p>
	</div>

	<nav class="-mb-px flex gap-1 overflow-x-auto border-b border-border custom-scrollbar" aria-label="Secciones de finanzas">
		{#each tabs as tab (tab.path)}
			{@const Icon = tab.icon}
			{@const active = page.url.pathname === tab.path}
			<a
				href={tab.path}
				aria-current={active ? 'page' : undefined}
				class="flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors {active
					? 'border-foreground font-medium text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				<Icon size={15} />{tab.name}
			</a>
		{/each}
	</nav>

	<div class="animate-fade-in">
		{@render children()}
	</div>
</div>
