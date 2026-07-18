<script lang="ts">
  import { page } from '$app/stores';
  let { children } = $props();

  const tabs = [
    { name: 'Resumen Financiero', path: '/finanzas/resumen', icon: '📊' },
    { name: 'Caja Diaria', path: '/finanzas/caja', icon: '📥' },
    { name: 'Corte Semanal', path: '/finanzas/semanal', icon: '⚖️' },
    { name: 'Reporte Mensual (PDF)', path: '/finanzas/mensual', icon: '📄' }
  ];
</script>

<div class="max-w-6xl mx-auto space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-slate-800">Centro Financiero</h1>
    <p class="text-slate-500">Maneja toda la contabilidad del negocio desde un solo lugar.</p>
  </div>

  <!-- Tabs Navigation -->
  <div class="glass-panel rounded-2xl p-2 flex overflow-x-auto custom-scrollbar shadow-sm border border-slate-200/50">
    {#each tabs as tab}
      <a 
        href={tab.path}
        class="flex items-center gap-2 px-6 py-3 rounded-xl whitespace-nowrap font-medium transition-all { $page.url.pathname === tab.path ? 'bg-slate-800 text-orange-400 shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }"
      >
        <span>{tab.icon}</span>
        {tab.name}
      </a>
    {/each}
  </div>

  <!-- Tab Content -->
  <div class="pt-4">
    {@render children()}
  </div>
</div>
