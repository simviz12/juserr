<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade } from 'svelte/transition';
  import { displayStock } from '$lib/utils/fractions';
  let { data, form } = $props();
</script>

<div class="max-w-4xl mx-auto">
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Conteo Físico (Nevera)</h1>
      <p class="text-slate-500 text-sm mt-1">Anota exactamente lo que ves en la nevera. El sistema ajustará las ventas/salidas por ti.</p>
    </div>
    <a href="/inventory" class="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-4 py-2 rounded-xl transition-colors">
      Volver
    </a>
  </div>

  {#if form?.success}
    <div transition:fade class="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 shadow-sm border border-emerald-200">
      <span class="font-bold">¡Éxito!</span> {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div transition:fade class="bg-red-50 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
            <th class="p-4 font-medium">Producto</th>
            <th class="p-4 font-medium text-center">En Sistema</th>
            <th class="p-4 font-medium text-center">Físico en Nevera</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.inventory as item}
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="p-4">
                <span class="block font-bold text-slate-800">{item.nombre}</span>
                <span class="text-xs text-slate-500 capitalize">{item.unidadMedida}s</span>
              </td>
              <td class="p-4 text-center text-slate-600 font-medium">
                {displayStock(item.stockActual, item.unidadMedida)}
              </td>
              <td class="p-4">
                <div class="flex justify-center">
                  <input 
                    type="number" 
                    name="conteo_{item.id}" 
                    min="0" 
                    step="0.01"
                    placeholder="Dejar vacío si no cambió"
                    class="w-48 px-4 py-2 text-center font-bold text-orange-700 bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none shadow-sm placeholder:text-slate-300 placeholder:font-normal"
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
        class="py-3 px-8 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-all shadow-md hover:shadow-lg text-lg flex items-center gap-2"
      >
        <span>📋</span> Guardar Conteo
      </button>
    </div>
  </form>
</div>
