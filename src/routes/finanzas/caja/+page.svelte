<script lang="ts">
  import { enhance } from '$app/forms';
  let { form, data } = $props();

  let fechaHoy = new Date().toISOString().split('T')[0];
  let fechaSeleccionada = $state(fechaHoy);
</script>

<div class="max-w-4xl mx-auto space-y-6">
  <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div class="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold mb-2">
      <span>📥</span> Cierre Diario de Operaciones
    </div>
    <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Cierre de Caja Diario</h1>
    <p class="text-slate-500 text-sm mt-1">Consolida automáticamente todos los turnos y gastos ocurridos en una fecha para fijar las finanzas del día.</p>
  </div>

  {#if form?.success}
    <div class="bg-emerald-50 text-emerald-800 p-5 rounded-2xl shadow-sm border border-emerald-200 flex items-center gap-3">
      <span class="text-2xl">✅</span>
      <div>
        <span class="font-bold text-base">¡Cierre consolidado con éxito!</span>
        <p class="text-xs text-emerald-700 mt-0.5">{form.message}</p>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-50 text-red-700 p-5 rounded-2xl shadow-sm border border-red-200 flex items-center gap-3">
      <span class="text-2xl">⚠️</span>
      <div>
        <span class="font-bold text-base">No se pudo procesar</span>
        <p class="text-xs text-red-600 mt-0.5">{form.error}</p>
      </div>
    </div>
  {/if}

  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
    <form method="POST" use:enhance class="space-y-6">
      <div>
        <label for="fecha" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fecha a Consolidar</label>
        <div class="max-w-md">
          <input 
            type="date" 
            id="fecha" 
            name="fecha" 
            bind:value={fechaSeleccionada}
            required 
            class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold text-slate-800"
          />
        </div>
        <p class="text-xs text-slate-400 mt-2">
          El sistema sumará todos los turnos registrados (Efectivo y Nequi) más los gastos reportados en esta fecha exacta.
        </p>
      </div>

      <div class="pt-4 border-t border-slate-100">
        <button 
          type="submit" 
          class="w-full md:w-auto py-3.5 px-8 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-md flex justify-center items-center gap-2"
        >
          <span>📥</span> Generar Cierre del Día
        </button>
      </div>
    </form>
  </div>

  <!-- Historial de cierres de caja -->
  {#if data?.ultimosCierres && data.ultimosCierres.length > 0}
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100">
        <h2 class="text-lg font-extrabold text-slate-900">Últimos Cierres Registrados</h2>
        <p class="text-xs text-slate-400 mt-0.5">Historial de días consolidados en la base de datos.</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
              <th class="p-4 pl-6">Fecha</th>
              <th class="p-4 text-right">Efectivo</th>
              <th class="p-4 text-right">Nequi</th>
              <th class="p-4 text-right text-red-500">Gastos</th>
              <th class="p-4 text-right pr-6 font-bold text-slate-800">Total Consolidado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            {#each data.ultimosCierres as c}
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="p-4 pl-6 font-bold text-slate-800">
                  {c.fecha ? new Date(c.fecha).toISOString().split('T')[0] : '-'}
                </td>
                <td class="p-4 text-right text-slate-600 font-semibold">${Number(c.totalEfectivo).toLocaleString('es-CO')}</td>
                <td class="p-4 text-right text-purple-600 font-semibold">${Number(c.totalTransferencias).toLocaleString('es-CO')}</td>
                <td class="p-4 text-right text-red-500 font-semibold">-${Number(c.totalGastos).toLocaleString('es-CO')}</td>
                <td class="p-4 text-right pr-6 font-black text-slate-900">${(Number(c.totalEfectivo) + Number(c.totalTransferencias)).toLocaleString('es-CO')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
