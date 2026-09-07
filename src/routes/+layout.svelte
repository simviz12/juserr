<script lang="ts">
  import './layout.css';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  let { children, data } = $props();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📈', roles: ['jefe'] },
    { name: 'Cierre de Turno', path: '/turnos/cierre', icon: '🔒', roles: ['jefe', 'empleado', 'cajero', 'bodeguero'] },
    { name: 'Bodega e Insumos', path: '/bodega', icon: '📦', roles: ['jefe', 'empleado', 'bodeguero'] },
    { name: 'Finanzas', path: '/finanzas/resumen', icon: '💼', roles: ['jefe'] },
    { name: 'Productos', path: '/productos', icon: '🍕', roles: ['jefe'] },
    { name: 'Personal', path: '/configuracion/personal', icon: '👥', roles: ['jefe'] },
  ];

  let visibleNavItems = $derived(navItems.filter(item => data.user && item.roles.includes(data.user.rol)));
  let mobileMenuOpen = $state(false);
</script>

<div class="flex h-screen w-full text-slate-800 bg-slate-50 overflow-hidden font-sans">
  {#if data.user}
    <!-- Desktop Sidebar Navigation -->
    <aside class="hidden md:flex flex-col w-72 h-full bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 border-r border-slate-100">
      <div class="p-8 pb-4 flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 text-white text-xl">
          🍕
        </div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900">JuanchoPizza</h1>
      </div>
      
      <div class="px-6 py-2">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Menú Principal</p>
      </div>

      <nav class="flex-1 px-4 space-y-1 overflow-y-auto pb-4 custom-scrollbar">
      {#each visibleNavItems as item}
        <a 
          href={item.path} 
          data-sveltekit-reload
          class="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 font-medium {$page.url.pathname.startsWith(item.path) ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}"
        >
          <span class="text-xl { $page.url.pathname.startsWith(item.path) ? 'opacity-100' : 'opacity-70' }">{item.icon}</span>
          <span>{item.name}</span>
        </a>
      {/each}
      </nav>
    
      <div class="p-6">
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 mb-4">
          <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
            {data.user.nombre.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="font-bold text-slate-800 truncate">{data.user.nombre}</p>
            <p class="text-xs font-bold uppercase tracking-wider text-orange-500">{data.user.rol}</p>
          </div>
        </div>
        <form action="/logout" method="POST">
          <button type="submit" class="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 px-4 py-3 rounded-xl transition-all font-bold text-sm shadow-sm">
            <span>🚪</span> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>

    <!-- Mobile Menu Overlay -->
    {#if mobileMenuOpen}
      <div class="md:hidden fixed inset-0 z-50 flex flex-col bg-white text-slate-800">
        <div class="flex justify-between items-center p-6 border-b border-slate-100">
          <div class="flex items-center gap-3">
             <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm">🍕</div>
             <h1 class="text-xl font-black text-slate-900">JuanchoPizza</h1>
          </div>
          <button onclick={() => mobileMenuOpen = false} class="text-3xl text-slate-400 p-2">×</button>
        </div>
        <nav class="flex-1 overflow-y-auto p-4 space-y-2">
          {#each visibleNavItems as item}
            <a 
              href={item.path} 
              data-sveltekit-reload
              onclick={() => mobileMenuOpen = false}
              class="flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-medium text-lg {$page.url.pathname.startsWith(item.path) ? 'bg-orange-50 text-orange-600' : 'text-slate-600'}"
            >
              <span class="text-2xl">{item.icon}</span>
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
        <button onclick={() => mobileMenuOpen = true} class="text-slate-700 text-2xl p-2 bg-slate-50 rounded-xl">
          ☰
        </button>
      </div>
      
      <!-- Greeting / Breadcrumb placeholder -->
      <div class="hidden md:block">
        <h2 class="text-lg font-bold text-slate-800">¡Hola, {data.user.nombre}! 👋</h2>
        <p class="text-sm text-slate-500">Bienvenido al sistema de gestión</p>
      </div>

      <div class="flex items-center gap-4 ml-auto">
        <div class="bg-white p-2 rounded-full shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50">
           <span class="text-xl">🔔</span>
        </div>
      </div>
    </header>
    {/if}

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8">
      {@render children()}
    </div>
  </main>
</div>
