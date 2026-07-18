<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  
  let formId = $state('');
  let formNombre = $state('');
  let formPrecio = $state('');
  let formStockActual = $state('0');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    formPrecio = '';
    formStockActual = '0';
    isModalOpen = true;
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
  }
</script>

<div class="max-w-6xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Catálogo de Bebidas</h1>
      <p class="text-slate-500 text-sm mt-1">Gestiona precios y stock inicial</p>
    </div>
    <button 
      onclick={openCreateModal}
      class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors"
    >
      + Nueva Bebida
    </button>
  </div>

  {#if form?.error}
    <div class="bg-red-100 text-red-700 p-4 rounded-lg mb-4 shadow-sm">
      {form.error}
    </div>
  {/if}

  {#if form?.success}
    <div class="bg-green-100 text-green-700 p-4 rounded-lg mb-4 shadow-sm">
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
          Stock actual: <span class="font-bold {bebida.stockActual > 0 ? 'text-slate-800' : 'text-red-500'}">{bebida.stockActual}</span>
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
              <span class="px-3 py-1 rounded-full text-sm font-medium {bebida.stockActual > 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}">
                {bebida.stockActual} unidades
              </span>
            </td>
            <td class="p-4 flex justify-end gap-2">
              <button 
                onclick={() => openEditModal(bebida)}
                class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                Editar
              </button>
              <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar bebida?') && e.preventDefault()}>
                <input type="hidden" name="id" value={bebida.id} />
                <button type="submit" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium">
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
</div>

<!-- Modal CRUD -->
{#if isModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          {editMode ? 'Editar Bebida' : 'Nueva Bebida'}
        </h2>
        <button onclick={closeModal} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
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
          <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
          <input type="text" name="nombre" bind:value={formNombre} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Coca Cola 400ml" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Precio</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-400">$</span>
            <input type="number" step="0.01" name="precio" bind:value={formPrecio} required class="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Stock Inicial/Actual</label>
          <input type="number" name="stockActual" bind:value={formStockActual} class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button type="button" onclick={closeModal} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium">
            Cancelar
          </button>
          <button type="submit" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-sm">
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
