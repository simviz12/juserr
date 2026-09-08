<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, slide } from 'svelte/transition';
  let { data, form } = $props();

  let gastos = $state<{ id: number; descripcion: string; monto: string }[]>([]);
  let nextGastoId = 1;

  function addGasto() { gastos.push({ id: nextGastoId++, descripcion: '', monto: '' }); }
  function removeGasto(id: number) { gastos = gastos.filter(g => g.id !== id); }

  // ── Estados del formulario ────────────────────────────────────────────────
  let montoFisico      = $state('');
  let nequi            = $state('');
  let refNequi         = $state('');
  let masasSobrantesStr   = $state('');
  let porcionesSobrantesStr = $state('');
  let porcionesMermadasStr  = $state('');

  // Registro de quemadas por sabor reactivo
  let quemadasPorSabor = $state<Record<number, number>>({});

  function updateQuemada(saborId: number, val: string) {
    const parsed = parseInt(val) || 0;
    quemadasPorSabor[saborId] = parsed;
    const total = Object.values(quemadasPorSabor).reduce((a, b) => a + b, 0);
    porcionesMermadasStr = total.toString();
  }

  // ── Derivados de inventario ───────────────────────────────────────────────
  let masasIniciales   = $derived(data.inventario.masasActuales);
  let porcionesAyer    = $derived(data.inventario.porcionesAyer);
  let precioPorcion    = $derived(data.inventario.precioPorcion);
  let masasSobrantes   = $derived(parseFloat(masasSobrantesStr)   || 0);
  let porcionesSobrantes = $derived(parseInt(porcionesSobrantesStr)  || 0);
  let porcionesMermadas  = $derived(parseInt(porcionesMermadasStr)   || 0);
  let masasUsadas      = $derived(Math.max(0, masasIniciales - masasSobrantes));
  let porcionesNuevas  = $derived(masasUsadas * 8);
  let totalPorcionesDisp = $derived(porcionesNuevas + porcionesAyer);
  let porcionesVendidas  = $derived(Math.max(0, totalPorcionesDisp - porcionesSobrantes - porcionesMermadas));
  let granTotalEsperado  = $derived(porcionesVendidas * precioPorcion);

  // ── Derivados de caja y transferencias ────────────────────────────────────
  let efectivoNum   = $derived(parseFloat(montoFisico) || 0);
  let nequiNum      = $derived(parseFloat(nequi)       || 0);
  let totalGastos   = $derived(gastos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0));

  let totalTransferencias = $derived(nequiNum);
  let totalDeclarado      = $derived(efectivoNum + totalTransferencias + totalGastos);
  let diferencia          = $derived(totalDeclarado - granTotalEsperado);

  let hayDatos = $derived(montoFisico !== '' || nequi !== '' || gastos.length > 0);
</script>

<div class="max-w-4xl mx-auto">
  <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div>
      <h1 class="text-3xl font-black text-slate-900 tracking-tight">Cierre de Turno</h1>
      <p class="text-slate-500 font-medium mt-1">Audita el inventario físico y cuadra la caja.</p>
    </div>
    
    <div class="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/60 rounded-3xl p-6 min-w-[300px] shadow-sm">
      <div>
        <p class="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">Venta Esperada</p>
        <p class="text-4xl font-black text-orange-600">${granTotalEsperado.toLocaleString('es-CO')}</p>
        <div class="text-xs text-orange-700 mt-3 space-y-1 bg-white/60 p-3 rounded-xl border border-orange-100">
          <p class="flex justify-between"><span>📦 Masas Usadas:</span> <span class="font-bold text-slate-800">{masasUsadas}</span></p>
          <p class="flex justify-between"><span>🍕 Porciones Vendidas:</span> <span class="font-bold text-slate-800">{porcionesVendidas}</span></p>
        </div>
      </div>
    </div>
  </div>

  {#if form?.success}
    <div  class="bg-emerald-50 text-emerald-800 p-5 rounded-2xl mb-6 shadow-sm border border-emerald-200 flex items-center gap-3">
      <span class="text-2xl">✨</span>
      <div>
        <span class="font-bold block">¡Éxito!</span>
        <span class="text-sm">{form.message}</span>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div  class="bg-red-50 text-red-800 p-5 rounded-2xl mb-6 shadow-sm border border-red-200 flex items-center gap-3">
      <span class="text-2xl">⚠️</span>
      <div>
        <span class="font-bold block">Error</span>
        <span class="text-sm">{form.error}</span>
      </div>
    </div>
  {/if}

  <form method="POST" use:enhance={() => {
    return async ({ update }) => {
      await update();
      if (form?.success) {
        gastos = [];
      }
    };
  }} class="space-y-8">
    
    <!-- Sección de Inventario -->
    <div class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
      <h2 class="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span class="bg-orange-100 p-2 rounded-xl">📦</span> Inventario Físico
      </h2>
      
      <!-- Campos ocultos para enviar al backend -->
      <input type="hidden" name="masas_iniciales" value={masasIniciales} />
      <input type="hidden" name="porciones_ayer" value={porcionesAyer} />

      <div class="grid grid-cols-1 gap-6">
        <div>
          <label for="masas_sobrantes" class="block text-sm font-bold text-slate-600 mb-2">Masas Crudas Sobrantes</label>
          <div class="flex items-center gap-4">
            <input 
              type="number" 
              id="masas_sobrantes" 
              name="masas_sobrantes" 
              bind:value={masasSobrantesStr}
              required 
              min="0"
              step="0.5"
              placeholder="Ej. 12"
              class="w-full md:w-1/2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-bold text-slate-800"
            />
            <span class="text-sm bg-slate-100 text-slate-500 font-bold px-3 py-2 rounded-xl whitespace-nowrap">de {masasIniciales} iniciales</span>
          </div>
        </div>

        <div>
          <label for="porciones_sobrantes" class="block text-sm font-bold text-slate-600 mb-2">Porciones Buenas Sobrantes (Vitrina para mañana)</label>
          <input 
            type="number" 
            id="porciones_sobrantes" 
            name="porciones_sobrantes" 
            bind:value={porcionesSobrantesStr}
            required 
            min="0"
            step="1"
            placeholder="Ej. 3"
            class="w-full md:w-1/2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-bold text-slate-800"
          />
          <p class="text-xs text-slate-400 mt-1">Porciones en perfecto estado que quedan disponibles para el inicio del siguiente turno.</p>
        </div>

        <div>
          <label for="porciones_mermadas" class="block text-sm font-bold text-slate-600 mb-2">🔥 Pizzas / Porciones Quemadas o Dañadas (Merma)</label>
          <input 
            type="number" 
            id="porciones_mermadas" 
            name="porciones_mermadas" 
            bind:value={porcionesMermadasStr}
            required 
            min="0"
            step="1"
            placeholder="Ej. 0"
            class="w-full md:w-1/2 px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-bold text-rose-800"
          />
          <p class="text-xs text-rose-600 mt-1">
            ⚠️ <strong>Importante:</strong> Las porciones quemadas se descuentan de la venta esperada. Es decir, el sistema <strong>no</strong> exigirá el dinero de estas porciones en caja, pero registrará la pérdida en el inventario.
          </p>
        </div>
      </div>
    </div>

    <!-- Sección de Desglose de Sabores -->
    <div class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
      <h2 class="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span class="bg-orange-100 p-2 rounded-xl">🍕</span> Desglose por Sabores y Mermas
      </h2>
      <p class="text-sm font-medium text-slate-500 mb-6">Detalla cuántas ruedas preparaste, cuántas porciones buenas sobraron en vitrina y si hubo porciones quemadas o dañadas por sabor:</p>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
              <th class="py-3 font-bold">Sabor</th>
              <th class="py-3 font-bold">Ruedas Preparadas</th>
              <th class="py-3 font-bold">Porciones Sobrantes</th>
              <th class="py-3 font-bold text-rose-600">Porciones Quemadas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            {#each data.sabores as sabor}
              <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="py-4 font-bold text-slate-800">{sabor.nombre}</td>
                <td class="py-4 pr-4">
                  <input 
                    type="number" 
                    name="ruedas_{sabor.id}" 
                    min="0" 
                    step="1" 
                    placeholder="0"
                    class="w-full max-w-[120px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700"
                  />
                </td>
                <td class="py-4 pr-4">
                  <input 
                    type="number" 
                    name="sobras_{sabor.id}" 
                    min="0" 
                    step="0.5" 
                    placeholder="0"
                    class="w-full max-w-[120px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700"
                  />
                </td>
                <td class="py-4">
                  <input 
                    type="number" 
                    name="quemadas_{sabor.id}" 
                    min="0" 
                    step="1" 
                    placeholder="0"
                    oninput={(e) => updateQuemada(sabor.id, e.currentTarget.value)}
                    class="w-full max-w-[120px] px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-700"
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sección de Caja Desglosada -->
    <div class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
      <h2 class="text-xl font-black text-slate-800 mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span class="bg-orange-100 p-2 rounded-xl">💳</span> Medios de Pago
      </h2>
      <p class="text-sm font-medium text-slate-500 mb-6">Detalla el dinero recibido en cada plataforma. El sistema sumará todo para el cuadre.</p>

      <div class="space-y-5">
        <!-- Efectivo -->
        <div class="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <label for="monto" class="block text-sm font-black text-emerald-800 mb-2">💵 Efectivo Físico en Caja</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700 font-black">$</span>
            <input type="number" id="monto" name="monto" bind:value={montoFisico}
              required min="0" step="100" placeholder="0"
              class="w-full md:w-1/2 pl-10 pr-4 py-3.5 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
            />
          </div>
        </div>

        <!-- Nequi -->
        <div class="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-3">
          <label class="block text-sm font-black text-purple-800">📱 Nequi</label>
          <div class="flex flex-col md:flex-row gap-4">
            <div class="relative flex-1">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-purple-700 font-black">$</span>
              <input type="number" name="nequi" bind:value={nequi}
                min="0" step="100" placeholder="0"
                class="w-full pl-10 pr-4 py-3.5 bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-800"
              />
            </div>
            <input type="text" name="ref_nequi" bind:value={refNequi}
              placeholder="Referencias (Ej: Cel 313..., Cel 310...)"
              class="flex-1 md:flex-[2] px-4 py-3.5 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none text-sm font-medium text-slate-700"
            />
          </div>
        </div>



        <!-- Mini resumen de transferencias -->
        {#if totalTransferencias > 0}
          <div  class="flex justify-between items-center text-sm px-2 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <span class="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Nequi:</span>
            <span class="font-black text-slate-700 text-lg">${totalTransferencias.toLocaleString('es-CO')}</span>
          </div>
        {/if}

        <!-- Observaciones -->
        <div class="pt-4">
          <label for="descripcion" class="block text-sm font-bold text-slate-600 mb-2">Observaciones del Turno (Opcional)</label>
          <textarea id="descripcion" name="descripcion" rows="2"
            placeholder="Ej: Faltó billete de $50, el datafono falló en la mañana..."
            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium text-slate-800 resize-none"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Sección de Gastos -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>🧾</span> Gastos del Turno
        </h2>
        <button 
          type="button" 
          onclick={addGasto}
          class="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors"
        >
          + Agregar Gasto
        </button>
      </div>

      {#if gastos.length === 0}
        <div class="text-center py-6 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No has registrado ningún gasto en este turno.
        </div>
      {:else}
        <div class="space-y-3">
          {#each gastos as gasto (gasto.id)}
            <div  class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input 
                type="text" 
                name="gasto_descripcion" 
                bind:value={gasto.descripcion}
                placeholder="¿En qué se gastó? (Ej: Hielo)" 
                required 
                class="flex-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
              <div class="flex gap-2 w-full sm:w-auto">
                <div class="relative flex-1 sm:w-32">
                  <span class="absolute left-3 top-3 text-slate-400">$</span>
                  <input 
                    type="number" 
                    name="gasto_monto" 
                    bind:value={gasto.monto}
                    step="0.01" 
                    min="0.01" 
                    required 
                    placeholder="0.00"
                    class="w-full pl-7 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                </div>
                <button 
                  type="button" 
                  onclick={() => removeGasto(gasto.id)}
                  class="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors font-bold text-xl"
                  title="Eliminar gasto"
                >
                  &times;
                </button>
              </div>
            </div>
          {/each}
        </div>
        
        <div class="mt-4 pt-4 border-t border-slate-100 text-right">
          <span class="text-slate-500 text-sm">Total de gastos declarados:</span>
          <span class="text-xl font-bold text-red-600 ml-2">$-{totalGastos.toFixed(2)}</span>
        </div>
      {/if}
    </div>

    <!-- Cuadre de Caja -->
    {#if hayDatos}
      <div class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 space-y-6">
        <div class="border-b border-slate-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h2 class="text-xl font-black text-slate-800 flex items-center gap-3">
              <span class="bg-blue-100 p-2 rounded-xl">⚖️</span> Balance y Cuadre de Turno
            </h2>
            <p class="text-xs text-slate-400 mt-1">Comparación exacta entre el dinero recibido (físico + digital) y las porciones vendidas.</p>
          </div>
          <span class="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full {diferencia === 0 ? 'bg-emerald-100 text-emerald-700' : diferencia > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}">
            {diferencia === 0 ? '✓ Caja Cuadrada' : diferencia > 0 ? 'Sobrante en Caja' : 'Faltante de Dinero'}
          </span>
        </div>

        <!-- 3 Columnas Explicativas de Dinero -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Columna 1: Efectivo Físico -->
          <div class="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
            <span class="text-xs font-bold uppercase text-emerald-800 tracking-wider block">1. Físico en Cajón</span>
            <p class="text-2xl font-black text-emerald-700 mt-1">${efectivoNum.toLocaleString('es-CO')}</p>
            <p class="text-xs text-emerald-600 mt-2">Billetes y monedas contados físicamente en la gaveta.</p>
          </div>

          <!-- Columna 2: Nequi Digital -->
          <div class="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
            <span class="text-xs font-bold uppercase text-purple-800 tracking-wider block">2. Nequi (En el Celular)</span>
            <p class="text-2xl font-black text-purple-700 mt-1">${nequiNum.toLocaleString('es-CO')}</p>
            <p class="text-xs text-purple-600 mt-2">Plata recibida en la cuenta Nequi (<strong>no</strong> está en la gaveta física).</p>
          </div>

          <!-- Columna 3: Gastos Menores -->
          <div class="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
            <span class="text-xs font-bold uppercase text-amber-800 tracking-wider block">3. Gastos del Turno</span>
            <p class="text-2xl font-black text-amber-700 mt-1">-${totalGastos.toLocaleString('es-CO')}</p>
            <p class="text-xs text-amber-600 mt-2">Dinero de la caja usado para compras inmediatas (hielo, insumos).</p>
          </div>
        </div>

        <!-- Tabla Resumen Comparativa -->
        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
          <div class="flex justify-between items-center text-sm">
            <span class="text-slate-600 font-medium">Dinero Físico en Gaveta:</span>
            <span class="font-bold text-slate-800">${efectivoNum.toLocaleString('es-CO')}</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-slate-600 font-medium">+ Transferencias Nequi en Cuenta:</span>
            <span class="font-bold text-purple-700">+${nequiNum.toLocaleString('es-CO')}</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-slate-600 font-medium">+ Gastos Justificados con Recibo/Turno:</span>
            <span class="font-bold text-amber-700">+${totalGastos.toLocaleString('es-CO')}</span>
          </div>

          <div class="pt-3 border-t border-slate-200 flex justify-between items-center">
            <span class="font-bold text-slate-700">Total Producido Declarado:</span>
            <span class="text-lg font-black text-slate-900">${totalDeclarado.toLocaleString('es-CO')}</span>
          </div>

          <div class="flex justify-between items-center text-sm">
            <span class="font-medium text-slate-500">Venta Esperada por Inventario ({porcionesVendidas} porciones vendidas):</span>
            <span class="font-bold text-slate-700">${granTotalEsperado.toLocaleString('es-CO')}</span>
          </div>

          <!-- Diferencia final -->
          <div class="pt-3 border-t-2 border-slate-300 flex justify-between items-center">
            <div>
              <span class="text-base font-black text-slate-900 block">Diferencia (Descuadre):</span>
              <span class="text-xs text-slate-500">Total Declarado menos Venta Esperada por Porciones</span>
            </div>
            <span class="text-2xl font-black {diferencia > 0 ? 'text-blue-600' : diferencia < 0 ? 'text-rose-600' : 'text-emerald-600'}">
              {diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-CO')}
            </span>
          </div>
        </div>

        {#if diferencia > 0}
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
            <span class="text-blue-600 text-2xl">💡</span>
            <div>
              <p class="text-sm font-bold text-blue-900">Sobrante de dinero (+${diferencia.toLocaleString('es-CO')})</p>
              <p class="text-xs text-blue-800 mt-1">
                Entró más dinero del esperado por inventario. Puede deberse a propinas voluntarias, venta de gaseosas/bebidas o redondeos a favor.
              </p>
            </div>
          </div>
        {:else if diferencia < 0}
          <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <span class="text-rose-600 text-2xl">⚠️</span>
            <div>
              <p class="text-sm font-bold text-rose-900">Faltante de dinero (-${Math.abs(diferencia).toLocaleString('es-CO')})</p>
              <p class="text-xs text-rose-800 mt-1">
                Falta dinero en comparación con las porciones que salieron del horno. Revisa si olvidaste registrar algún gasto menor pagado en efectivo, un pago recibido por Nequi, o si hubo alguna pizza quemada/dañada que no registraste en la casilla de merma.
              </p>
            </div>
          </div>
        {:else}
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <span class="text-emerald-600 text-2xl">🎉</span>
            <div>
              <p class="text-sm font-bold text-emerald-900">¡Caja perfectamente balanceada!</p>
              <p class="text-xs text-emerald-800 mt-1">
                El total del dinero (físico + Nequi + gastos) coincide exactamente con las porciones vendidas.
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Botón de Envío -->
    <div class="pt-4">
      <button 
        type="submit" 
        class="w-full py-4 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md hover:shadow-lg text-lg flex justify-center items-center gap-3"
      >
        <span>🔒</span> Guardar y Cerrar Turno
      </button>
    </div>
    
  </form>

  <!-- HISTORIAL COMPLETO DE TURNOS Y AUDITORÍA DE CAJA -->
  {#if data.historialTurnos && data.historialTurnos.length > 0}
    <div class="mt-12 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
      <div class="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-2">
            <span>🕒</span> Auditoría y Trazabilidad
          </div>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">Historial de Turnos y Entradas de Caja</h2>
          <p class="text-sm text-slate-500 mt-1">
            Registro detallado con fecha, hora exacta, desglose de lo que entró a caja física, transferencias Nequi y salidas por gastos.
          </p>
        </div>
        <span class="text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full">
          {data.historialTurnos.length} turnos registrados
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
              <th class="p-4 pl-6">Fecha y Hora</th>
              <th class="p-4 text-center">Porciones Vendidas</th>
              <th class="p-4 text-center text-rose-500">Mermas</th>
              <th class="p-4 text-right">💵 Efectivo</th>
              <th class="p-4 text-right text-purple-600">📱 Nequi</th>
              <th class="p-4 text-right text-amber-600">🧾 Gastos</th>
              <th class="p-4 text-right pr-6 font-black text-slate-900">Total Producido</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            {#each data.historialTurnos as turno}
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="p-4 pl-6 font-bold text-slate-800">
                  <div class="flex flex-col">
                    <span class="text-slate-900">
                      {turno.fecha ? new Date(turno.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                    <span class="text-xs font-semibold text-slate-400">
                      {turno.fecha ? new Date(turno.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {#if turno.descripcion}
                      <span class="text-[11px] text-slate-500 font-normal italic mt-0.5 max-w-xs truncate" title={turno.descripcion}>
                        "{turno.descripcion}"
                      </span>
                    {/if}
                  </div>
                </td>
                <td class="p-4 text-center font-bold text-slate-700">
                  <span class="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold">
                    {turno.porcionesVendidas ?? 0} porc.
                  </span>
                </td>
                <td class="p-4 text-center">
                  {#if (turno.porcionesMermadas ?? 0) > 0}
                    <span class="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-xs font-bold">
                      🔥 {turno.porcionesMermadas}
                    </span>
                  {:else}
                    <span class="text-xs text-slate-300">-</span>
                  {/if}
                </td>
                <td class="p-4 text-right font-semibold text-slate-700">
                  ${Number(turno.monto).toLocaleString('es-CO')}
                </td>
                <td class="p-4 text-right font-semibold text-purple-700">
                  ${Number(turno.transferencias || 0).toLocaleString('es-CO')}
                </td>
                <td class="p-4 text-right font-semibold text-amber-700">
                  {#if turno.totalGastos > 0}
                    -${turno.totalGastos.toLocaleString('es-CO')}
                  {:else}
                    <span class="text-xs text-slate-300">$0</span>
                  {/if}
                </td>
                <td class="p-4 text-right pr-6 font-black text-slate-900">
                  ${(Number(turno.monto) + Number(turno.transferencias || 0) + (turno.totalGastos || 0)).toLocaleString('es-CO')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
