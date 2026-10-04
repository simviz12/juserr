<script lang="ts">
  import { enhance } from '$app/forms';
  import { Boxes, Download, PackagePlus, SlidersHorizontal, CheckCircle2, AlertTriangle } from '@lucide/svelte';
  import * as XLSX from 'xlsx';
  let { data, form } = $props();

  let tipoOperacion = $state<'entrada' | 'ajuste'>('entrada');
  let cantidadInput = $state('');
  let precioTotalCompra = $state('');
  let productoSeleccionadoId = $state(data.productos[0]?.id || 1);

  // Parser para soportar enteros con fracciones como "6 1/4", "2 1/2", "3/4" o decimales "6.25"
  function parseCantidadFraccion(valor: string): number {
    if (!valor) return 0;
    const clean = valor.trim();
    if (!clean) return 0;

    // Caso 1: Entero con fracción, ej: "6 1/4" o "6 1/2"
    if (clean.includes(' ') && clean.includes('/')) {
      const parts = clean.split(/\s+/);
      const entero = parseFloat(parts[0]) || 0;
      const fracParts = parts[1].split('/');
      if (fracParts.length === 2) {
        const num = parseFloat(fracParts[0]) || 0;
        const den = parseFloat(fracParts[1]) || 1;
        return entero + (den !== 0 ? num / den : 0);
      }
    }

    // Caso 2: Solo fracción, ej: "1/4", "3/4", "1/2"
    if (clean.includes('/')) {
      const fracParts = clean.split('/');
      if (fracParts.length === 2) {
        const num = parseFloat(fracParts[0]) || 0;
        const den = parseFloat(fracParts[1]) || 1;
        return den !== 0 ? num / den : 0;
      }
    }

    // Caso 3: Número normal entero o decimal "6" o "6.25"
    return parseFloat(clean.replace(',', '.')) || 0;
  }

  // Formateador visual para mostrar números en formato de enteros y fracciones amigables
  function formatCantidadFraccion(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = Number(val);
    if (num === 0) return '0';
    const entero = Math.floor(num);
    const decimal = Number((num - entero).toFixed(3));

    let fraccionStr = '';
    if (Math.abs(decimal - 0.25) < 0.05) fraccionStr = '1/4';
    else if (Math.abs(decimal - 0.5) < 0.05) fraccionStr = '1/2';
    else if (Math.abs(decimal - 0.75) < 0.05) fraccionStr = '3/4';
    else if (Math.abs(decimal - 0.33) < 0.05) fraccionStr = '1/3';
    else if (Math.abs(decimal - 0.66) < 0.05) fraccionStr = '2/3';
    else if (decimal > 0) return num.toLocaleString('es-CO', { maximumFractionDigits: 2 });

    if (entero > 0 && fraccionStr) return `${entero} ${fraccionStr}`;
    if (entero > 0) return `${entero}`;
    if (fraccionStr) return fraccionStr;
    return '0';
  }
  
  let cantidadNum = $derived(parseCantidadFraccion(cantidadInput));
  let precioTotalNum = $derived(parseFloat(precioTotalCompra) || 0);
  let precioUnitario = $derived(cantidadNum > 0 ? precioTotalNum / cantidadNum : 0);

  let productoSeleccionado = $derived(data.productos.find(p => p.id === Number(productoSeleccionadoId)) || data.productos[0]);

  function exportComprasToExcel() {
    if (!data.historialMovimientos || data.historialMovimientos.length === 0) {
      alert('No hay movimientos ni compras registradas para exportar.');
      return;
    }

    const rows = data.historialMovimientos.map((m: any) => ({
      'Fecha': m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : '-',
      'Hora': m.fecha ? new Date(m.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-',
      'Tipo de Operación': m.tipo === 'entrada' ? 'Compra (Entrada)' : 'Ajuste de Conteo Físico',
      'Producto / Insumo': m.productoNombre,
      'Unidad de Medida': m.unidadMedida,
      'Cantidad': m.cantidad,
      'Costo Unitario ($)': Number(m.costoUnitario || 0),
      'Costo Total Invertido ($)': Number(m.costoTotal || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial Compras e Insumos');
    XLSX.writeFile(workbook, `JuanchoPizza_Historial_Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
</script>

<div class="max-w-5xl mx-auto space-y-8 pb-12">
  <!-- Encabezado -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold mb-2">
        <Boxes size={14} /> Control de Materia Prima
      </div>
      <h1 class="text-3xl font-black tracking-tight text-slate-900">Bodega e Insumos</h1>
      <p class="text-slate-500 font-medium mt-1">Registra compras de mercancía y audita el stock real de la pizzería.</p>
    </div>
    
    <div>
      <button 
        onclick={exportComprasToExcel}
        class="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-sm hover:shadow transition-all text-sm cursor-pointer"
      >
        <Download size={16} /> Descargar Historial en Excel (.xlsx)
      </button>
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
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {producto.nombre}
            </span>
            <div class="flex items-baseline gap-2 mt-1">
              <p class="text-3xl font-black text-slate-800">{formatCantidadFraccion(producto.stockActual)}</p>
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
      <CheckCircle2 size={24} class="text-emerald-600 shrink-0" /> 
      <div>
        <p class="font-bold text-base">Operación completada con éxito</p>
        <p class="text-sm text-emerald-700 mt-0.5">{form.message}</p>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-50 text-red-700 p-5 rounded-2xl shadow-sm border border-red-200 flex items-center gap-3">
      <AlertTriangle size={24} class="text-red-600 shrink-0" /> 
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
      <div class="mt-4 p-2 bg-slate-100 rounded-2xl flex flex-col sm:flex-row gap-3 max-w-2xl">
        <button 
          type="button" 
          onclick={() => tipoOperacion = 'entrada'}
          class="flex-1 py-4 px-6 rounded-xl font-extrabold text-base transition-all flex items-center justify-center gap-3 cursor-pointer {tipoOperacion === 'entrada' ? 'bg-white text-orange-600 shadow-md ring-2 ring-orange-500/20' : 'text-slate-600 hover:text-slate-900'}"
        >
          <span class="text-xl">📥</span> Registrar Compras (Sumar)
        </button>
        <button 
          type="button" 
          onclick={() => tipoOperacion = 'ajuste'}
          class="flex-1 py-4 px-6 rounded-xl font-extrabold text-base transition-all flex items-center justify-center gap-3 cursor-pointer {tipoOperacion === 'ajuste' ? 'bg-white text-blue-600 shadow-md ring-2 ring-blue-500/20' : 'text-slate-600 hover:text-slate-900'}"
        >
          <span class="text-xl">📋</span> Conteo Real (Sobreescribir)
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
          cantidadInput = '';
          precioTotalCompra = '';
        }
      };
    }} class="space-y-6">
      <!-- Input oculto para enviar el tipo seleccionado -->
      <input type="hidden" name="tipo_operacion" value={tipoOperacion} />
      <!-- Input oculto para enviar la cantidad numérica parseada al backend -->
      <input type="hidden" name="cantidad" value={cantidadNum} />

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
                  {producto.nombre} ({producto.unidadMedida})
                </option>
              {/each}
            </select>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
          </div>
          {#if productoSeleccionado}
            <span class="block text-xs text-slate-400 mt-1 font-semibold">
              Stock actual en sistema: <strong>{formatCantidadFraccion(productoSeleccionado.stockActual)} {productoSeleccionado.unidadMedida}</strong>
            </span>
          {/if}
        </div>

        <!-- Cantidad -->
        <div>
          <label for="cantidad_display" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            {tipoOperacion === 'entrada' ? '¿Cuántas unidades se compraron / llegaron?' : '¿Cuántas unidades hay físicamente ahora?'}
          </label>
          <input 
            type="text" 
            id="cantidad_display" 
            bind:value={cantidadInput}
            required 
            placeholder="Ej: 6 1/4, 2 1/2, 3/4 o 6"
            class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-black text-slate-900 text-lg"
          />
          <!-- Botones rápidos de fracciones comunes -->
          <div class="flex items-center gap-1.5 mt-2">
            <span class="text-[11px] font-bold text-slate-400 mr-1">Atajos:</span>
            {#each ['1/4', '1/2', '3/4'] as frac}
              <button 
                type="button" 
                onclick={() => {
                  const curr = cantidadInput.trim();
                  if (!curr || curr === '0') {
                    cantidadInput = frac;
                  } else if (!curr.includes('/')) {
                    cantidadInput = `${curr} ${frac}`;
                  }
                }}
                class="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 rounded-lg text-xs font-black transition-colors"
              >
                +{frac}
              </button>
            {/each}
            {#if cantidadInput}
              <button 
                type="button" 
                onclick={() => cantidadInput = ''}
                class="ml-auto text-[11px] text-slate-400 hover:text-rose-600 font-bold"
              >
                Limpiar
              </button>
            {/if}
          </div>

          {#if tipoOperacion === 'entrada' && cantidadNum > 0 && productoSeleccionado}
            <span class="block text-xs text-emerald-600 mt-2 font-bold">
              Resultado: Pasará de {formatCantidadFraccion(productoSeleccionado.stockActual)} a {formatCantidadFraccion((productoSeleccionado.stockActual || 0) + cantidadNum)} {productoSeleccionado.unidadMedida} ({cantidadNum} numérico)
            </span>
          {:else if tipoOperacion === 'ajuste' && cantidadInput !== '' && productoSeleccionado}
            <span class="block text-xs text-blue-600 mt-2 font-bold">
              Resultado: El stock quedará exactamente en {formatCantidadFraccion(cantidadNum)} {productoSeleccionado.unidadMedida} ({cantidadNum} numérico)
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
                Cálculo unitario: ${precioUnitario.toLocaleString('es-CO', { maximumFractionDigits: 1 })} cada {productoSeleccionado?.unidadMedida}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="pt-6 border-t border-slate-100 flex justify-end">
        <button 
          type="submit" 
          class="w-full sm:w-auto py-4 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
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
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold {mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">
                    {mov.tipo === 'entrada' ? 'Compra' : 'Ajuste Físico'}
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

