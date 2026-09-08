<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let tipoOperacion = $state<'entrada' | 'ajuste'>('entrada');
  let cantidad = $state('');
  let precioTotalCompra = $state('');
  let productoSeleccionadoId = $state(data.productos[0]?.id || 1);
  
  let cantidadNum = $derived(parseFloat(cantidad) || 0);
  let precioTotalNum = $derived(parseFloat(precioTotalCompra) || 0);
  let precioUnitario = $derived(cantidadNum > 0 ? precioTotalNum / cantidadNum : 0);

  let productoSeleccionado = $derived(data.productos.find(p => p.id === Number(productoSeleccionadoId)) || data.productos[0]);
</script>

<div class="max-w-5xl mx-auto space-y-8 pb-12">
  <!-- Encabezado -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold mb-2">
        <span>📦</span> Control de Materia Prima
      </div>
      <h1 class="text-3xl font-black tracking-tight text-slate-900">Bodega e Insumos</h1>
      <p class="text-slate-500 font-medium mt-1">Registra compras de mercancía y audita el stock real de la pizzería.</p>
    </div>
  </div>

  <!-- Tarjetas de Stock Actual -->
  <div>
    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Stock Actual en Bodega</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each data.productos as producto}
        <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:border-orange-200 transition-all">
          <div class="absolute -right-4 -top-4 w-16 h-16 bg-orange-50/70 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div class="relative z-10">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {producto.nombre === 'Masas' ? '🍕' : (producto.nombre.toLowerCase().includes('queso') ? '🧀' : '📦')}
              {producto.nombre}
            </span>
            <div class="flex items-baseline gap-2 mt-1">
              <p class="text-3xl font-black text-slate-800">{producto.stockActual || 0}</p>
              <span class="text-xs font-bold text-orange-500">{producto.unidadMedida}</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-2 font-medium">
              Costo Prom.: <strong class="text-slate-700">${Number(producto.precioCosto || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
            </p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Mensajes de feedback -->
  {#if form?.success}
    <div class="bg-emerald-50 text-emerald-800 p-5 rounded-2xl shadow-sm border border-emerald-200 flex items-center gap-3">
      <span class="text-2xl">✅</span> 
      <div>
        <p class="font-bold text-base">¡Operación completada con éxito!</p>
        <p class="text-sm text-emerald-700 mt-0.5">{form.message}</p>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-50 text-red-700 p-5 rounded-2xl shadow-sm border border-red-200 flex items-center gap-3">
      <span class="text-2xl">⚠️</span> 
      <div>
        <p class="font-bold text-base">Hubo un problema</p>
        <p class="text-sm text-red-600 mt-0.5">{form.error}</p>
      </div>
    </div>
  {/if}

  <!-- Formulario Principal -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
    <div class="border-b border-slate-100 pb-6 mb-6">
      <h2 class="text-xl font-black text-slate-900">Registrar Movimiento en Bodega</h2>
      <p class="text-xs text-slate-500 mt-1">
        Selecciona la acción a realizar según lo que pasó en el local:
      </p>

      <!-- Selector de Modo Sin Bug de Saltos -->
      <div class="mt-4 p-1.5 bg-slate-100 rounded-2xl flex flex-col sm:flex-row gap-2 max-w-xl">
        <button 
          type="button" 
          onclick={() => tipoOperacion = 'entrada'}
          class="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 {tipoOperacion === 'entrada' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}"
        >
          <span>📥</span> Registrar Compras (Sumar)
        </button>
        <button 
          type="button" 
          onclick={() => tipoOperacion = 'ajuste'}
          class="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 {tipoOperacion === 'ajuste' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}"
        >
          <span>📋</span> Conteo Real (Sobreescribir)
        </button>
      </div>

      <!-- Explicación pedagógica de la acción seleccionada -->
      <div class="mt-4 p-4 rounded-2xl border text-xs font-medium {tipoOperacion === 'entrada' ? 'bg-orange-50/70 border-orange-200 text-orange-900' : 'bg-blue-50/70 border-blue-200 text-blue-900'}">
        {#if tipoOperacion === 'entrada'}
          <p class="flex items-start gap-2">
            <span class="text-base">💡</span>
            <span>
              <strong>Modo SUMAR:</strong> Úsalo cuando llegue un pedido del proveedor o vayas a la plaza a comprar insumos. La cantidad que pongas se <strong>sumará</strong> al stock que ya tienes y actualizará el costo promedio.
            </span>
          </p>
        {:else}
          <p class="flex items-start gap-2">
            <span class="text-base">📋</span>
            <span>
              <strong>Modo SOBREESCRIBIR (Ajuste Físico):</strong> Úsalo cuando vayas a la nevera o estante, cuentes físicamente lo que hay en este instante y quieras que el sistema refleje <strong>exactamente esa cantidad</strong> (sustituye el número actual).
            </span>
          </p>
        {/if}
      </div>
    </div>

    <!-- Formulario POST -->
    <form method="POST" use:enhance={() => {
      return async ({ update }) => {
        await update();
        if (form?.success) {
          cantidad = '';
          precioTotalCompra = '';
        }
      };
    }} class="space-y-6">
      <!-- Input oculto para enviar el tipo seleccionado -->
      <input type="hidden" name="tipo_operacion" value={tipoOperacion} />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Insumo -->
        <div>
          <label for="tipo_insumo" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Insumo a Actualizar</label>
          <div class="relative">
            <select 
              id="tipo_insumo" 
              name="tipo_insumo" 
              bind:value={productoSeleccionadoId}
              class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-slate-800 appearance-none"
            >
              {#each data.productos as producto}
                <option value={producto.id}>
                  {producto.nombre === 'Masas' ? '🍕' : (producto.nombre.toLowerCase().includes('queso') ? '🧀' : '📦')} {producto.nombre} ({producto.unidadMedida})
                </option>
              {/each}
            </select>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
          </div>
          {#if productoSeleccionado}
            <span class="block text-xs text-slate-400 mt-1 font-semibold">
              Stock actual en sistema: <strong>{productoSeleccionado.stockActual || 0} {productoSeleccionado.unidadMedida}</strong>
            </span>
          {/if}
        </div>

        <!-- Cantidad -->
        <div>
          <label for="cantidad" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            {tipoOperacion === 'entrada' ? '¿Cuántas unidades se compraron / llegaron?' : '¿Cuántas unidades hay físicamente ahora?'}
          </label>
          <input 
            type="number" 
            id="cantidad" 
            name="cantidad" 
            bind:value={cantidad}
            required 
            min="0"
            step="0.1"
            placeholder={tipoOperacion === 'entrada' ? "Ej. 20" : "Ej. 15"}
            class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-black text-slate-900 text-lg"
          />
          {#if tipoOperacion === 'entrada' && cantidadNum > 0 && productoSeleccionado}
            <span class="block text-xs text-emerald-600 mt-1 font-bold">
              Resultado: Pasará de {productoSeleccionado.stockActual || 0} a {(productoSeleccionado.stockActual || 0) + cantidadNum} {productoSeleccionado.unidadMedida}
            </span>
          {:else if tipoOperacion === 'ajuste' && cantidad !== '' && productoSeleccionado}
            <span class="block text-xs text-blue-600 mt-1 font-bold">
              Resultado: El stock quedará exactamente en {cantidadNum} {productoSeleccionado.unidadMedida}
            </span>
          {/if}
        </div>

        <!-- Costo Total (Solo en compras) -->
        {#if tipoOperacion === 'entrada'}
          <div class="md:col-span-2">
            <label for="precioTotalCompra" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Costo Total de la Compra en Pesos (Opcional)
              <span class="text-slate-400 lowercase font-normal"> — Para promediar costos en finanzas</span>
            </label>
            <div class="relative max-w-md">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
              <input 
                type="number" 
                id="precioTotalCompra" 
                name="precioTotalCompra" 
                bind:value={precioTotalCompra}
                min="0"
                step="100"
                placeholder="Ej. 40000"
                class="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-slate-800"
              />
            </div>
            {#if precioUnitario > 0}
              <div class="mt-2 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl inline-block">
                💡 Sale a ${precioUnitario.toLocaleString('es-CO', { maximumFractionDigits: 1 })} cada {productoSeleccionado?.unidadMedida}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="pt-4 border-t border-slate-100 flex justify-end">
        <button 
          type="submit" 
          class="w-full sm:w-auto py-4 px-8 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
        >
          <span>{tipoOperacion === 'entrada' ? '📥' : '💾'}</span>
          {tipoOperacion === 'entrada' ? 'Registrar Compra e Incrementar Stock' : 'Guardar Conteo Físico (Ajustar Stock)'}
        </button>
      </div>
    </form>
  </div>

  <!-- Historial de Entradas y Salidas de Bodega -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <div class="p-6 border-b border-slate-100">
      <h2 class="text-lg font-black text-slate-900">Historial de Entradas y Ajustes</h2>
      <p class="text-xs text-slate-400 mt-0.5">Registro de cada compra o modificación manual realizada en bodega.</p>
    </div>

    <div class="overflow-x-auto">
      {#if !data.historialMovimientos || data.historialMovimientos.length === 0}
        <div class="p-10 text-center text-slate-400 text-sm">
          No hay movimientos registrados en bodega aún.
        </div>
      {:else}
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
              <th class="p-4 pl-6">Fecha y Hora</th>
              <th class="p-4">Tipo</th>
              <th class="p-4">Insumo</th>
              <th class="p-4 text-right">Cantidad</th>
              <th class="p-4 text-right pr-6">Costo Declarado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            {#each data.historialMovimientos as mov}
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="p-4 pl-6 font-bold text-slate-700 text-xs">
                  {mov.fecha ? new Date(mov.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                </td>
                <td class="p-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-extrabold {mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">
                    {mov.tipo === 'entrada' ? '📥 Compra (+)' : '📋 Conteo'}
                  </span>
                </td>
                <td class="p-4 font-bold text-slate-800">
                  {mov.productoNombre}
                </td>
                <td class="p-4 text-right font-black {mov.cantidad > 0 ? 'text-emerald-600' : 'text-slate-700'}">
                  {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad} {mov.unidadMedida}
                </td>
                <td class="p-4 text-right pr-6 font-semibold text-slate-700">
                  {Number(mov.costoTotal || 0) > 0 ? `$${Number(mov.costoTotal).toLocaleString('es-CO')}` : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

