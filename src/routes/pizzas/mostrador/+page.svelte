<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade } from 'svelte/transition';
  let { data, form } = $props();
</script>

<div class="max-w-5xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Auditoría de Mostrador (Boleo)</h1>
    <p class="text-slate-500 text-sm mt-1">Ingresa las nuevas pizzas horneadas y cuenta las que quedan físicamente en la bandeja para calcular las ventas automáticamente.</p>
  </div>

  {#if form?.success}
    <div transition:fade class="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 shadow-sm border border-emerald-200">
      <span class="font-bold text-lg block mb-1">¡Auditoría Registrada! ✅</span> 
      <span class="whitespace-pre-line text-sm">{form.message}</span>
    </div>
  {/if}

  {#if form?.error}
    <div transition:fade class="bg-red-50 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    {#if data.sabores.length === 0}
      <div class="p-8 text-center text-slate-500">
        No hay sabores activos. Pídele al jefe que agregue sabores en Configuración.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <th class="p-4 font-medium w-1/3">Sabor</th>
              <th class="p-4 font-medium text-center text-blue-600 bg-blue-50/50">Nuevas Porciones Horneadas</th>
              <th class="p-4 font-medium text-center text-orange-600 bg-orange-50/50">Quedan (Físico Actual)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.sabores as sabor}
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4">
                  <span class="block font-bold text-slate-800">{sabor.nombre}</span>
                  <span class="text-xs font-medium text-slate-500">
                    Sistema indica: {sabor.disponibles} disp. (${sabor.precioPorcion} c/u)
                  </span>
                </td>
                
                <td class="p-4 bg-blue-50/20">
                  <div class="flex justify-center">
                    <input 
                      type="number" 
                      name="nuevas_{sabor.id}" 
                      min="0" 
                      step="1"
                      placeholder="0" 
                      class="w-24 px-4 py-2 text-center font-bold text-blue-700 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm placeholder:text-slate-300"
                    />
                  </div>
                </td>

                <td class="p-4 bg-orange-50/20">
                  <div class="flex justify-center">
                    <input 
                      type="number" 
                      name="actuales_{sabor.id}" 
                      min="0" 
                      step="0.5"
                      placeholder="Quedan..." 
                      class="w-32 px-4 py-2 text-center font-black text-orange-700 bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none shadow-sm placeholder:text-slate-300"
                    />
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      <div class="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
        <button 
          type="submit" 
          class="py-3 px-8 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg text-lg flex items-center gap-2"
        >
          <span>📊</span> Procesar Boleo
        </button>
      </div>
    {/if}
  </form>
</div>
