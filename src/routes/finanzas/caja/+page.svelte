<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade } from 'svelte/transition';
  let { form } = $props();

  // Fecha por defecto: hoy en formato YYYY-MM-DD
  let fechaHoy = new Date().toISOString().split('T')[0];
  let fechaSeleccionada = $state(fechaHoy);
</script>

<div class="max-w-3xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Cierre de Caja Diario</h1>
    <p class="text-slate-500 text-sm mt-1">Suma todos los turnos del día y consolida el efectivo total reportado.</p>
  </div>

  {#if form?.success}
    <div transition:fade class="bg-green-100 text-green-800 p-4 rounded-xl mb-6 shadow-sm border border-green-200">
      <span class="font-bold">¡Éxito!</span> {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div transition:fade class="bg-red-100 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
    <form method="POST" use:enhance class="space-y-6">
      
      <div>
        <label for="fecha" class="block text-sm font-medium text-slate-700 mb-2">Seleccione la Fecha a Consolidar</label>
        <input 
          type="date" 
          id="fecha" 
          name="fecha" 
          bind:value={fechaSeleccionada}
          required 
          class="w-full md:w-1/2 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-medium text-slate-800"
        />
        <p class="text-xs text-slate-500 mt-2">El sistema buscará y sumará automáticamente el efectivo final de todos los turnos registrados en esta fecha.</p>
      </div>

      <div class="pt-6 border-t border-slate-100">
        <button 
          type="submit" 
          class="w-full md:w-auto py-3 px-8 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md flex justify-center items-center gap-2"
        >
          <span>📥</span> Generar Cierre del Día
        </button>
      </div>
      
    </form>
  </div>
</div>
