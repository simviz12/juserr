<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  
  let formId = $state('');
  let formNombre = $state('');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    isModalOpen = true;
  }

  function openEditModal(cat: any) {
    editMode = true;
    formId = cat.id;
    formNombre = cat.nombre;
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Categorías de Inventario</h1>
    <button 
      onclick={openCreateModal}
      class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors"
    >
      + Nueva Categoría
    </button>
  </div>

  {#if form?.error}
    <div class="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
      {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
          <th class="p-4 font-medium">Nombre de la Categoría</th>
          <th class="p-4 font-medium text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.categorias as cat}
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-bold text-slate-800">{cat.nombre}</td>
            <td class="p-4 flex justify-end gap-2">
              <button 
                onclick={() => openEditModal(cat)}
                class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors text-sm"
              >
                Editar
              </button>
              <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar categoría?') && e.preventDefault()}>
                <input type="hidden" name="id" value={cat.id} />
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
            <td colspan="2" class="p-8 text-center text-slate-500">
              No hay categorías registradas. Haz clic en "Nueva Categoría".
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

{#if isModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          {editMode ? 'Editar Categoría' : 'Nueva Categoría'}
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
          <input type="text" name="nombre" bind:value={formNombre} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Ej. Lácteos" />
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
