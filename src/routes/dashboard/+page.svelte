<script lang="ts">
  import { page } from '$app/stores';
  import { Home, Clock, Truck, BarChart2, Settings, PlusCircle, Search, Bell, User } from '@lucide/svelte';
  let { data } = $props();

  const metaVentas = 2000000;
  let ventaBrutaHoy = $derived({ monto: data.ventasHoy, meta: metaVentas });
  let masasUsadas = $derived(Math.floor(data.totalPorcionesVendidas / 8));
  let masasDisponibles = $derived(data.stockMasasActual || 0);
  let porcionesVendidas = $derived(data.totalPorcionesVendidas); 
  let mermas = $derived({ perdidas: data.saboresDesperdicio.reduce((sum, s) => sum + Number(s.cantidad), 0), total: data.totalPorcionesVendidas });

  const perc = (value: number, total: number) => total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
</script>

<div class="font-sans text-sm">
  <div class="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 mb-6">
    <div class="flex items-center gap-4 w-full max-w-md">
      <div class="relative flex-1">
        <Search size="20" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar..." class="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FF5B29]" />
      </div>
    </div>
  </div>

  <!-- KPI cards -->
  <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
    <!-- Venta Bruta Hoy -->
    <div class="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div class="w-16 h-16 relative">
        <svg viewBox="0 0 36 36" class="w-full h-full">
          <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#FFEDD5" stroke-width="4" />
          <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="#FF5B29" stroke-width="4" stroke-dasharray="{perc(ventaBrutaHoy.monto, ventaBrutaHoy.meta)} 100" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#FF5B29]">{perc(ventaBrutaHoy.monto, ventaBrutaHoy.meta)}%</span>
      </div>
      <div>
        <h3 class="font-medium text-gray-800">Venta Bruta Hoy</h3>
        <p class="text-lg font-bold text-gray-900">${ventaBrutaHoy.monto.toLocaleString('es-CO')}</p>
      </div>
    </div>

    <!-- Masas Reales -->
    <div class="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div class="w-16 h-16 relative flex items-center justify-center bg-orange-50 rounded-2xl text-2xl">
        🍕
      </div>
      <div>
        <h3 class="font-medium text-gray-800">Masas en Bodega</h3>
        <p class="text-lg font-bold text-gray-900">{masasDisponibles} disp. <span class="text-xs text-slate-400 font-normal">({masasUsadas} horneadas)</span></p>
      </div>
    </div>

    <!-- Porciones Vendidas -->
    <div class="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div class="w-16 h-16 relative">
        <svg viewBox="0 0 36 36" class="w-full h-full">
          <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#FFEDD5" stroke-width="4" />
          <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="#FF5B29" stroke-width="4" stroke-dasharray="100 100" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#FF5B29]">—</span>
      </div>
      <div>
        <h3 class="font-medium text-gray-800">Porciones Vendidas</h3>
        <p class="text-lg font-bold text-gray-900">{porcionesVendidas}</p>
      </div>
    </div>

    <!-- Mermas / Desperdicio -->
    <div class="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div class="w-16 h-16 relative">
        <svg viewBox="0 0 36 36" class="w-full h-full">
          <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#FFEDD5" stroke-width="4" />
          <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="#FF5B29" stroke-width="4" stroke-dasharray="{perc(mermas.perdidas, mermas.total)} 100" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#FF5B29]">{perc(mermas.perdidas, mermas.total)}%</span>
      </div>
      <div>
        <h3 class="font-medium text-gray-800">Mermas / Desperdicio</h3>
        <p class="text-lg font-bold text-[#FF5B29]">{mermas.perdidas} pzas.</p>
      </div>
    </div>
  </section>

  <section class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <!-- Top Sabores Vendidos -->
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart2 class="text-[#FF5B29]" /> Top Sabores (Sobras de Ayer - Sobras de Hoy)</h2>
      {#if data.saboresVendidos && data.saboresVendidos.length > 0}
        <ul class="space-y-4">
          {#each data.saboresVendidos as sabor}
            <li class="flex items-center justify-between border-b pb-2 last:border-0">
              <span class="font-medium text-gray-700">{sabor.nombre}</span>
              <span class="bg-[#FFEDD5] text-[#FF5B29] font-bold px-3 py-1 rounded-full">{sabor.cantidad} pts.</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-gray-500 italic">No hay suficientes datos de ventas procesados para mostrar tendencias. ¡Cierra un turno para ver información aquí!</p>
      {/if}
    </div>

    <!-- Alertas de Inventario -->
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><Bell class="text-red-500" /> Alertas de Inventario</h2>
      {#if data.inventarioBajo && data.inventarioBajo.length > 0}
        <ul class="space-y-4">
          {#each data.inventarioBajo as item}
            <li class="flex items-center justify-between border-b pb-2 last:border-0">
              <span class="font-medium text-gray-700">{item.nombre}</span>
              <span class="text-red-600 font-bold px-2 py-1 bg-red-50 rounded-md">Quedan: {item.stockActual} {item.unidadMedida}s (Min: {item.stockMinimo})</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-gray-500 italic flex items-center gap-2"><span class="w-2 h-2 bg-green-500 rounded-full inline-block"></span> Todo el inventario está por encima de los niveles mínimos de alerta. ¡Buen trabajo!</p>
      {/if}
    </div>
  </section>
</div>


