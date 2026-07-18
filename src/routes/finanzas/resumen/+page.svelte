<script lang="ts">
  import Chart from 'chart.js/auto';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  let { data } = $props();

  function exportToPDF() {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Reporte Financiero - JuanchoPizza', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rango: ${data.inicio || 'Todo'} a ${data.fin || 'Todo'}`, 14, 30);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumen General', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Ventas Brutas', 'Gastos Totales', 'Utilidad Neta']],
      body: [[
        `$${data.granTotal.ventasBrutas.toFixed(2)}`,
        `$${data.granTotal.gastos.toFixed(2)}`,
        `$${data.granTotal.utilidadNeta.toFixed(2)}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.text('Desglose Semanal', 14, (doc as any).lastAutoTable.finalY + 15);
    
    const bodyData = data.semanas.map(s => [
      new Date(s.lunes).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      `$${s.ventasBrutas.toFixed(2)}`,
      `-$${s.gastos.toFixed(2)}`,
      `$${s.utilidadNeta.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Semana', 'Ventas', 'Gastos', 'Neta']],
      body: bodyData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });
    
    doc.save(`Reporte_JuanchoPizza_${data.inicio || 'Historico'}.pdf`);
  }

  function renderChart(node: HTMLCanvasElement, semanas: any[]) {
    const chart = new Chart(node, {
      type: 'bar',
      data: {
        labels: semanas.map(s => new Date(s.lunes).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })),
        datasets: [
          {
            label: 'Ventas Brutas',
            data: semanas.map(s => s.ventasBrutas),
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Gastos',
            data: semanas.map(s => s.gastos),
            backgroundColor: '#ef4444',
            borderRadius: 6
          },
          {
            label: 'Utilidad Neta',
            data: semanas.map(s => s.utilidadNeta),
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) { label += ': '; }
                if (context.parsed.y !== null) { label += '$' + context.parsed.y.toFixed(2); }
                return label;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } } }
        }
      }
    });

    return {
      update(newSemanas: any[]) {
        chart.data.labels = newSemanas.map(s => new Date(s.lunes).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        chart.data.datasets[0].data = newSemanas.map(s => s.ventasBrutas);
        chart.data.datasets[1].data = newSemanas.map(s => s.gastos);
        chart.data.datasets[2].data = newSemanas.map(s => s.utilidadNeta);
        chart.update();
      },
      destroy() {
        chart.destroy();
      }
    };
  }
</script>

<div class="max-w-6xl mx-auto">
  <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <span class="text-3xl">💼</span> Reporte Financiero General
      </h1>
      <p class="text-slate-500 text-sm mt-1">Visión gerencial de ingresos, gastos y utilidad neta.</p>
    </div>
    {#if data.semanas.length > 0}
      <button 
        onclick={exportToPDF}
        class="py-2 px-6 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-sm flex items-center gap-2"
      >
        <span>📥</span> Exportar PDF
      </button>
    {/if}
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
          class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>
      <div class="flex-1 w-full">
        <label for="fin" class="block text-sm font-medium text-slate-700 mb-2">Fecha Fin</label>
        <input 
          type="date" 
          id="fin" 
          name="fin" 
          value={data.fin}
          class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>
      <button 
        type="submit" 
        class="w-full md:w-auto py-2 px-8 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md"
      >
        Analizar
      </button>
    </form>
  </div>

  {#if data.semanas.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
      <span class="text-5xl block mb-4">📉</span>
      No hay datos financieros registrados en el rango seleccionado.
    </div>
  {:else}
    <!-- Gran Total Mensual -->
    <h2 class="text-lg font-bold text-slate-800 mb-4 px-2 uppercase tracking-wider text-sm">Gran Total del Rango</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-2 h-full bg-blue-500"></div>
        <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ventas Brutas</span>
        <span class="block text-4xl font-black text-slate-800">${data.granTotal.ventasBrutas.toFixed(2)}</span>
        <p class="text-xs text-slate-500 mt-2">Todo el dinero que ingresó</p>
      </div>
      
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-2 h-full bg-red-500"></div>
        <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos Totales</span>
        <span class="block text-4xl font-black text-red-600">${data.granTotal.gastos.toFixed(2)}</span>
        <p class="text-xs text-slate-500 mt-2">Dinero gastado en turnos</p>
      </div>

      <div class="p-6 rounded-2xl shadow-sm border bg-emerald-50 border-emerald-200 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-2 h-full bg-emerald-500"></div>
        <span class="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Utilidad Neta (Efectivo)</span>
        <span class="block text-4xl font-black text-emerald-700">${data.granTotal.utilidadNeta.toFixed(2)}</span>
        <p class="text-xs text-emerald-600/80 mt-2">Dinero libre para el negocio</p>
      </div>
    </div>

    <!-- Gráfico y Desglose -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
        <h2 class="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wider text-sm">Tendencia Semanal</h2>
        <div class="flex-1 w-full relative min-h-[300px]">
          <canvas use:renderChart={data.semanas}></canvas>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <h2 class="text-lg font-bold text-slate-800 p-6 pb-2 uppercase tracking-wider text-sm">Desglose Detallado</h2>
        <div class="overflow-x-auto p-4 pt-0 flex-1">
          <table class="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th class="p-3 font-medium rounded-tl-xl">Semana</th>
                <th class="p-3 font-medium text-right text-blue-500">Ventas</th>
                <th class="p-3 font-medium text-right text-red-500">Gastos</th>
                <th class="p-3 font-medium text-right text-emerald-500 rounded-tr-xl">Neta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.semanas as semana}
                <tr class="hover:bg-slate-50 transition-colors text-sm">
                  <td class="p-3 font-bold text-slate-700">
                    {new Date(semana.lunes).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </td>
                  <td class="p-3 text-right font-medium text-slate-600">${semana.ventasBrutas.toFixed(2)}</td>
                  <td class="p-3 text-right font-medium text-red-500">-${semana.gastos.toFixed(2)}</td>
                  <td class="p-3 text-right font-bold text-emerald-600">${semana.utilidadNeta.toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>
