<script lang="ts">
  import { displayStock } from '$lib/utils/fractions';
  let { data } = $props();

  function formatDate(dateStr: string | Date | null) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="max-w-7xl mx-auto space-y-8">
  
  <!-- Header and Actions -->
  <div class="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
    <div>
      <h1 class="text-3xl font-bold text-slate-800">Panel de Inventario</h1>
      <p class="text-slate-500 text-sm mt-1">Control visual del stock y valoración actual de la bodega.</p>
    </div>
    <div class="flex gap-2">
      <a href="/inventory/compra" class="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm flex items-center gap-2">
        <span>🛒</span> Ingresar Compra
      </a>
      <a href="/inventory/conteo" class="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm flex items-center gap-2">
        <span>📋</span> Conteo Físico
      </a>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="glass-panel p-6 rounded-3xl shadow-sm border border-slate-200/50 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-slate-500 font-medium">Productos Activos</h3>
        <span class="p-3 bg-blue-100 text-blue-600 rounded-2xl">📦</span>
      </div>
      <p class="text-4xl font-black text-slate-800">{data.kpis.totalProductos}</p>
    </div>

    <div class="glass-panel p-6 rounded-3xl shadow-sm border border-slate-200/50 flex flex-col justify-between hover:shadow-md transition-shadow bg-gradient-to-br from-white/60 to-emerald-50/50">
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-emerald-700 font-medium">Capital Invertido (Bodega)</h3>
        <span class="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">💰</span>
      </div>
      <p class="text-4xl font-black text-emerald-600">${data.kpis.valorTotalInventario.toFixed(2)}</p>
      <p class="text-xs text-emerald-500/70 mt-2">* Calculado en base al stock actual y costo de compra</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Main Inventory Table -->
    <div class="lg:col-span-2 glass-panel rounded-3xl shadow-sm border border-slate-200/50 overflow-hidden flex flex-col">
      <div class="p-6 border-b border-slate-200/50">
        <h2 class="text-lg font-bold text-slate-800">Estado Actual del Stock</h2>
      </div>
      <div class="overflow-x-auto flex-1">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <th class="p-4 font-medium">Producto</th>
              <th class="p-4 font-medium">Categoría</th>
              <th class="p-4 font-medium text-right">Stock</th>
              <th class="p-4 font-medium text-right">Valor Aprox</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.inventory as item}
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4">
                  <a href={`/inventory/${item.id}/history`} class="block font-bold text-slate-800 hover:text-blue-600 transition-colors">
                    {item.nombre}
                  </a>
                </td>
                <td class="p-4 text-slate-500 text-sm">
                  <span class="bg-slate-100 px-2 py-1 rounded text-xs font-medium">{item.categoria || 'Sin Categoría'}</span>
                </td>
                <td class="p-4 text-right">
                  <span class="font-bold {item.stockActual !== null && item.stockActual <= (item.stockMinimo ?? 5) ? 'text-red-600 bg-red-50 px-2 py-1 rounded-lg' : 'text-slate-700'}">
                    {displayStock(item.stockActual, item.unidadMedida)}
                  </span>
                  <span class="text-xs text-slate-400 capitalize">{item.unidadMedida}s</span>
                </td>
                <td class="p-4 text-right text-slate-600 font-medium">
                  ${((item.stockActual || 0) * Number(item.precio || 0)).toFixed(2)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="glass-panel rounded-3xl shadow-sm border border-slate-200/50 p-6 flex flex-col">
      <h2 class="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span>🕒</span> Actividad Reciente
      </h2>
      
      {#if data.movimientos.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
          <p>No hay movimientos registrados.</p>
        </div>
      {:else}
        <ul class="space-y-4">
          {#each data.movimientos as mov}
            <li class="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0">
              <div class="p-2 rounded-xl mt-1 {
                mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-600' :
                mov.tipo === 'salida' ? 'bg-orange-100 text-orange-600' :
                'bg-blue-100 text-blue-600'
              }">
                {#if mov.tipo === 'entrada'} 📈
                {:else if mov.tipo === 'salida'} 📉
                {:else} ⚙️ {/if}
              </div>
              <div class="flex-1">
                <p class="font-bold text-slate-800 text-sm">
                  {mov.producto}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">{formatDate(mov.fecha)}</p>
              </div>
              <div class="text-right">
                <span class="font-black text-sm {mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-orange-600'}">
                  {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
                </span>
                <span class="text-[10px] text-slate-400 block uppercase">{mov.unidad}</span>
              </div>
            </li>
          {/each}
        </ul>
        <div class="mt-4 text-center">
          <p class="text-xs text-slate-400 italic">Mostrando los últimos {data.movimientos.length} eventos</p>
        </div>
      {/if}
    </div>
  </div>
</div>
