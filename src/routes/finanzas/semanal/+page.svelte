<script lang="ts">
  import { enhance } from '$app/forms';
  let { form, data } = $props();

  let rangoInicio = $state('');
  let rangoFin = $state('');
  let totalReal = $state('');
</script>

<div class="max-w-5xl mx-auto space-y-6">
  <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-2">
      <span>⚖️</span> Auditoría de Efectivo
    </div>
    <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Corte Semanal</h1>
    <p class="text-slate-500 text-sm mt-1">Consolida los cierres diarios, declara el efectivo físico contado y verifica si hay faltantes o sobrantes.</p>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-700 p-4 rounded-2xl shadow-sm border border-red-200 flex items-center gap-3">
      <span class="text-xl">⚠️</span>
      <div>
        <span class="font-bold">Aviso:</span> {form.error}
      </div>
    </div>
  {/if}

  {#if form?.success}
    <div class="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 text-center overflow-hidden relative">
      <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500"></div>
      <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
        ✓
      </div>
      <h2 class="text-2xl font-black text-slate-900 mb-1">Corte Semanal Guardado</h2>
      <p class="text-slate-500 text-sm mb-8">El balance ha sido auditado y guardado en la base de datos.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-3xl mx-auto">
        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <span class="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Esperado (Sistema)</span>
          <span class="block text-3xl font-black text-slate-800">${form.totalCalculado?.toLocaleString('es-CO')}</span>
        </div>
        
        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <span class="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Físico (Contado)</span>
          <span class="block text-3xl font-black text-slate-800">${form.totalReal?.toLocaleString('es-CO')}</span>
        </div>

        <div class="p-6 rounded-2xl border {form.diferencia === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : form.diferencia > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}">
          <span class="block text-xs font-black uppercase tracking-wider mb-1 {form.diferencia === 0 ? 'text-emerald-600' : form.diferencia > 0 ? 'text-blue-600' : 'text-red-600'}">
            {form.diferencia === 0 ? 'Cuadre Perfecto' : form.diferencia > 0 ? 'Sobrante en Caja' : 'Faltante en Caja'}
          </span>
          <span class="block text-3xl font-black">
            {form.diferencia > 0 ? '+' : ''}${form.diferencia?.toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      <button onclick={() => window.location.reload()} class="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-md">
        Registrar otro corte
      </button>
    </div>
  {:else}
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
      <form method="POST" use:enhance class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="rangoInicio" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fecha Inicio (Ej: Jueves)</label>
            <input 
              type="date" 
              id="rangoInicio" 
              name="rangoInicio" 
              bind:value={rangoInicio}
              required 
              class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold text-slate-800"
            />
          </div>

          <div>
            <label for="rangoFin" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fecha Fin (Ej: Domingo / Festivo)</label>
            <input 
              type="date" 
              id="rangoFin" 
              name="rangoFin" 
              bind:value={rangoFin}
              min={rangoInicio}
              required 
              class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold text-slate-800"
            />
          </div>
        </div>

        <div class="border-t border-slate-100 pt-6">
          <label for="totalReal" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Efectivo Físico Recolectado
            <span class="block text-xs text-slate-400 font-normal mt-0.5 capitalize">Total billetes y monedas que tienes en la mano.</span>
          </label>
          <div class="relative max-w-md">
            <span class="absolute left-4 top-3.5 text-slate-400 font-black text-2xl">$</span>
            <input 
              type="number" 
              id="totalReal" 
              name="totalReal" 
              bind:value={totalReal}
              step="100" 
              min="0" 
              required 
              class="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-black text-3xl text-slate-900"
              placeholder="0"
            />
          </div>
        </div>

        <div class="pt-4">
          <button 
            type="submit" 
            class="w-full md:w-auto py-4 px-10 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2 text-base"
          >
            <span>⚖️</span> Guardar y Comparar Corte
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Historial de Cortes Previos -->
  {#if data?.ultimosCortes && data.ultimosCortes.length > 0}
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100">
        <h2 class="text-lg font-extrabold text-slate-900">Historial de Cortes Semanales</h2>
        <p class="text-xs text-slate-400 mt-0.5">Auditorías de caja registradas recientemente.</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
              <th class="p-4 pl-6">Fecha Registro</th>
              <th class="p-4">Rango Evaluado</th>
              <th class="p-4 text-right">Esperado</th>
              <th class="p-4 text-right">Físico</th>
              <th class="p-4 text-right pr-6">Diferencia</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            {#each data.ultimosCortes as corte}
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="p-4 pl-6 font-bold text-slate-800">
                  {corte.fechaCorte ? new Date(corte.fechaCorte).toLocaleDateString('es-CO') : '-'}
                </td>
                <td class="p-4 text-slate-600 text-xs font-semibold">
                  {corte.rangoInicio ? new Date(corte.rangoInicio).toLocaleDateString('es-CO') : ''} al {corte.rangoFin ? new Date(corte.rangoFin).toLocaleDateString('es-CO') : ''}
                </td>
                <td class="p-4 text-right font-semibold text-slate-700">${Number(corte.totalCalculado).toLocaleString('es-CO')}</td>
                <td class="p-4 text-right font-black text-slate-900">${Number(corte.totalReal).toLocaleString('es-CO')}</td>
                <td class="p-4 text-right pr-6">
                  <span class="px-3 py-1 rounded-full text-xs font-black {Number(corte.diferencia) === 0 ? 'bg-emerald-100 text-emerald-700' : Number(corte.diferencia) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}">
                    {Number(corte.diferencia) > 0 ? '+' : ''}${Number(corte.diferencia).toLocaleString('es-CO')}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
