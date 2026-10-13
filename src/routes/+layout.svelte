<script lang="ts">
  import './layout.css';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { 
    LayoutDashboard, 
    LockKeyhole, 
    Boxes, 
    DollarSign, 
    UtensilsCrossed, 
    Users, 
    LogOut, 
    Bell, 
    Menu, 
    X,
    Pizza,
    AlertTriangle,
    CheckCircle2,
    ArrowRight
  } from '@lucide/svelte';
  let { children, data } = $props();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['jefe'] },
    { name: 'Cierre de Turno', path: '/turnos/cierre', icon: LockKeyhole, roles: ['jefe', 'empleado', 'cajero', 'bodeguero'] },
    { name: 'Bodega e Insumos', path: '/bodega', icon: Boxes, roles: ['jefe', 'empleado', 'bodeguero'] },
    { name: 'Finanzas', path: '/finanzas/resumen', icon: DollarSign, roles: ['jefe'] },
    { name: 'Productos', path: '/productos', icon: Pizza, roles: ['jefe'] },
    { name: 'Personal', path: '/configuracion/personal', icon: Users, roles: ['jefe'] },
  ];

  let visibleNavItems = $derived(navItems.filter(item => data.user && item.roles.includes(data.user.rol)));
  let mobileMenuOpen = $state(false);
  let notificacionesOpen = $state(false);

  let alertas = $derived(data.alertas || []);
  let conteoAlertas = $derived(alertas.length);
</script>

<div class="flex h-screen w-full text-slate-800 bg-slate-50 overflow-hidden font-sans">
  {#if data.user}
    <!-- Desktop Sidebar Navigation -->
    <aside class="hidden md:flex flex-col w-72 h-full bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 border-r border-slate-100">
      <div class="p-8 pb-4 flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 text-white">
          <Pizza size={22} />
        </div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900">JuanchoPizza</h1>
      </div>
      
      <div class="px-6 py-2">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Menú Principal</p>
      </div>

      <nav class="flex-1 px-4 space-y-1.5 overflow-y-auto pb-4 custom-scrollbar">
      {#each visibleNavItems as item}
        {@const Icon = item.icon}
        <a 
          href={item.path} 
          class="flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-200 font-bold text-sm {$page.url.pathname.startsWith(item.path) ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}"
        >
          <Icon size={20} class="{$page.url.pathname.startsWith(item.path) ? 'text-orange-600' : 'text-slate-400'}" />
          <span>{item.name}</span>
        </a>
      {/each}
      </nav>
    
      <div class="p-6">
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 mb-4">
          <div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xl">
            {data.user.nombre.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="font-bold text-slate-800 truncate text-base">{data.user.nombre}</p>
            <p class="text-xs font-bold uppercase tracking-wider text-orange-500">{data.user.rol}</p>
          </div>
        </div>
        <form action="/logout" method="POST">
          <button type="submit" class="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 px-5 py-3 rounded-2xl transition-all font-bold text-sm shadow-sm cursor-pointer">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>

    <!-- Mobile Menu Overlay -->
    {#if mobileMenuOpen}
      <div class="md:hidden fixed inset-0 z-50 flex flex-col bg-white text-slate-800">
        <div class="flex justify-between items-center p-6 border-b border-slate-100">
          <div class="flex items-center gap-3">
             <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm">
               <Pizza size={18} />
             </div>
             <h1 class="text-xl font-black text-slate-900">JuanchoPizza</h1>
          </div>
          <button onclick={() => mobileMenuOpen = false} class="p-2 text-slate-400 hover:text-slate-700">
            <X size={24} />
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto p-4 space-y-2">
          {#each visibleNavItems as item}
            {@const Icon = item.icon}
            <a 
              href={item.path} 
              onclick={() => mobileMenuOpen = false}
              class="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-medium text-base {$page.url.pathname.startsWith(item.path) ? 'bg-orange-50 text-orange-600' : 'text-slate-600'}"
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </a>
          {/each}
        </nav>
      </div>
    {/if}
  {/if}

  <!-- Main Content Area -->
  <main class="flex-1 flex flex-col h-full overflow-hidden relative">
    {#if data.user}
    <!-- Header -->
    <header class="h-20 bg-white/80 backdrop-blur-md z-10 sticky top-0 flex items-center justify-between px-8 border-b border-slate-100">
      <div class="flex items-center gap-4 md:hidden">
        <button onclick={() => mobileMenuOpen = true} class="text-slate-700 p-2 bg-slate-50 rounded-xl">
          <Menu size={20} />
        </button>
      </div>
      
      <!-- Greeting / Breadcrumb placeholder -->
      <div class="hidden md:block">
        <h2 class="text-lg font-bold text-slate-800">¡Hola, {data.user.nombre}!</h2>
        <p class="text-sm text-slate-500">Bienvenido al sistema de gestión</p>
      </div>

      <div class="flex items-center gap-4 ml-auto relative">
        <!-- Botón de Campana con Badge Dinámico -->
        <button 
          type="button"
          onclick={() => notificacionesOpen = !notificacionesOpen}
          class="relative bg-white p-2.5 rounded-full shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all text-slate-600 focus:ring-2 focus:ring-orange-500/30"
          title="Notificaciones y Alertas de Inventario"
        >
          <Bell size={18} />
          {#if conteoAlertas > 0}
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center border-2 border-white animate-pulse">
              {conteoAlertas}
            </span>
          {/if}
        </button>

        <!-- Panel Desplegable de Notificaciones -->
        {#if notificacionesOpen}
          <!-- Backdrop transparente para cerrar al hacer clic afuera -->
          <div 
            class="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" 
            onclick={() => notificacionesOpen = false}
            aria-hidden="true"
          ></div>

          <div 
            class="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
            style="background-color: #ffffff;"
          >
            <!-- Cabecera de Notificaciones -->
            <div class="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div class="flex items-center gap-2">
                <Bell size={16} class="text-orange-400" />
                <span class="font-extrabold text-sm">Centro de Notificaciones</span>
              </div>
              <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {conteoAlertas} {conteoAlertas === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>

            <!-- Lista de Alertas -->
            <div class="max-h-96 overflow-y-auto divide-y divide-slate-100 p-2 bg-white">
              {#if alertas.length === 0}
                <div class="py-8 px-4 text-center bg-white">
                  <CheckCircle2 size={36} class="text-emerald-500 mx-auto mb-2" />
                  <p class="font-bold text-slate-800 text-sm">¡Todo está al día!</p>
                  <p class="text-xs text-slate-400 mt-1">No hay ingredientes agotados ni insumos críticos pendientes de reposición.</p>
                </div>
              {:else}
                {#each alertas as alerta}
                  <div class="p-3.5 hover:bg-slate-50 rounded-2xl transition-colors flex items-start gap-3 bg-white">
                    <div class="p-2 rounded-xl shrink-0 {alerta.nivel === 'urgente' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}">
                      <AlertTriangle size={16} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-1">
                        <h4 class="font-bold text-slate-900 text-xs truncate">{alerta.titulo}</h4>
                        <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded {alerta.nivel === 'urgente' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}">
                          {alerta.nivel === 'urgente' ? 'Agotado' : 'Bajo'}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5 leading-snug">{alerta.detalle}</p>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Pie de Notificaciones con Enlace Directo -->
            <div class="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
              <a 
                href="/bodega" 
                onclick={() => notificacionesOpen = false}
                class="font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Ir a Bodega para reponer stock <ArrowRight size={14} />
              </a>
              <button 
                type="button" 
                onclick={() => notificacionesOpen = false}
                class="text-slate-400 hover:text-slate-700 font-bold px-2 py-1 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        {/if}
      </div>
    </header>
    {/if}

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8">
      {@render children()}
    </div>
  </main>
</div>
