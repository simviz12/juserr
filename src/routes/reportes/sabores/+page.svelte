<script lang="ts">
  import Chart from 'chart.js/auto';
  let { data } = $props();

  function renderChart(node: HTMLCanvasElement, ranking: any[]) {
    // Generate some vibrant colors for the pizza flavors
    const colors = [
      '#f97316', '#ef4444', '#f59e0b', '#84cc16', '#10b981', 
      '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'
    ];

    const chart = new Chart(node, {
      type: 'doughnut',
      data: {
        labels: ranking.map(r => r.nombre),
        datasets: [{
          data: ranking.map(r => r.cantidad),
          backgroundColor: colors.slice(0, ranking.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = Math.round((value / total) * 100) + '%';
                return `${label}: ${value} porciones (${percentage})`;
              }
            }
          }
        }
      }
    });

    return {
      update(newRanking: any[]) {
        chart.data.labels = newRanking.map(r => r.nombre);
        chart.data.datasets[0].data = newRanking.map(r => r.cantidad);
        chart.update();
      },
      destroy() {
        chart.destroy();
      }
    };
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Ranking de Sabores</h1>
      <p class="text-slate-500 text-sm mt-1">Descubre cuáles son los sabores de pizza más vendidos.</p>
    </div>
  </div>

  <!-- Filtros -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
    <form method="GET" class="flex flex-col md:flex-row gap-4 items-end">
      <div class="flex-1 w-full">
        <label for="inicio" class="block text-sm font-medium text-slate-700 mb-2">Fecha Inicio</label>
        <input 
          type="date" 
          id="inicio" 
          name="inicio" 
          value={data.inicio}
          class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
        />
      </div>
      <div class="flex-1 w-full">
        <label for="fin" class="block text-sm font-medium text-slate-700 mb-2">Fecha Fin</label>
        <input 
          type="date" 
          id="fin" 
          name="fin" 
          value={data.fin}
          class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
        />
      </div>
      <button 
        type="submit" 
        class="w-full md:w-auto py-2 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md"
      >
        Filtrar
      </button>
    </form>
  </div>

  <!-- Gráfico y Tabla -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
      <h2 class="text-lg font-bold text-slate-800 mb-6 uppercase tracking-wider text-sm w-full">Distribución de Ventas</h2>
      {#if data.ranking.length === 0}
        <div class="text-center py-12 text-slate-500 w-full">
          <span class="text-4xl block mb-2">🤷‍♂️</span>
          No hay ventas registradas.
        </div>
      {:else}
        <div class="w-full relative min-h-[350px]">
          <canvas use:renderChart={data.ranking}></canvas>
        </div>
      {/if}
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <h2 class="text-lg font-bold text-slate-800 p-6 pb-2 uppercase tracking-wider text-sm">Top Sabores</h2>
      {#if data.ranking.length === 0}
        <div class="p-6 text-center text-slate-500">Sin datos para mostrar.</div>
      {:else}
        <div class="overflow-x-auto p-4 pt-0">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th class="p-3 font-medium rounded-tl-xl w-12 text-center">Pos</th>
                <th class="p-3 font-medium">Sabor</th>
                <th class="p-3 font-medium text-right rounded-tr-xl">Porciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.ranking as sabor, index}
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-3 text-center font-bold text-slate-400">
                    {#if index === 0} <span title="Más vendido" class="text-xl">🥇</span>
                    {:else if index === 1} <span title="Segundo" class="text-xl">🥈</span>
                    {:else if index === 2} <span title="Tercero" class="text-xl">🥉</span>
                    {:else} {index + 1} {/if}
                  </td>
                  <td class="p-3 font-bold text-slate-700">{sabor.nombre}</td>
                  <td class="p-3 text-right font-black text-orange-600 bg-orange-50/50">
                    {sabor.cantidad}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
