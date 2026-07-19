<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  
  let { data } = $props();

  let chartCanvas: HTMLCanvasElement;

  onMount(() => {
    if (!chartCanvas) return;
    
    // Preparar datos para el gráfico
    const labels = data.masVendidos.map(v => v.sabor || 'Desconocido');
    const values = data.masVendidos.map(v => v.cantidad || 0);

    if (labels.length === 0) {
      labels.push('Sin ventas hoy');
      values.push(1);
    }

    new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            '#f97316', // orange-500
            '#ef4444', // red-500
            '#3b82f6', // blue-500
            '#10b981', // emerald-500
            '#8b5cf6'  // violet-500
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: "'Outfit', sans-serif", size: 14 }
            }
          }
        },
        cutout: '70%'
      }
    });
  });
</script>

<div class="max-w-7xl mx-auto space-y-8">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
    <div>
      <h1 class="text-3xl font-bold text-slate-800">
        {#if data.rangoActual === 'semanal'}
          Resumen Semanal
        {:else if data.rangoActual === 'mensual'}
          Resumen Mensual
        {:else}
          Resumen Diario
        {/if}
      </h1>
      <p class="text-slate-500">Un vistazo rápido al rendimiento del negocio.</p>
    </div>
    
    <div class="flex flex-col items-end gap-3">
      <div class="bg-slate-100 p-1 rounded-xl inline-flex text-sm font-medium">
        <a href="?rango=diario{data.fechaSeleccionada ? `&fecha=${data.fechaSeleccionada}` : ''}" class="px-4 py-1.5 rounded-lg transition-colors {data.rangoActual === 'diario' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:text-slate-900'}">Diario</a>
        <a href="?rango=semanal{data.fechaSeleccionada ? `&fecha=${data.fechaSeleccionada}` : ''}" class="px-4 py-1.5 rounded-lg transition-colors {data.rangoActual === 'semanal' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:text-slate-900'}">Semanal</a>
        <a href="?rango=mensual{data.fechaSeleccionada ? `&fecha=${data.fechaSeleccionada}` : ''}" class="px-4 py-1.5 rounded-lg transition-colors {data.rangoActual === 'mensual' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:text-slate-900'}">Mensual</a>
      </div>
      <div class="flex flex-col text-right">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Cambiar Fecha</p>
        <form data-sveltekit-noscroll data-sveltekit-keepfocus>
          <input type="hidden" name="rango" value="{data.rangoActual}">
          <input 
            type="date" 
            name="fecha" 
            class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
            value="{data.fechaSeleccionada}"
            onchange={(e) => (e.target as HTMLInputElement).form?.submit()}
          >
        </form>
        {#if !data.fechaSeleccionada}
          <p class="text-xs text-slate-400 mt-1">Viendo resultados de hoy</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Cards (Top Row) -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <!-- Ventas -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-slate-500 font-medium text-sm">Ventas Declaradas</h2>
          <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <span class="text-emerald-600 text-lg">💰</span>
          </div>
        </div>
        <div class="flex items-end justify-between">
          <p class="text-3xl font-black text-slate-800 tracking-tight">
            ${data.ventasHoy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <!-- Efectivo Caja -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-slate-500 font-medium text-sm">Efectivo Físico</h2>
          <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span class="text-green-600 text-lg">💵</span>
          </div>
        </div>
        <div class="flex flex-col">
          <p class="text-3xl font-black text-orange-600 tracking-tight">
            ${data.cajaEsperada.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <!-- Transferencias -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-slate-500 font-medium text-sm">Transferencias</h2>
          <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span class="text-blue-600 text-lg">📱</span>
          </div>
        </div>
        <div class="flex flex-col">
          <p class="text-3xl font-black text-blue-600 tracking-tight">
            ${data.transferenciasHoy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <!-- Gastos -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-slate-500 font-medium text-sm">Gastos Reportados</h2>
          <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <span class="text-red-600 text-lg">📉</span>
          </div>
        </div>
        <div class="flex items-end justify-between">
          <p class="text-3xl font-black text-slate-800 tracking-tight">
            ${data.gastosHoy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>

  <!-- Charts & Lists Row -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <!-- Chart -->
    <div class="lg:col-span-2 glass-panel p-6 rounded-3xl shadow-sm border border-slate-200/50">
      <h3 class="text-lg font-bold text-slate-800 mb-6">Pizzas más vendidas hoy</h3>
      <div class="relative h-64 w-full">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    </div>

    <!-- Alerts -->
    <div class="glass-panel p-6 rounded-3xl shadow-sm border border-slate-200/50 flex flex-col">
      <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span>⚠️</span> Alertas de Inventario
      </h3>
      
      {#if data.inventarioBajo.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
          <span class="text-4xl mb-2">✅</span>
          <p>Todo el inventario está en niveles saludables.</p>
        </div>
      {:else}
        <ul class="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {#each data.inventarioBajo as item}
            <li class="bg-red-50 p-4 rounded-2xl border border-red-100 flex justify-between items-center">
              <div>
                <p class="font-bold text-red-900">{item.nombre}</p>
                <p class="text-xs text-red-500 uppercase font-medium">Solo quedan {item.stockActual} {item.unidadMedida}s</p>
              </div>
              <a href="/inventory" class="text-red-700 bg-red-100/50 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors">
                Abastecer
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>
