<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, slide } from 'svelte/transition';
  let { form } = $props();

  let rangoInicio = $state('');
  let rangoFin = $state('');
  let totalReal = $state('');
</script>

<div class="max-w-4xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Corte Semanal</h1>
    <p class="text-slate-500 text-sm mt-1">Consolida los cierres diarios, declara el efectivo físico y el sistema calculará la diferencia (Sobrante o Faltante).</p>
  </div>

  {#if form?.error}
    <div transition:fade class="bg-red-100 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  {#if form?.success}
    <div transition:slide class="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-8 text-center overflow-hidden relative">
      <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
      <h2 class="text-2xl font-black text-slate-800 mb-2">Resumen del Corte Registrado</h2>
      <p class="text-slate-500 mb-6">El corte semanal ha sido guardado exitosamente.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Esperado (Sistema)</span>
          <span class="block text-3xl font-black text-slate-700">${form.totalCalculado?.toFixed(2)}</span>
        </div>
        
        <div class="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Real (Físico)</span>
          <span class="block text-3xl font-black text-slate-700">${form.totalReal?.toFixed(2)}</span>
        </div>

        <div class="p-6 rounded-xl border {form.diferencia === 0 ? 'bg-emerald-50 border-emerald-200' : form.diferencia > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}">
          <span class="block text-xs font-bold uppercase tracking-wider mb-1 {form.diferencia === 0 ? 'text-emerald-600' : form.diferencia > 0 ? 'text-blue-600' : 'text-red-600'}">
            {form.diferencia === 0 ? 'Cuadre Perfecto' : form.diferencia > 0 ? 'Sobrante a favor' : 'Faltante en caja'}
          </span>
          <span class="block text-3xl font-black {form.diferencia === 0 ? 'text-emerald-700' : form.diferencia > 0 ? 'text-blue-700' : 'text-red-700'}">
            ${Math.abs(form.diferencia || 0).toFixed(2)}
          </span>
        </div>
      </div>

      <button onclick={() => window.location.reload()} class="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">
        Registrar otro corte
      </button>
    </div>
  {:else}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
      <form method="POST" use:enhance class="space-y-6">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="rangoInicio" class="block text-sm font-medium text-slate-700 mb-2">Fecha Inicio (Ej: Jueves)</label>
            <input 
              type="date" 
              id="rangoInicio" 
              name="rangoInicio" 
              bind:value={rangoInicio}
              required 
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-medium text-slate-800"
            />
          </div>

          <div>
            <label for="rangoFin" class="block text-sm font-medium text-slate-700 mb-2">Fecha Fin (Ej: Domingo / Festivo)</label>
            <input 
              type="date" 
              id="rangoFin" 
              name="rangoFin" 
              bind:value={rangoFin}
              min={rangoInicio}
              required 
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-medium text-slate-800"
            />
          </div>
        </div>

        <div class="border-t border-slate-100 pt-6">
          <label for="totalReal" class="block text-sm font-medium text-slate-700 mb-2">
            Total Real (Contado Físicamente)
            <span class="block text-xs text-slate-500 font-normal mt-1">Suma todos los billetes y monedas que recolectaste en este rango de fechas.</span>
          </label>
          <div class="relative max-w-sm">
            <span class="absolute left-4 top-3.5 text-slate-400 font-bold text-xl">$</span>
            <input 
              type="number" 
              id="totalReal" 
              name="totalReal" 
              bind:value={totalReal}
              step="0.01" 
              min="0" 
              required 
              class="w-full pl-10 pr-4 py-4 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-black text-2xl text-slate-800"
              placeholder="0.00"
            />
          </div>
        </div>

        <div class="pt-6 border-t border-slate-100">
          <button 
            type="submit" 
            class="w-full md:w-auto py-4 px-8 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold rounded-xl hover:from-slate-900 hover:to-black transition-all shadow-md flex justify-center items-center gap-2 text-lg"
          >
            <span>⚖️</span> Guardar y Comparar Corte
          </button>
        </div>
        
      </form>
    </div>
  {/if}
</div>
