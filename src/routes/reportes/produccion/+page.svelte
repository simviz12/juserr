<script lang="ts">
  let { data } = $props();
</script>

<div class="max-w-5xl mx-auto">
  <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Reporte de Producción (Masas)</h1>
      <p class="text-slate-500 text-sm mt-1">Consumo de masas y venta de porciones en el tiempo.</p>
    </div>
    
    <form class="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm" data-sveltekit-noscroll data-sveltekit-keepfocus>
      <div class="flex flex-col">
        <label for="inicio" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Desde</label>
        <input type="date" id="inicio" name="inicio" bind:value={data.inicio} class="text-sm px-2 py-1 outline-none text-slate-700 font-medium" onchange={(e) => (e.target as HTMLInputElement).form?.submit()}>
      </div>
      <span class="text-slate-300">-</span>
      <div class="flex flex-col">
        <label for="fin" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Hasta</label>
        <input type="date" id="fin" name="fin" bind:value={data.fin} class="text-sm px-2 py-1 outline-none text-slate-700 font-medium" onchange={(e) => (e.target as HTMLInputElement).form?.submit()}>
      </div>
    </form>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
    {#if data.produccion.length === 0}
      <div class="text-center py-12 text-slate-500">
        <span class="text-4xl mb-4 block">📊</span>
        <p>No hay datos de producción registrados en este rango de fechas.</p>
      </div>
    {:else}
      <div class="space-y-6">
        {#each data.produccion as p}
          <div>
            <div class="flex justify-between items-end mb-2">
              <div>
                <span class="font-bold text-slate-800 block">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CO')}</span>
                <span class="text-xs text-slate-500">{p.porcionesVendidas} porciones vendidas</span>
              </div>
              <span class="font-black text-orange-600">{p.masasConsumidas} Masas consumidas</span>
            </div>
            
            <div class="w-full bg-slate-100 rounded-full h-4 overflow-hidden flex">
              <div 
                class="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all duration-1000 ease-out"
                style="width: {data.maxProduccion > 0 ? (p.masasConsumidas / data.maxProduccion) * 100 : 0}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
