<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade } from 'svelte/transition';
  let { data, form } = $props();

  let cantidad = $state('');
  let precioTotalCompra = $state('');
  
  let cantidadNum = $derived(parseFloat(cantidad) || 0);
  let precioTotalNum = $derived(parseFloat(precioTotalCompra) || 0);
  let precioUnitario = $derived(cantidadNum > 0 ? precioTotalNum / cantidadNum : 0);
</script>

<div class="max-w-4xl mx-auto space-y-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black tracking-tight text-slate-900">📦 Bodega e Insumos</h1>
      <p class="text-slate-500 font-medium mt-1">Registra la materia prima que entra al negocio y controla el costo base.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
    {#each data.productos as producto}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-20 h-20 bg-orange-50 rounded-full transition-transform group-hover:scale-150 duration-500 ease-out z-0"></div>
        <div class="relative z-10">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            {producto.nombre === 'Masas' ? '🍕' : (producto.nombre.toLowerCase().includes('queso') ? '🧀' : '📦')}
            Stock de {producto.nombre}
          </h2>
          <div class="flex items-baseline gap-2">
            <p class="text-4xl font-black text-slate-800">{producto.stockActual || 0}</p>
            <span class="text-xs font-bold text-orange-500">{producto.unidadMedida}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if form?.success}
    <div  class="bg-emerald-50 text-emerald-700 p-4 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-3">
      <span class="text-2xl">✨</span> 
      <div>
        <p class="font-bold">¡Movimiento Registrado!</p>
        <p class="text-sm">{form.message}</p>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div  class="bg-red-50 text-red-700 p-4 rounded-2xl shadow-sm border border-red-100 flex items-center gap-3">
      <span class="text-2xl">⚠️</span> 
      <div>
        <p class="font-bold">Hubo un problema</p>
        <p class="text-sm">{form.error}</p>
      </div>
    </div>
  {/if}

  <form method="POST" use:enhance={() => {
    return async ({ update }) => {
      await update();
      if (form?.success) {
        cantidad = '';
        precioTotalCompra = '';
      }
    };
  }} class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
    
    <h2 class="text-xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">Registrar Nueva Entrada de Insumo</h2>
    
    <div class="mb-8 p-1 bg-slate-100 rounded-2xl flex flex-col sm:flex-row max-w-md">
      <label class="flex-1 cursor-pointer">
        <input type="radio" name="tipo_operacion" value="entrada" checked class="peer sr-only" />
        <div class="text-center py-2.5 px-4 rounded-xl font-bold text-sm text-slate-500 peer-checked:bg-white peer-checked:text-orange-600 peer-checked:shadow-sm transition-all">
          📥 Registrar Compras (Sumar)
        </div>
      </label>
      <label class="flex-1 cursor-pointer">
        <input type="radio" name="tipo_operacion" value="ajuste" class="peer sr-only" />
        <div class="text-center py-2.5 px-4 rounded-xl font-bold text-sm text-slate-500 peer-checked:bg-white peer-checked:text-orange-600 peer-checked:shadow-sm transition-all">
          📋 Conteo Final (Sobreescribir)
        </div>
      </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <label for="tipo_insumo" class="block text-sm font-bold text-slate-600 mb-2">¿Qué insumo ingresa?</label>
        <div class="relative">
          <select id="tipo_insumo" name="tipo_insumo" class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-bold text-slate-700 appearance-none">
            {#each data.productos as producto}
              <option value={producto.id}>
                {producto.nombre === 'Masas' ? '🍕' : (producto.nombre === 'Queso' ? '🧀' : '📦')} {producto.nombre} ({producto.unidadMedida})
              </option>
            {/each}
          </select>
          <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
        </div>
      </div>

      <div>
        <label for="cantidad" class="block text-sm font-bold text-slate-600 mb-2">Cantidad Recibida</label>
        <input 
          type="number" 
          id="cantidad" 
          name="cantidad" 
          bind:value={cantidad}
          required 
          min="1"
          step="1"
          placeholder="Ej. 50"
          class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-bold text-slate-800"
        />
      </div>

      <div class="md:col-span-2">
        <label for="precioTotalCompra" class="block text-sm font-bold text-slate-600 mb-2">Costo Total de Factura (Opcional)</label>
        <div class="relative">
          <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
          <input 
            type="number" 
            id="precioTotalCompra" 
            name="precioTotalCompra" 
            bind:value={precioTotalCompra}
            min="0"
            step="100"
            placeholder="Ej. 150000"
            class="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-bold text-slate-800"
          />
        </div>
        {#if precioUnitario > 0}
          <div class="mt-3 bg-orange-50 text-orange-700 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-sm font-bold border border-orange-100">
            <span>💡</span>
            Equivale a ${precioUnitario.toLocaleString('es-CO', { maximumFractionDigits: 2 })} por unidad
          </div>
        {/if}
      </div>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-100 flex justify-end">
      <button 
        type="submit" 
        class="py-3.5 px-8 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black rounded-2xl hover:from-orange-600 hover:to-orange-700 hover:shadow-lg hover:shadow-orange-500/30 transition-all flex justify-center items-center gap-2"
      >
        <span>💾</span> Guardar Ingreso a Bodega
      </button>
    </div>
  </form>
</div>
