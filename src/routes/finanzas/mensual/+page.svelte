<script lang="ts">
  import { page } from '$app/stores';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';

  let { data } = $props();

  let totalEsperadoMes = $derived(data.cortes.reduce((acc, curr) => acc + Number(curr.totalCalculado), 0));
  let totalRealMes = $derived(data.cortes.reduce((acc, curr) => acc + Number(curr.totalReal), 0));
  let diferenciaMes = $derived(totalRealMes - totalEsperadoMes);

  function generarPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Reporte Mensual: ${data.monthLabel}`, 14, 20);
    
    autoTable(doc, {
      startY: 30,
      head: [['Fecha', 'Rango', 'Esperado', 'Físico', 'Diferencia']],
      body: data.cortes.map(c => [
        new Date(c.fechaCorte).toLocaleDateString(),
        `${new Date(c.rangoInicio).toLocaleDateString()} a ${new Date(c.rangoFin).toLocaleDateString()}`,
        `$${Number(c.totalCalculado).toFixed(2)}`,
        `$${Number(c.totalReal).toFixed(2)}`,
        `$${Number(c.diferencia).toFixed(2)}`
      ])
    });

    doc.save(`Reporte_Cortes_${data.selectedMonth}.pdf`);
  }
</script>

<div class="max-w-6xl mx-auto">
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Reporte Mensual de Cortes</h1>
      <p class="text-slate-500 text-sm mt-1">Selecciona un mes para visualizar el acumulado de las semanas.</p>
    </div>
    {#if data.selectedMonth && data.cortes.length > 0}
      <button 
        onclick={generarPDF}
        class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
      >
        <span>📄</span> Generar PDF
      </button>
    {/if}
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
    <form method="GET" class="flex flex-col md:flex-row gap-4 items-end">
      <div class="flex-1 w-full">
        <label for="mes" class="block text-sm font-medium text-slate-700 mb-2">Seleccionar Mes</label>
        <input 
          type="month" 
          id="mes" 
          name="mes" 
          value={data.selectedMonth}
          required 
          class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm font-medium text-slate-800"
        />
      </div>
      <button 
        type="submit" 
        class="w-full md:w-auto py-3 px-8 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md"
      >
        Buscar
      </button>
    </form>
  </div>

  {#if data.selectedMonth}
    <h2 class="text-xl font-bold text-slate-800 mb-4 capitalize">Resultados para {data.monthLabel}</h2>

    {#if data.cortes.length === 0}
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <span class="text-4xl block mb-2">📅</span>
        <p class="text-slate-500">No hay cortes semanales registrados en este mes.</p>
      </div>
    {:else}
      <!-- Resumen Acumulado -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Acumulado Esperado</span>
          <span class="block text-3xl font-black text-slate-700">${totalEsperadoMes.toFixed(2)}</span>
        </div>
        
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Acumulado Real</span>
          <span class="block text-3xl font-black text-slate-700">${totalRealMes.toFixed(2)}</span>
        </div>

        <div class="p-6 rounded-2xl border shadow-sm {diferenciaMes === 0 ? 'bg-emerald-50 border-emerald-200' : diferenciaMes > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}">
          <span class="block text-xs font-bold uppercase tracking-wider mb-1 {diferenciaMes === 0 ? 'text-emerald-600' : diferenciaMes > 0 ? 'text-blue-600' : 'text-red-600'}">
            Balance del Mes
          </span>
          <span class="block text-3xl font-black {diferenciaMes === 0 ? 'text-emerald-700' : diferenciaMes > 0 ? 'text-blue-700' : 'text-red-700'}">
            {diferenciaMes > 0 ? '+' : ''}{diferenciaMes.toFixed(2)}
          </span>
        </div>
      </div>

      <!-- Lista de Cortes -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th class="p-4 font-medium">Fecha de Corte</th>
                <th class="p-4 font-medium">Rango Evaluado</th>
                <th class="p-4 font-medium text-right">Esperado</th>
                <th class="p-4 font-medium text-right">Físico</th>
                <th class="p-4 font-medium text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each data.cortes as corte}
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-4 font-medium text-slate-800">
                    {new Date(corte.fechaCorte).toLocaleDateString()}
                  </td>
                  <td class="p-4 text-slate-600 text-sm">
                    {new Date(corte.rangoInicio).toLocaleDateString()} a {new Date(corte.rangoFin).toLocaleDateString()}
                  </td>
                  <td class="p-4 text-right font-medium text-slate-700">${Number(corte.totalCalculado).toFixed(2)}</td>
                  <td class="p-4 text-right font-black text-slate-800">${Number(corte.totalReal).toFixed(2)}</td>
                  <td class="p-4 text-right">
                    <span class="px-3 py-1 rounded-full text-sm font-bold {Number(corte.diferencia) === 0 ? 'bg-emerald-100 text-emerald-700' : Number(corte.diferencia) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}">
                      {Number(corte.diferencia) > 0 ? '+' : ''}{Number(corte.diferencia).toFixed(2)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>
