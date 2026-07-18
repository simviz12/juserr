<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade } from 'svelte/transition';
  let { data, form } = $props();

  let selectedId = $state('');
  let selectedProduct = $derived(data.inventory.find(p => p.id.toString() === selectedId?.toString()));
</script>

<div class="max-w-3xl mx-auto">
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Ingreso de Compra</h1>
      <p class="text-slate-500 text-sm mt-1">Registra la llegada de mercancía y su costo para los reportes de gastos.</p>
    </div>
    <a href="/inventory" class="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-4 py-2 rounded-xl transition-colors">
      Volver
    </a>
  </div>

  {#if form?.success}
    <div transition:fade class="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 shadow-sm border border-emerald-200">
      <span class="font-bold">¡Mercancía Registrada!</span> {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div transition:fade class="bg-red-50 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
    
    <div>
      <label for="productoId" class="block text-sm font-medium text-slate-700 mb-2">Producto Adquirido</label>
      <select 
        id="productoId" 
        name="productoId" 
        bind:value={selectedId}
        required 
        class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-slate-700"
      >
        <option value="" disabled>-- Selecciona un producto --</option>
        {#each data.inventory as item}
          <option value={item.id}>{item.nombre} (Mide en {item.unidadMedida}s)</option>
        {/each}
      </select>
    </div>

    {#if selectedProduct}
      <div transition:fade class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <label for="cantidad" class="block text-sm font-medium text-slate-700 mb-2">
            Cantidad a ingresar ({selectedProduct.unidadMedida}s)
          </label>
          <input 
            type="text" 
            id="cantidad" 
            name="cantidad" 
            placeholder="Ej. 5 o 1/8"
            required
            class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
          />
        </div>

        <div>
          <label for="costo" class="block text-sm font-medium text-slate-700 mb-2">
            Costo Total de la Compra ($)
          </label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
            <input 
              type="number" 
              id="costo" 
              name="costo" 
              min="0" 
              step="0.01"
              placeholder="0.00"
              class="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-700"
            />
          </div>
          <p class="text-xs text-slate-500 mt-2">* Este costo se sumará automáticamente a los gastos del día.</p>
        </div>
      </div>

      <button 
        type="submit" 
        class="w-full py-4 px-6 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg text-lg flex justify-center items-center gap-2"
      >
        <span>🛒</span> Guardar Compra en Inventario
      </button>
    {/if}
  </form>
</div>
