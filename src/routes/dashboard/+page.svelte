<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { BarChart2, Bell, Calendar, TrendingUp, DollarSign, PieChart, ShoppingBag, Flame, Layers } from '@lucide/svelte';
  let { data } = $props();

  let rangoSeleccionado = $derived(data.rangoActual || 'diario');
  let fechaInput = $state(data.fechaSeleccionada || '');

  function cambiarRango(nuevoRango: string) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('rango', nuevoRango);
    if (fechaInput) {
      params.set('fecha', fechaInput);
    } else {
      params.delete('fecha');
    }
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function filtrarFecha() {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('rango', rangoSeleccionado);
    if (fechaInput) {
      params.set('fecha', fechaInput);
    } else {
      params.delete('fecha');
    }
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function limpiarFecha() {
    fechaInput = '';
    const params = new URLSearchParams($page.url.searchParams);
    params.set('rango', rangoSeleccionado);
    params.delete('fecha');
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  // Textos explicativos según el período
  let etiquetaPeriodo = $derived(
    rangoSeleccionado === 'diario' ? 'del Día' :
    rangoSeleccionado === 'semanal' ? 'de la Semana' :
    rangoSeleccionado === 'mensual' ? 'del Mes' : 'del Año'
  );

  let masasUsadas = $derived(Math.floor(data.totalPorcionesVendidas / 8));
  let masasDisponibles = $derived(data.stockMasasActual || 0);

  // Meta estimada de ventas según periodo para el medidor visual
  let metaVentas = $derived(
    rangoSeleccionado === 'diario' ? 1000000 :
    rangoSeleccionado === 'semanal' ? 7000000 :
    rangoSeleccionado === 'mensual' ? 30000000 : 360000000
  );

  const perc = (value: number, total: number) => total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
</script>

<div class="font-sans text-sm space-y-6">
  <!-- Barra Superior: Filtro de Periodo y Selección de Fecha -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <span class="p-2 bg-orange-100 text-orange-600 rounded-xl text-lg">📊</span>
        <div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">Estadísticas y Ventas</h1>
          <p class="text-xs text-slate-500 font-medium">Control en tiempo real de ventas, inventario y rendimiento por período.</p>
        </div>
      </div>
    </div>

    <!-- Botonera de Períodos y Fecha -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Selector de Pestañas: Día / Semana / Mes / Año -->
      <div class="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200/80 shadow-inner">
        <button
          onclick={() => cambiarRango('diario')}
          class="px-5 py-3 rounded-xl text-sm font-extrabold transition-all {rangoSeleccionado === 'diario' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
        >
          Hoy (Día)
        </button>
        <button
          onclick={() => cambiarRango('semanal')}
          class="px-5 py-3 rounded-xl text-sm font-extrabold transition-all {rangoSeleccionado === 'semanal' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
        >
          Esta Semana
        </button>
        <button
          onclick={() => cambiarRango('mensual')}
          class="px-5 py-3 rounded-xl text-sm font-extrabold transition-all {rangoSeleccionado === 'mensual' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
        >
          Este Mes
        </button>
        <button
          onclick={() => cambiarRango('anual')}
          class="px-5 py-3 rounded-xl text-sm font-extrabold transition-all {rangoSeleccionado === 'anual' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
        >
          Este Año
        </button>
      </div>

      <!-- Selector de Fecha Específica (Opcional) -->
      <div class="flex items-center gap-3 bg-slate-50 p-2 px-4 rounded-2xl border border-slate-200">
        <Calendar size="20" class="text-slate-500" />
        <input
          type="date"
          bind:value={fechaInput}
          onchange={filtrarFecha}
          class="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer py-1"
          title="Selecciona una fecha de referencia"
        />
        {#if fechaInput}
          <button
            onclick={limpiarFecha}
            class="text-base text-slate-400 hover:text-red-500 font-black px-1.5"
            title="Restablecer a fecha actual"
          >
            ×
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- KPI Cards Principales del Período -->
  <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    <!-- Venta Bruta del Período -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 relative">
          <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
            <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#FFEDD5" stroke-width="4" />
            <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="#FF5B29" stroke-width="4" stroke-dasharray="{perc(data.ventasBrutas, metaVentas)} 100" stroke-linecap="round" />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#FF5B29]">{perc(data.ventasBrutas, metaVentas)}%</span>
        </div>
        <div>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Venta Bruta {etiquetaPeriodo}</span>
          <p class="text-2xl font-black text-slate-900 mt-0.5">${data.ventasBrutas.toLocaleString('es-CO')}</p>
          <span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
            <span>📈</span> {data.cantidadTurnos} {data.cantidadTurnos === 1 ? 'turno cerrado' : 'turnos cerrados'}
          </span>
        </div>
      </div>
    </div>

    <!-- Dinero Libre / Neto -->
    <div class="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl shadow-md p-6 flex items-center justify-between relative overflow-hidden group">
      <div>
        <span class="text-xs font-bold text-emerald-100 uppercase tracking-wider block">Dinero Libre (Neto)</span>
        <p class="text-2xl font-black mt-1">${data.utilidadNeta.toLocaleString('es-CO')}</p>
        <span class="text-xs text-emerald-100 font-medium block mt-1">
          Menos <strong class="text-white font-bold">${data.gastosPeriodo.toLocaleString('es-CO')}</strong> en gastos
        </span>
      </div>
      <div class="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">
        💰
      </div>
    </div>

    <!-- Porciones Vendidas y Masas -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
      <div>
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Porciones Vendidas</span>
        <p class="text-2xl font-black text-slate-900 mt-1">{data.totalPorcionesVendidas} <span class="text-sm font-bold text-slate-400">porc.</span></p>
        <p class="text-xs text-slate-500 font-medium mt-1">
          Equivalente a <strong class="text-slate-800 font-bold">{masasUsadas} pizzas</strong> preparadas
        </p>
      </div>
      <div class="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-2xl font-bold">
        🍕
      </div>
    </div>

    <!-- Masas en Bodega y Mermas -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
      <div>
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Stock Masas en Bodega</span>
        <p class="text-2xl font-black text-slate-900 mt-1">{masasDisponibles} <span class="text-sm font-bold text-slate-400">crudas</span></p>
        <p class="text-xs text-rose-600 font-medium mt-1 flex items-center gap-1">
          <span>🔥</span> Mermas: <strong>{data.totalMermas} porciones quemadas</strong>
        </p>
      </div>
      <div class="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl">
        📦
      </div>
    </div>
  </section>

  <!-- Desglose de Canales de Pago del Período -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
    <h2 class="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
      <span>💳</span> Desglose de Canales de Pago {etiquetaPeriodo}
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Efectivo -->
      <div class="p-4 bg-blue-50/70 border border-blue-200/70 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs font-bold uppercase text-blue-800 tracking-wider block">💵 Efectivo en Caja</span>
          <p class="text-xl font-black text-blue-900 mt-1">${data.totalEfectivo.toLocaleString('es-CO')}</p>
          <span class="text-[11px] text-blue-600 font-semibold">
            {data.ventasBrutas > 0 ? Math.round((data.totalEfectivo / data.ventasBrutas) * 100) : 0}% de las ventas
          </span>
        </div>
        <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">
          💵
        </div>
      </div>

      <!-- Nequi -->
      <div class="p-4 bg-purple-50/70 border border-purple-200/70 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs font-bold uppercase text-purple-800 tracking-wider block">📱 Nequi (Bancarizado)</span>
          <p class="text-xl font-black text-purple-900 mt-1">${data.totalTransferencias.toLocaleString('es-CO')}</p>
          <span class="text-[11px] text-purple-600 font-semibold">
            {data.ventasBrutas > 0 ? Math.round((data.totalTransferencias / data.ventasBrutas) * 100) : 0}% de las ventas
          </span>
        </div>
        <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold">
          📱
        </div>
      </div>

      <!-- Gastos -->
      <div class="p-4 bg-rose-50/70 border border-rose-200/70 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs font-bold uppercase text-rose-800 tracking-wider block">🧾 Gastos Pagados</span>
          <p class="text-xl font-black text-rose-900 mt-1">-${data.gastosPeriodo.toLocaleString('es-CO')}</p>
          <span class="text-[11px] text-rose-600 font-semibold">Compras menores del período</span>
        </div>
        <div class="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 font-bold">
          🧾
        </div>
      </div>
    </div>
  </div>

  <!-- Sección Inferior: Ranking de Sabores Vendidos y Alertas de Inventario -->
  <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Top Sabores Vendidos -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h2 class="text-base font-black text-slate-800 flex items-center gap-2">
            <BarChart2 class="text-[#FF5B29]" size="20" /> Ranking de Sabores Más Vendidos {etiquetaPeriodo}
          </h2>
          <span class="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
            Top Sabores
          </span>
        </div>

        {#if data.saboresVendidos && data.saboresVendidos.length > 0}
          <div class="space-y-3">
            {#each data.saboresVendidos as sabor, index}
              <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold {index === 0 ? 'bg-amber-400 text-slate-900' : index === 1 ? 'bg-slate-300 text-slate-800' : 'bg-orange-100 text-orange-700'}">
                    #{index + 1}
                  </span>
                  <span class="font-bold text-slate-800 text-sm">{sabor.nombre}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-500">
                    ${(sabor.vendidas * 7000).toLocaleString('es-CO')}
                  </span>
                  <span class="bg-orange-100 text-orange-700 font-black px-3 py-1 rounded-xl text-xs">
                    {sabor.vendidas} porc.
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-12 text-slate-400">
            <span class="text-4xl block mb-2">🍕</span>
            <p class="font-medium text-slate-600 text-sm">No hay registros de ventas procesados {etiquetaPeriodo.toLowerCase()}.</p>
            <p class="text-xs text-slate-400 mt-1">Al cerrar turnos en esta fecha, aquí verás qué sabor es el más vendido.</p>
          </div>
        {/if}
      </div>

      {#if data.saboresVendidos && data.saboresVendidos.length > 0}
        <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 text-right">
          Total porciones contabilizadas en el ranking: <strong class="text-slate-700 font-bold">{data.saboresVendidos.reduce((acc, s) => acc + s.vendidas, 0)}</strong>
        </div>
      {/if}
    </div>

    <!-- Alertas de Inventario Crítico -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h2 class="text-base font-black text-slate-800 flex items-center gap-2">
            <Bell class="text-rose-500" size="20" /> Alertas de Inventario en Bodega
          </h2>
          <span class="text-xs font-bold text-slate-500">Stock Mínimo</span>
        </div>

        {#if data.inventarioBajo && data.inventarioBajo.length > 0}
          <div class="space-y-3">
            {#each data.inventarioBajo as item}
              <div class="flex items-center justify-between p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <div class="flex items-center gap-2.5">
                  <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span class="font-bold text-slate-800 text-sm">{item.nombre}</span>
                </div>
                <div class="text-right">
                  <span class="text-rose-700 font-black px-2.5 py-1 bg-rose-100 rounded-lg text-xs">
                    Quedan: {item.stockActual} {item.unidadMedida}s
                  </span>
                  <span class="text-[11px] text-slate-400 block mt-0.5">Mínimo: {item.stockMinimo}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-12 text-slate-400">
            <span class="text-4xl block mb-2">✅</span>
            <p class="font-bold text-emerald-700 text-sm">Inventario en niveles óptimos</p>
            <p class="text-xs text-slate-400 mt-1">Todos los ingredientes y masas superan el stock mínimo de seguridad.</p>
          </div>
        {/if}
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 text-right">
        <a href="/bodega" class="text-xs font-bold text-orange-600 hover:text-orange-700">
          Gestionar Bodega e Insumos →
        </a>
      </div>
    </div>
  </section>
</div>


