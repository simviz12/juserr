<script lang="ts">
  import Chart from 'chart.js/auto';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  let { data } = $props();

  let vistaActiva = $state<'diario' | 'semanal'>('diario');

  function exportToPDF() {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text('Reporte Financiero - JuanchoPizza', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Rango evaluado: ${data.inicio || 'Inicio'} hasta ${data.fin || 'Fin'}`, 14, 30);
    
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Consolidado General', 14, 42);
    
    autoTable(doc, {
      startY: 46,
      head: [['Ventas Brutas', 'Efectivo', 'Transferencias (Nequi)', 'Gastos Turnos', 'Utilidad Neta']],
      body: [[
        `$${data.granTotal.ventasBrutas.toLocaleString('es-CO')}`,
        `$${data.granTotal.efectivo.toLocaleString('es-CO')}`,
        `$${data.granTotal.transferencias.toLocaleString('es-CO')}`,
        `-$${data.granTotal.gastos.toLocaleString('es-CO')}`,
        `$${data.granTotal.utilidadNeta.toLocaleString('es-CO')}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }
    });
    
    doc.text('2. Historial de Días Detallado', 14, (doc as any).lastAutoTable.finalY + 12);
    
    const bodyDias = (data.historialDias || []).map(d => [
      d.fecha,
      `$${d.ventasBrutas.toLocaleString('es-CO')}`,
      `$${d.efectivo.toLocaleString('es-CO')}`,
      `$${d.transferencias.toLocaleString('es-CO')}`,
      `-$${d.gastos.toLocaleString('es-CO')}`,
      `$${d.utilidadNeta.toLocaleString('es-CO')}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [['Fecha', 'Venta Bruta', 'Efectivo', 'Nequi', 'Gastos', 'Libre']],
      body: bodyDias,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }
    });
    
    doc.save(`JuanchoPizza_Finanzas_${data.inicio || 'Historico'}.pdf`);
  }

  function renderChart(node: HTMLCanvasElement, params: { semanas: any[], dias: any[] }) {
    let chartInstance = new Chart(node, {
      type: 'bar',
      data: {
        labels: params.dias.slice(0, 14).reverse().map(d => d.fecha),
        datasets: [
          {
            label: 'Venta Bruta',
            data: params.dias.slice(0, 14).reverse().map(d => d.ventasBrutas),
            backgroundColor: '#f97316',
            borderRadius: 6
          },
          {
            label: 'Gastos',
            data: params.dias.slice(0, 14).reverse().map(d => d.gastos),
            backgroundColor: '#ef4444',
            borderRadius: 6
          },
          {
            label: 'Dinero Libre',
            data: params.dias.slice(0, 14).reverse().map(d => d.utilidadNeta),
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
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString('es-CO')}`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            ticks: { 
              callback: (v) => '$' + Number(v).toLocaleString('es-CO') 
            } 
          }
        }
      }
    });

    return {
      update(newParams: { semanas: any[], dias: any[] }) {
        chartInstance.data.labels = newParams.dias.slice(0, 14).reverse().map(d => d.fecha);
        chartInstance.data.datasets[0].data = newParams.dias.slice(0, 14).reverse().map(d => d.ventasBrutas);
        chartInstance.data.datasets[1].data = newParams.dias.slice(0, 14).reverse().map(d => d.gastos);
        chartInstance.data.datasets[2].data = newParams.dias.slice(0, 14).reverse().map(d => d.utilidadNeta);
        chartInstance.update();
      },
      destroy() {
        chartInstance.destroy();
      }
    };
  }
</script>

<div class="max-w-7xl mx-auto space-y-6">
  <!-- Encabezado con Botón Exportar -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div>
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold mb-2">
        <span>✨</span> Panel Ejecutivo de Finanzas
      </div>
      <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Rendimiento y Caja</h1>
      <p class="text-slate-500 text-sm mt-1">Monitorea el flujo de dinero, desglose de pagos e historial diario de turnos.</p>
    </div>

    {#if data.historialDias && data.historialDias.length > 0}
      <button 
        onclick={exportToPDF}
        class="py-3 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
      >
        <span>📄</span> Descargar Informe PDF
      </button>
    {/if}
  </div>

  <!-- Filtro de Rango -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
    <form method="GET" class="flex flex-col md:flex-row gap-4 items-end">
      <div class="flex-1 w-full">
        <label for="inicio" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Desde</label>
        <input 
          type="date" 
          id="inicio" 
          name="inicio" 
          value={data.inicio}
          class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold text-slate-700"
        />
      </div>
      <div class="flex-1 w-full">
        <label for="fin" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Hasta</label>
        <input 
          type="date" 
          id="fin" 
          name="fin" 
          value={data.fin}
          class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold text-slate-700"
        />
      </div>
      <button 
        type="submit" 
        class="w-full md:w-auto py-3 px-8 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
      >
        <span>🔍</span> Filtrar
      </button>
    </form>
  </div>

  {#if !data.historialDias || data.historialDias.length === 0}
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center text-slate-400">
      <span class="text-6xl block mb-4">📊</span>
      <h3 class="text-lg font-bold text-slate-700">Sin datos financieros para este rango</h3>
      <p class="text-sm text-slate-400 mt-1">Realiza cierres diarios de caja para ver gráficos e historial aquí.</p>
    </div>
  {:else}
    <!-- Tarjetas KPI Principales -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Ventas Brutas -->
      <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-black tracking-wider uppercase text-slate-400">Venta Bruta Total</span>
          <span class="p-2 bg-orange-100 text-orange-600 rounded-xl text-lg">💰</span>
        </div>
        <div class="text-3xl font-black text-slate-900">${data.granTotal.ventasBrutas.toLocaleString('es-CO')}</div>
        <p class="text-xs text-slate-400 mt-2">Promedio: <strong class="text-slate-700">${Math.round(data.promedioDiario).toLocaleString('es-CO')}</strong> / día</p>
      </div>

      <!-- Efectivo Recibido -->
      <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-black tracking-wider uppercase text-slate-400">Efectivo en Caja</span>
          <span class="p-2 bg-blue-100 text-blue-600 rounded-xl text-lg">💵</span>
        </div>
        <div class="text-3xl font-black text-slate-900">${data.granTotal.efectivo.toLocaleString('es-CO')}</div>
        <p class="text-xs text-slate-400 mt-2">Dinero físico ingresado</p>
      </div>

      <!-- Nequi / Transferencias -->
      <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-black tracking-wider uppercase text-slate-400">Nequi (Transferencias)</span>
          <span class="p-2 bg-purple-100 text-purple-600 rounded-xl text-lg">📱</span>
        </div>
        <div class="text-3xl font-black text-slate-900">${data.granTotal.transferencias.toLocaleString('es-CO')}</div>
        <p class="text-xs text-slate-400 mt-2">Total bancarizado</p>
      </div>

      <!-- Utilidad Neta / Libre -->
      <div class="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-black tracking-wider uppercase text-emerald-100">Dinero Libre (Neto)</span>
          <span class="p-2 bg-white/20 rounded-xl text-lg">📈</span>
        </div>
        <div class="text-3xl font-black">${data.granTotal.utilidadNeta.toLocaleString('es-CO')}</div>
        <p class="text-xs text-emerald-100 mt-2">Menos <strong class="text-white">${data.granTotal.gastos.toLocaleString('es-CO')}</strong> en gastos</p>
      </div>
    </div>

    <!-- Gráfico y Resumen de Métodos -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Gráfico de tendencia -->
      <div class="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-base font-extrabold text-slate-900 uppercase tracking-wider text-xs">Histórico de Ventas vs Gastos</h2>
          <span class="text-xs text-slate-400">Últimos días</span>
        </div>
        <div class="flex-1 w-full relative min-h-[300px]">
          <canvas use:renderChart={{ semanas: data.semanas, dias: data.historialDias }}></canvas>
        </div>
      </div>

      <!-- Desglose de Canales y Gastos -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between space-y-6">
        <div>
          <h3 class="font-extrabold text-slate-900 text-sm mb-4 uppercase tracking-wider text-xs">Canales de Pago</h3>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span>Efectivo ({data.granTotal.ventasBrutas > 0 ? Math.round((data.granTotal.efectivo / data.granTotal.ventasBrutas) * 100) : 0}%)</span>
                <span>${data.granTotal.efectivo.toLocaleString('es-CO')}</span>
              </div>
              <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" style="width: {data.granTotal.ventasBrutas > 0 ? (data.granTotal.efectivo / data.granTotal.ventasBrutas) * 100 : 0}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span>Nequi ({data.granTotal.ventasBrutas > 0 ? Math.round((data.granTotal.transferencias / data.granTotal.ventasBrutas) * 100) : 0}%)</span>
                <span>${data.granTotal.transferencias.toLocaleString('es-CO')}</span>
              </div>
              <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-purple-500 rounded-full" style="width: {data.granTotal.ventasBrutas > 0 ? (data.granTotal.transferencias / data.granTotal.ventasBrutas) * 100 : 0}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold text-slate-600 mb-1">
                <span>Gastos Menores en Turno</span>
                <span class="text-red-500">-${data.granTotal.gastos.toLocaleString('es-CO')}</span>
              </div>
              <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-red-400 rounded-full" style="width: {data.granTotal.ventasBrutas > 0 ? (data.granTotal.gastos / data.granTotal.ventasBrutas) * 100 : 0}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gastos Recientes -->
        <div class="border-t border-slate-100 pt-4">
          <h4 class="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Gastos de Caja Registrados</h4>
          {#if data.listaGastos && data.listaGastos.length > 0}
            <div class="space-y-2">
              {#each data.listaGastos.slice(0, 4) as g}
                <div class="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50">
                  <span class="text-slate-700 font-medium truncate max-w-[150px]">{g.descripcion}</span>
                  <span class="text-red-600 font-bold">-${Number(g.monto).toLocaleString('es-CO')}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-slate-400 italic">No hay gastos en este rango.</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- TABLA: Historial de Días -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900">Historial Diario de Turnos</h2>
          <p class="text-xs text-slate-400 mt-0.5">Detalle día a día de lo que entró y salió de caja.</p>
        </div>
        <div class="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button 
            onclick={() => vistaActiva = 'diario'}
            class="px-4 py-2 rounded-xl transition-all {vistaActiva === 'diario' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}"
          >
            Vista Diaria ({data.historialDias.length})
          </button>
          <button 
            onclick={() => vistaActiva = 'semanal'}
            class="px-4 py-2 rounded-xl transition-all {vistaActiva === 'semanal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}"
          >
            Agrupado Semanas ({data.semanas.length})
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        {#if vistaActiva === 'diario'}
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
                <th class="p-4 pl-6">Fecha</th>
                <th class="p-4 text-right">Efectivo</th>
                <th class="p-4 text-right">Nequi</th>
                <th class="p-4 text-right text-red-500">Gastos</th>
                <th class="p-4 text-right font-black text-slate-700">Venta Bruta</th>
                <th class="p-4 text-right font-black text-emerald-600 pr-6">Libre (Neto)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              {#each data.historialDias as dia}
                <tr class="hover:bg-slate-50/70 transition-colors">
                  <td class="p-4 pl-6 font-bold text-slate-800 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-orange-400"></span>
                    {dia.fecha}
                  </td>
                  <td class="p-4 text-right text-slate-600 font-semibold">${dia.efectivo.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right text-purple-600 font-semibold">${dia.transferencias.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right text-red-500 font-semibold">-${dia.gastos.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right font-bold text-slate-900">${dia.ventasBrutas.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right font-black text-emerald-600 pr-6">${dia.utilidadNeta.toLocaleString('es-CO')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
                <th class="p-4 pl-6">Semana</th>
                <th class="p-4 text-right">Días</th>
                <th class="p-4 text-right">Venta Bruta</th>
                <th class="p-4 text-right text-red-500">Gastos</th>
                <th class="p-4 text-right font-black text-emerald-600 pr-6">Utilidad Neta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              {#each data.semanas as sem}
                <tr class="hover:bg-slate-50/70 transition-colors">
                  <td class="p-4 pl-6 font-bold text-slate-800">
                    Semana del {new Date(sem.lunes).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </td>
                  <td class="p-4 text-right text-slate-500 font-medium">{sem.diasContados} días</td>
                  <td class="p-4 text-right font-bold text-slate-900">${sem.ventasBrutas.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right text-red-500 font-semibold">-${sem.gastos.toLocaleString('es-CO')}</td>
                  <td class="p-4 text-right font-black text-emerald-600 pr-6">${sem.utilidadNeta.toLocaleString('es-CO')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {/if}
</div>

