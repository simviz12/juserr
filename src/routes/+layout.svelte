<script lang="ts">
  import './layout.css';
  import { enhance } from '$app/forms';
  let { children, data } = $props();
  
  const navItems = [
    { name: 'Dashboard Diario', path: '/dashboard', icon: '📈', roles: ['jefe'] },
    { name: 'Centro Financiero', path: '/finanzas/resumen', icon: '💼', roles: ['jefe'] },
    { name: 'Dashboard (Inventario)', path: '/inventory', icon: '📊', roles: ['jefe'] },
    { name: 'Ingreso de Compras', path: '/inventory/compra', icon: '🛒', roles: ['jefe', 'bodeguero'] },
    { name: 'Conteo Físico', path: '/inventory/conteo', icon: '📋', roles: ['jefe', 'bodeguero'] },
    { name: 'Gestión de Personal', path: '/configuracion/personal', icon: '👥', roles: ['jefe'] },
    { name: 'Catálogo de Productos', path: '/productos', icon: '📦', roles: ['jefe'] },
    { name: 'Catálogo de Bebidas', path: '/bebidas', icon: '🥤', roles: ['jefe'] },
    { name: 'Categorías de Inventario', path: '/configuracion/categorias', icon: '🏷️', roles: ['jefe'] },
    { name: 'Sabores de Pizza', path: '/configuracion/sabores', icon: '🍕', roles: ['jefe'] },
    { name: 'Auditoría Mostrador', path: '/pizzas/mostrador', icon: '🍕', roles: ['jefe', 'empleado', 'cajero'] },
    { name: 'Auditoría Bebidas', path: '/bebidas/venta', icon: '🥤', roles: ['jefe', 'empleado', 'cajero'] },
    { name: 'Cierre de Turno', path: '/turnos/cierre', icon: '🔒', roles: ['jefe', 'empleado', 'cajero'] },
    { name: 'Ranking de Sabores', path: '/reportes/sabores', icon: '🏆', roles: ['jefe'] }
  ];

  let visibleNavItems = $derived(navItems.filter(item => data.user && item.roles.includes(data.user.rol)));
  let mobileMenuOpen = $state(false);
</script>

<div class="flex h-screen w-full text-slate-900 overflow-hidden bg-transparent">
  {#if data.user}
    <!-- Desktop Sidebar Navigation -->
    <aside class="hidden md:flex flex-col w-64 h-full glass-sidebar text-slate-300 shadow-2xl z-20">
      <div class="p-6 flex items-center gap-3 border-b border-white/10">
        <img src="/logo.png" alt="JuanchoPizza Logo" class="h-8 w-auto rounded-lg shadow-sm" />
        <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">JuanchoPizza</h1>
      </div>
      
      <nav class="flex-1 px-4 space-y-2 mt-2 overflow-y-auto pb-4 custom-scrollbar">
      {#each visibleNavItems as item}
        <a 
          href={item.path} 
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-slate-800 hover:text-orange-400 font-medium"
        >
          <span class="text-xl">{item.icon}</span>
          <span>{item.name}</span>
        </a>
      {/each}
    </nav>
    
    <div class="p-4 border-t border-slate-800">
      {#if data.user}
        <div class="flex flex-col gap-2 mb-4 text-sm text-slate-300 bg-slate-800 p-3 rounded-xl">
          <span class="font-bold text-white">{data.user.nombre}</span>
          <span class="text-xs uppercase tracking-wider text-orange-400">{data.user.rol}</span>
        </div>
        <form action="/logout" method="POST" use:enhance>
          <button type="submit" class="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm">
            <span>🚪</span> Cerrar sesión
          </button>
        </form>
      {/if}
      <div class="text-xs text-slate-600 text-center mt-4">Version 1.0</div>
    </div>
  </aside>

  <!-- Mobile Menu Overlay -->
  {#if mobileMenuOpen}
    <div class="md:hidden fixed inset-0 z-50 flex flex-col glass-sidebar text-white">
      <div class="flex justify-between items-center p-6 border-b border-white/10">
        <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Pizza System</h1>
        <button onclick={() => mobileMenuOpen = false} class="text-3xl text-slate-300 hover:text-white p-2">×</button>
      </div>
      <nav class="flex-1 overflow-y-auto p-4 space-y-2">
        {#each visibleNavItems as item}
          <a 
            href={item.path} 
            onclick={() => mobileMenuOpen = false}
            class="flex items-center gap-4 px-4 py-4 rounded-xl transition-all hover:bg-slate-800 hover:text-orange-400 font-medium text-lg text-slate-300"
          >
            <span class="text-2xl">{item.icon}</span>
            <span>{item.name}</span>
          </a>
        {/each}
      </nav>
      <div class="p-6 border-t border-slate-800">
        <div class="flex flex-col gap-2 mb-4 text-sm text-slate-300 bg-slate-800 p-4 rounded-xl">
          <span class="font-bold text-white">{data.user.nombre}</span>
          <span class="text-xs uppercase tracking-wider text-orange-400">{data.user.rol}</span>
        </div>
        <form action="/login?/logout" method="POST" use:enhance>
          <button type="submit" class="w-full py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold flex justify-center gap-2 items-center">
            <span>🚪</span> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  {/if}
  {/if}

  <!-- Main Content Area -->
  <main class="flex-1 flex flex-col h-full overflow-hidden relative">
    {#if data.user}
    <!-- Header -->
    <header class="h-16 glass-panel z-10 sticky top-0 flex items-center justify-between px-6 shadow-sm">
      <!-- Hamburger and Title visible only on mobile -->
      <div class="flex items-center gap-3 md:hidden">
        <button onclick={() => mobileMenuOpen = true} class="text-slate-700 text-2xl p-1">
          ☰
        </button>
        <h2 class="text-xl font-bold text-slate-800">Pizza System</h2>
      </div>
      <div class="flex items-center gap-4 ml-auto">
        {#if data.user}
          <div class="text-sm">
            <span class="text-slate-500 block text-right">Usuario</span>
            <span class="font-bold text-slate-800">{data.user.nombre}</span>
            <span class="px-2 py-0.5 ml-2 rounded text-xs font-bold uppercase tracking-wider {data.user.rol === 'jefe' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}">
              {data.user.rol}
            </span>
          </div>
          <form action="/logout" method="POST" use:enhance>
            <button type="submit" class="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors font-medium text-sm">
              Salir
            </button>
          </form>
        {/if}
      </div>
    </header>
    {/if}

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-transparent">
      {@render children()}
    </div>
  </main>
</div>
