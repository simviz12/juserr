<script lang="ts">
	import './layout.css';
	import { page, navigating } from '$app/state';
	import {
		LayoutDashboard,
		LockKeyhole,
		Boxes,
		Landmark,
		UtensilsCrossed,
		Users,
		LogOut,
		Bell,
		Menu,
		X,
		CreditCard,
		Beef,
		TriangleAlert,
		CircleCheck,
		ArrowRight,
		ChartColumn,
		Pizza,
		Tags
	} from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { BRAND } from '$lib/config/brand';
	import { canAccess, normalizeRol, ROL_LABELS } from '$lib/auth/access';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let { children, data } = $props();

	const NAV = [
		{
			group: 'General',
			items: [
				{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
				{ name: 'Finanzas', path: '/finanzas', href: '/finanzas/resumen', icon: Landmark },
				{ name: 'Producción', path: '/reportes/produccion', icon: ChartColumn }
			]
		},
		{
			group: 'Operación',
			items: [
				{ name: 'Cierre de turno', path: '/turnos/cierre', icon: LockKeyhole },
				{ name: 'Bodega e insumos', path: '/bodega', icon: Boxes },
				{ name: 'Productos e insumos', path: '/productos', icon: Beef }
			]
		},
		{
			group: 'Configuración',
			items: [
				{ name: 'Líneas y combos', path: '/configuracion/rubros', icon: UtensilsCrossed },
				{ name: 'Sabores', path: '/configuracion/sabores', icon: Pizza },
				{ name: 'Categorías', path: '/configuracion/categorias', icon: Tags },
				{ name: 'Personal', path: '/configuracion/personal', icon: Users },
				{ name: 'Suscripción', path: '/saas/suscripcion', icon: CreditCard }
			]
		}
	];

	// La navegación usa la MISMA política que el servidor: nunca muestra enlaces que redirigen.
	let nav = $derived(
		NAV.map((g) => ({ ...g, items: g.items.filter((i) => data.user && canAccess(data.user.rol, i.path)) })).filter(
			(g) => g.items.length > 0
		)
	);
	let current = $derived(NAV.flatMap((g) => g.items).find((i) => isActive(i.path)));
	let mobileOpen = $state(false);
	let notifOpen = $state(false);
	let alertas = $derived(data.alertas ?? []);

	function isActive(path: string) {
		const p = page.url.pathname;
		return p === path || p.startsWith(path + '/');
	}

	$effect(() => {
		void page.url.pathname;
		mobileOpen = false;
		notifOpen = false;
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			mobileOpen = false;
			notifOpen = false;
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#snippet brand()}
	<a href="/" class="flex items-center gap-2.5 px-2">
		<span class="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
			<svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
			</svg>
		</span>
		<span class="leading-tight">
			<span class="block text-[15px] font-semibold tracking-tight">{BRAND.name}</span>
			<span class="block max-w-40 truncate text-[11px] text-muted-foreground" title={data.negocio?.nombre ?? BRAND.tagline}>{data.negocio && data.negocio.nombre !== BRAND.name ? data.negocio.nombre : BRAND.tagline}</span>
		</span>
	</a>
{/snippet}

{#snippet navList()}
	<nav class="flex flex-col gap-5" aria-label="Principal">
		{#each nav as g (g.group)}
			<div>
				<p class="mb-1 px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g.group}</p>
				<ul class="flex flex-col gap-0.5">
					{#each g.items as item (item.path)}
						{@const Icon = item.icon}
						{@const active = isActive(item.path)}
						<li>
							<a
								href={item.href ?? item.path}
								aria-current={active ? 'page' : undefined}
								class="group flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors {active
									? 'bg-accent font-medium text-foreground'
									: 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'}"
							>
								<Icon size={16} class={active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'} />
								{item.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>
{/snippet}

{#snippet userCard()}
	{#if data.user}
		<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
			<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
				{data.user.nombre.charAt(0).toUpperCase()}
			</span>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{data.user.nombre}</p>
				<p class="truncate text-xs text-muted-foreground">{ROL_LABELS[normalizeRol(data.user.rol)]}</p>
			</div>
			<form action="/logout" method="POST">
				<button
					type="submit"
					class="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"
					aria-label="Cerrar sesión"
					title="Cerrar sesión"><LogOut size={15} /></button
				>
			</form>
		</div>
	{/if}
{/snippet}

<!-- Barra de progreso de navegación -->
{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" in:fade={{ delay: 150, duration: 100 }}>
		<div class="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-brand"></div>
	</div>
{/if}

{#if data.user}
	<div class="flex h-dvh w-full overflow-hidden bg-background text-foreground print:block print:h-auto print:overflow-visible">
		<!-- Sidebar escritorio -->
		<aside class="hidden w-64 shrink-0 print:!hidden flex-col gap-6 border-r border-border bg-card/40 px-3 py-4 md:flex">
			{@render brand()}
			<div class="flex-1 overflow-y-auto custom-scrollbar">{@render navList()}</div>
			{@render userCard()}
		</aside>

		<!-- Drawer móvil -->
		{#if mobileOpen}
			<div class="fixed inset-0 z-50 md:hidden">
				<button
					type="button"
					class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
					aria-label="Cerrar menú"
					onclick={() => (mobileOpen = false)}
					transition:fade={{ duration: 150 }}
				></button>
				<aside
					class="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 border-r border-border bg-card px-3 py-4 shadow-xl"
					transition:fly={{ x: -288, duration: 220 }}
				>
					<div class="flex items-center justify-between">
						{@render brand()}
						<button type="button" class="grid h-8 w-8 place-items-center rounded-md hover:bg-accent" onclick={() => (mobileOpen = false)} aria-label="Cerrar menú"><X size={18} /></button>
					</div>
					<div class="flex-1 overflow-y-auto">{@render navList()}</div>
					{@render userCard()}
				</aside>
			</div>
		{/if}

		<div class="flex min-w-0 flex-1 flex-col">
			<header class="sticky top-0 z-30 print:hidden flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
				<button type="button" class="grid h-9 w-9 place-items-center rounded-md hover:bg-accent md:hidden" onclick={() => (mobileOpen = true)} aria-label="Abrir menú">
					<Menu size={18} />
				</button>
				<nav aria-label="Ruta" class="flex min-w-0 items-center gap-2 text-sm">
					<span class="hidden text-muted-foreground sm:inline">{BRAND.name}</span>
					<span class="hidden text-muted-foreground/50 sm:inline">/</span>
					<span class="truncate font-medium">{current?.name ?? 'Inicio'}</span>
				</nav>

				<div class="relative ml-auto flex items-center gap-1">
					<ThemeToggle />
					<button
						type="button"
						onclick={() => (notifOpen = !notifOpen)}
						class="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						aria-label={`Notificaciones (${alertas.length})`}
						aria-expanded={notifOpen}
					>
						<Bell size={17} />
						{#if alertas.length > 0}
							<span class="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
								{alertas.length}
							</span>
						{/if}
					</button>

					{#if notifOpen}
						<button type="button" class="fixed inset-0 z-40 cursor-default" aria-label="Cerrar notificaciones" onclick={() => (notifOpen = false)}></button>
						<div
							class="absolute top-11 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
							transition:fly={{ y: -6, duration: 160 }}
							role="dialog"
							aria-label="Notificaciones"
						>
							<div class="flex items-center justify-between border-b border-border px-4 py-3">
								<p class="text-sm font-semibold">Notificaciones</p>
								<span class="text-xs text-muted-foreground">{alertas.length} pendientes</span>
							</div>
							<div class="max-h-80 overflow-y-auto custom-scrollbar">
								{#if alertas.length === 0}
									<div class="flex flex-col items-center px-4 py-8 text-center">
										<CircleCheck size={22} class="mb-2 text-success" />
										<p class="text-sm font-medium">Todo al día</p>
										<p class="text-xs text-muted-foreground">No hay insumos críticos.</p>
									</div>
								{:else}
									<ul class="divide-y divide-border">
										{#each alertas as a (a.id)}
											<li class="flex gap-3 px-4 py-3">
												<span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md {a.nivel === 'urgente' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}">
													<TriangleAlert size={14} />
												</span>
												<div class="min-w-0">
													<p class="truncate text-sm font-medium">{a.titulo}</p>
													<p class="text-xs text-muted-foreground">{a.detalle}</p>
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
							{#if data.user && canAccess(data.user.rol, '/bodega')}
								<a href="/bodega" class="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
									Reponer stock en bodega <ArrowRight size={13} />
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</header>

			<main class="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 custom-scrollbar print:overflow-visible print:p-0">
				{@render children()}
			</main>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	@keyframes -global-slide {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(300%); }
	}
</style>
