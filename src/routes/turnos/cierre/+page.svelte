<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, slide } from 'svelte/transition';
  let { data, form } = $props();

  let gastos = $state<{ id: number; descripcion: string; monto: string }[]>([]);
  let nextGastoId = 1;

  function addGasto() {
    gastos.push({ id: nextGastoId++, descripcion: '', monto: '' });
  }

  function removeGasto(id: number) {
    gastos = gastos.filter(g => g.id !== id);
  }

  let totalGastos = $derived(gastos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0));
  let granTotalEsperado = $derived(data.ventas.granTotal);
</script>

<div class="max-w-3xl mx-auto">
  <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Cierre de Turno y Gastos</h1>
      <p class="text-slate-500 text-sm mt-1">Registra el efectivo final en caja y declara los gastos realizados en tu turno.</p>
    </div>
    
    <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 min-w-[280px] shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-indigo-800 uppercase tracking-wider">Total de Ventas Hoy</p>
        <p class="text-3xl font-black text-indigo-600">${granTotalEsperado.toLocaleString('es-CO')}</p>
        <div class="text-xs text-indigo-700 mt-1 space-y-0.5">
          <p>🍕 Pizzas: <span class="font-bold">${data.ventas.dineroPizzas.toLocaleString('es-CO')}</span></p>
          <p>🥤 Bebidas: <span class="font-bold">${data.ventas.dineroBebidas.toLocaleString('es-CO')}</span></p>
        </div>
      </div>
    </div>
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

  <form method="POST" use:enhance={() => {
    return async ({ update }) => {
      await update();
      if (form?.success) {
        gastos = [];
      }
    };
  }} class="space-y-6">
    
    <!-- Sección de Caja -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span>💵</span> Efectivo en Caja
      </h2>
      
      <div class="space-y-4">
        <div>
          <label for="monto" class="block text-sm font-medium text-slate-700 mb-1">Total Contado (Efectivo Físico)</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-slate-400 font-bold">$</span>
            <input 
              type="number" 
              id="monto" 
              name="monto" 
              required 
              min="0"
              step="100"
              placeholder="Ej. 150000"
              class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all font-medium text-slate-800"
            />
          </div>
        </div>

        <div>
          <label for="transferencias" class="block text-sm font-medium text-slate-700 mb-1">Total Transferencias (Nequi, etc.)</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-slate-400 font-bold">$</span>
            <input 
              type="number" 
              id="transferencias" 
              name="transferencias" 
              required 
              min="0"
              step="100"
              placeholder="Ej. 50000"
              class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all font-medium text-slate-800"
            />
          </div>
        </div>

        <div>
          <label for="descripcion" class="block text-sm font-medium text-slate-700 mb-1">Observaciones del Turno (Opcional)</label>
          <textarea 
            id="descripcion" 
            name="descripcion" 
            rows="2"
            placeholder="Ej: Faltó billete de $50, el datafono falló en la mañana..."
            class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm resize-none"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Sección de Gastos -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>🧾</span> Gastos del Turno
        </h2>
        <button 
          type="button" 
          onclick={addGasto}
          class="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors"
        >
          + Agregar Gasto
        </button>
      </div>

      {#if gastos.length === 0}
        <div class="text-center py-6 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No has registrado ningún gasto en este turno.
        </div>
      {:else}
        <div class="space-y-3">
          {#each gastos as gasto (gasto.id)}
            <div transition:slide class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input 
                type="text" 
                name="gasto_descripcion" 
                bind:value={gasto.descripcion}
                placeholder="¿En qué se gastó? (Ej: Hielo)" 
                required 
                class="flex-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
              <div class="flex gap-2 w-full sm:w-auto">
                <div class="relative flex-1 sm:w-32">
                  <span class="absolute left-3 top-3 text-slate-400">$</span>
                  <input 
                    type="number" 
                    name="gasto_monto" 
                    bind:value={gasto.monto}
                    step="0.01" 
                    min="0.01" 
                    required 
                    placeholder="0.00"
                    class="w-full pl-7 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                </div>
                <button 
                  type="button" 
                  onclick={() => removeGasto(gasto.id)}
                  class="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors font-bold text-xl"
                  title="Eliminar gasto"
                >
                  &times;
                </button>
              </div>
            </div>
          {/each}
        </div>
        
        <div class="mt-4 pt-4 border-t border-slate-100 text-right">
          <span class="text-slate-500 text-sm">Total de gastos declarados:</span>
          <span class="text-xl font-bold text-red-600 ml-2">$-{totalGastos.toFixed(2)}</span>
        </div>
      {/if}
    </div>

    <!-- Botón de Envío -->
    <div class="pt-4">
      <button 
        type="submit" 
        class="w-full py-4 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md hover:shadow-lg text-lg flex justify-center items-center gap-3"
      >
        <span>🔒</span> Guardar y Cerrar Turno
      </button>
    </div>
    
  </form>
</div>
