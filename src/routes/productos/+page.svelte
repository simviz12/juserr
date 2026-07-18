<script lang="ts">
  import { enhance } from '$app/forms';
  import { displayStock } from '$lib/utils/fractions';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  
  // Datos del formulario
  let formId = $state('');
  let formNombre = $state('');
  let formCategoriaId = $state('');
  let formUnidadMedida = $state('unidad');
  let formPrecio = $state('0');
  let formStockMinimo = $state('5');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    formCategoriaId = '';
    formUnidadMedida = 'unidad';
    formPrecio = '0';
    formStockMinimo = '5';
    isModalOpen = true;
  }

  function openEditModal(prod: any) {
    editMode = true;
    formId = prod.id;
    formNombre = prod.nombre;
    formCategoriaId = prod.categoriaId;
    formUnidadMedida = prod.unidadMedida;
    formPrecio = prod.precio;
    formStockMinimo = prod.stockMinimo || '5';
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }
</script>

<div class="max-w-6xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Catálogo de Productos</h1>
    <button 
      onclick={openCreateModal}
      class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors"
    >
      + Nuevo Producto
    </button>
  </div>

  {#if form?.error}
    <div class="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
      {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
            <th class="p-4 font-medium">Nombre</th>
            <th class="p-4 font-medium">Categoría</th>
            <th class="p-4 font-medium">Tipo Conteo</th>
            <th class="p-4 font-medium">Precio</th>
            <th class="p-4 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.products as prod}
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="p-4 font-medium text-slate-800">{prod.nombre}</td>
              <td class="p-4 text-slate-600">
                <span class="inline-block px-2 py-1 bg-slate-100 rounded-md text-xs">{prod.categoriaNombre}</span>
              </td>
              <td class="p-4 text-slate-600 capitalize">{prod.unidadMedida}</td>
              <td class="p-4 text-slate-600">${prod.precio}</td>
              <td class="p-4 flex justify-end gap-2">
                <button 
                  onclick={() => openEditModal(prod)}
                  class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors text-sm"
                >
                  Editar
                </button>
                <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar producto?') && e.preventDefault()}>
                  <input type="hidden" name="id" value={prod.id} />
                  <button 
                    type="submit"
                    class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition-colors text-sm"
                  >
                    Eliminar
                  </button>
                </form>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="5" class="p-8 text-center text-slate-500">
                No hay productos registrados. Haz clic en "Nuevo Producto".
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if isModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          {editMode ? 'Editar Producto' : 'Nuevo Producto'}
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
          <label class="block text-sm font-medium text-slate-700 mb-1">Nombre del producto</label>
          <input type="text" name="nombre" bind:value={formNombre} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
          <select name="categoriaId" bind:value={formCategoriaId} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white">
            <option value="" disabled>Selecciona una categoría...</option>
            {#each data.categorias as cat}
              <option value={cat.id}>{cat.nombre}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Tipo de conteo (Unidad de Medida)</label>
          <select name="unidadMedida" bind:value={formUnidadMedida} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white">
            <option value="unidad">Unidad (ej: Lata, Botella)</option>
            <option value="fraccion">Fracción (ej: 1/4, 1/2, Kilos)</option>
            <option value="pechuga">Pechuga</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo (Alerta en rojo)</label>
          <input type="number" step="0.1" name="stockMinimo" bind:value={formStockMinimo} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Precio Unitario (Opcional)</label>
          <input type="number" step="0.01" name="precio" bind:value={formPrecio} class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button type="button" onclick={closeModal} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium">
            Cancelar
          </button>
          <button type="submit" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium shadow-sm">
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
