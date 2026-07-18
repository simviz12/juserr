<script lang="ts">
  let { data } = $props();

  let totalVentas = $derived(data.resumen.reduce((acc, curr) => acc + (curr.porcionesVendidas * Number(curr.precioPorcion)), 0));
</script>

<div class="max-w-6xl mx-auto">
  <div class="mb-6 flex justify-between items-end">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Resumen de Pizzas</h1>
      <p class="text-slate-500 text-sm mt-1">Operación del día de hoy.</p>
    </div>
    {#if totalVentas > 0}
      <div class="text-right">
        <span class="text-xs text-slate-500 font-bold uppercase tracking-wider block">Ingreso Estimado</span>
        <span class="text-3xl font-black text-emerald-600">${totalVentas.toFixed(2)}</span>
      </div>
    {/if}
  </div>

  {#if data.resumen.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
      <div class="text-6xl mb-4">🍕</div>
      <h2 class="text-xl font-bold text-slate-800">Sin Movimientos Hoy</h2>
      <p class="text-slate-500 mt-2">Aún no se ha registrado la cocción de ninguna pizza el día de hoy.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.resumen as item}
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div class="bg-slate-800 text-white p-4">
            <h3 class="font-bold text-lg">{item.nombre}</h3>
            <p class="text-slate-300 text-sm">{item.ruedasHechas} ruedas hechas hoy</p>
          </div>
          
          <div class="p-5 flex-1 grid grid-cols-2 gap-4">
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <span class="block text-xs text-slate-500 font-medium mb-1">Porciones Hechas</span>
              <span class="block text-xl font-black text-slate-800">{item.porcionesHechas}</span>
            </div>
            
            <div class="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <span class="block text-xs text-emerald-600 font-medium mb-1">Vendidas</span>
              <span class="block text-xl font-black text-emerald-700">{item.porcionesVendidas}</span>
            </div>

            <div class="bg-orange-50 rounded-xl p-3 border border-orange-100 col-span-2 flex justify-between items-center">
              <div>
                <span class="block text-xs text-orange-600 font-medium mb-1">Sobrantes Registradas</span>
                <span class="block text-xl font-black text-orange-700">{item.porcionesSobrantes}</span>
              </div>
              {#if item.porcionesSobrantes === 0 && item.porcionesHechas > item.porcionesVendidas}
                <span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-md">
                  Cierre pendiente
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
