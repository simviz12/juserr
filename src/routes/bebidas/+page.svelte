<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  let isEntradaModalOpen = $state(false);
  
  let formId = $state('');
  let formNombre = $state('');
  let formPrecio = $state('');
  let formStockActual = $state('0');

  // Estado para registrar entrada de mercancía (bebidas)
  let entradaBebidaId = $state(data.bebidas[0]?.id || '');
  let entradaCantidad = $state('');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    formPrecio = '';
    formStockActual = '0';
    isModalOpen = true;
  }

  function openEntradaModal(bebidaId?: number) {
    if (bebidaId) {
      entradaBebidaId = bebidaId;
    } else if (data.bebidas.length > 0) {
      entradaBebidaId = data.bebidas[0].id;
    }
    entradaCantidad = '';
    isEntradaModalOpen = true;
  }

  function openEditModal(bebida: any) {
    editMode = true;
    formId = bebida.id;
    formNombre = bebida.nombre;
    formPrecio = bebida.precio;
    formStockActual = bebida.stockActual.toString();
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
    isEntradaModalOpen = false;
  }
</script>

<div class="max-w-6xl mx-auto space-y-6">
  <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
    <div>
      <h1 class="text-3xl font-black text-slate-900 tracking-tight">Catálogo e Inventario de Bebidas</h1>
      <p class="text-slate-500 text-sm mt-1">Registra la llegada de bebidas refrigeradas y administra precios.</p>
    </div>
    <div class="flex items-center gap-2">
      <button 
        onclick={() => openEntradaModal()}
        class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 text-sm cursor-pointer"
      >
        <span>📥</span> Registrar Entrada de Bebidas
      </button>
      <button 
        onclick={openCreateModal}
        class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all text-sm cursor-pointer"
      >
        + Nueva Bebida
      </button>
    </div>
  </div>

  {#if form?.error}
    <div class="bg-red-100 text-red-700 p-4 rounded-2xl mb-4 shadow-sm font-semibold text-sm">
      {form.error}
    </div>
  {/if}

  {#if form?.success}
    <div class="bg-emerald-100 text-emerald-800 p-4 rounded-2xl mb-4 shadow-sm font-semibold text-sm">
      {form.message}
    </div>
  {/if}

  <!-- Mobile View (Cards) -->
  <div class="grid grid-cols-1 gap-4 md:hidden">
    {#each data.bebidas as bebida}
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
        <div class="flex justify-between items-start">
          <h3 class="font-bold text-lg text-slate-800">{bebida.nombre}</h3>
          <span class="font-bold text-emerald-600">${bebida.precio}</span>
        </div>
        <div class="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg inline-block self-start">
          Stock actual: <span class="font-bold {(bebida.stockActual ?? 0) > 0 ? 'text-slate-800' : 'text-red-500'}">{bebida.stockActual ?? 0}</span>
        </div>
        <div class="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
          <button 
            onclick={() => openEditModal(bebida)}
            class="text-blue-500 hover:text-blue-700 font-medium px-3 py-1 bg-blue-50 rounded-lg text-sm"
          >
            Editar
          </button>
          <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar bebida?') && e.preventDefault()}>
            <input type="hidden" name="id" value={bebida.id} />
            <button type="submit" class="text-red-500 hover:text-red-700 font-medium px-3 py-1 bg-red-50 rounded-lg text-sm">
              Eliminar
            </button>
          </form>
        </div>
      </div>
    {:else}
      <p class="text-center text-slate-500 py-8">No hay bebidas registradas.</p>
    {/each}
  </div>

  <!-- Desktop View (Table) -->
  <div class="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
          <th class="p-4 font-medium">Nombre</th>
          <th class="p-4 font-medium">Precio</th>
          <th class="p-4 font-medium">Stock Actual</th>
          <th class="p-4 font-medium text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.bebidas as bebida}
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-medium text-slate-800">{bebida.nombre}</td>
            <td class="p-4 text-emerald-600 font-medium">${bebida.precio}</td>
            <td class="p-4">
              <span class="px-3 py-1 rounded-full text-sm font-medium {(bebida.stockActual ?? 0) > 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}">
                {bebida.stockActual ?? 0} unidades
              </span>
            </td>
            <td class="p-4 flex justify-end gap-2">
              <button 
                onclick={() => openEntradaModal(bebida.id)}
                class="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold cursor-pointer"
                title="Ingresar botellas recibidas a este refrigerador"
              >
                + Ingresar Stock
              </button>
              <button 
                onclick={() => openEditModal(bebida)}
                class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold cursor-pointer"
              >
                Editar
              </button>
              <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar bebida?') && e.preventDefault()}>
                <input type="hidden" name="id" value={bebida.id} />
                <button type="submit" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold cursor-pointer">
                  Eliminar
                </button>
              </form>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="4" class="p-8 text-center text-slate-500">
              No hay bebidas registradas. Haz clic en "Nueva Bebida".
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Historial de Movimientos de Bebidas (Entradas y Ventas) -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <div class="p-6 border-b border-slate-100">
      <h2 class="text-lg font-black text-slate-900">Historial de Entradas y Salidas de Bebidas</h2>
      <p class="text-xs text-slate-400 mt-0.5">Registro de cada reposición de botellas al refrigerador y ventas realizadas.</p>
    </div>

    <div class="overflow-x-auto">
      {#if !data.historialBebidas || data.historialBebidas.length === 0}
        <div class="p-8 text-center text-slate-400 text-sm">
          No hay movimientos de bebidas registrados aún. Haz clic en <strong>"Registrar Entrada de Bebidas"</strong> para anotar las botellas recibidas.
        </div>
      {:else}
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-extrabold border-b border-slate-100">
              <th class="p-4 pl-6">Fecha y Hora</th>
              <th class="p-4">Tipo</th>
              <th class="p-4">Bebida</th>
              <th class="p-4 text-right pr-6">Cantidad</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each data.historialBebidas as mov}
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="p-4 pl-6 font-bold text-slate-700 text-xs">
                  {mov.fecha ? new Date(mov.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                </td>
                <td class="p-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold {mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}">
                    {mov.tipo === 'entrada' ? 'Entrada / Reposición' : 'Venta Registrada'}
                  </span>
                </td>
                <td class="p-4 font-bold text-slate-800">
                  {mov.bebidaNombre}
                </td>
                <td class="p-4 text-right pr-6 font-black {mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-slate-700'}">
                  {mov.tipo === 'entrada' ? `+${mov.cantidad}` : `-${mov.cantidad}`} unid.
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

<!-- Modal Entrada de Bebidas (Sumar stock) -->
{#if isEntradaModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 bg-emerald-600 text-white flex justify-between items-center">
        <h2 class="text-lg font-black flex items-center gap-2">
          <span>📥</span> Anotar Entrada de Bebidas
        </h2>
        <button onclick={closeModal} class="text-white/80 hover:text-white text-2xl font-bold cursor-pointer">&times;</button>
      </div>

      <form action="?/registrarEntrada" method="POST" use:enhance={() => {
        return async ({ update }) => {
          await update();
          closeModal();
        };
      }} class="p-6 space-y-4">
        <div>
          <label for="modal_bebida" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Bebida Recibida</label>
          <select 
            id="modal_bebida" 
            name="bebidaId" 
            bind:value={entradaBebidaId}
            required
            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
          >
            {#each data.bebidas as b}
              <option value={b.id}>{b.nombre} (Stock actual: {b.stockActual ?? 0})</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="modal_cant" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">¿Cuántas botellas/unidades entraron?</label>
          <input 
            type="number" 
            id="modal_cant" 
            name="cantidad" 
            bind:value={entradaCantidad} 
            min="1" 
            required 
            placeholder="Ej: 12, 24, 30"
            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-black text-slate-900 text-lg" 
          />
        </div>

        <div class="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <button type="button" onclick={closeModal} class="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm cursor-pointer">
            Cancelar
          </button>
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow transition-all cursor-pointer">
            Sumar a Stock
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal CRUD Crear/Editar -->
{#if isModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          {editMode ? 'Editar Bebida' : 'Nueva Bebida'}
        </h2>
        <button onclick={closeModal} class="text-slate-400 hover:text-slate-600 text-2xl cursor-pointer">&times;</button>
      </div>
      
      <form action={editMode ? '?/update' : '?/create'} method="POST" use:enhance={() => {
        return async ({ update }) => {
          await update();
          closeModal();
        };
      }} class="p-6 space-y-4">
        
        {#if editMode}
          <input type="hidden" name="id" value={formId} />
        {/if}

        <div>
          <label for="form_nombre" class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
          <input type="text" id="form_nombre" name="nombre" bind:value={formNombre} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Coca Cola 400ml" />
        </div>

        <div>
          <label for="form_precio" class="block text-sm font-medium text-slate-700 mb-1">Precio de Venta</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-400">$</span>
            <input type="number" id="form_precio" step="100" name="precio" bind:value={formPrecio} required class="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div>
          <label for="form_stock" class="block text-sm font-medium text-slate-700 mb-1">Stock Inicial/Actual</label>
          <input type="number" id="form_stock" name="stockActual" bind:value={formStockActual} class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button type="button" onclick={closeModal} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer">
            Cancelar
          </button>
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm cursor-pointer">
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
