<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  
  let formId = $state('');
  let formNombre = $state('');
  let formPrecioPorcion = $state('');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    formPrecioPorcion = '';
    isModalOpen = true;
  }

  function openEditModal(sabor: any) {
    editMode = true;
    formId = sabor.id;
    formNombre = sabor.nombre;
    formPrecioPorcion = sabor.precioPorcion;
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Catálogo de Sabores</h1>
      <p class="text-slate-500 text-sm mt-1">Agrega y administra los sabores de pizza disponibles (Solo Jefe).</p>
    </div>
    <button 
      onclick={openCreateModal}
      class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors"
    >
      + Nuevo Sabor
    </button>
  </div>

  {#if form?.success && form?.message}
    <div class="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 border border-emerald-200">
      {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-4 rounded-xl mb-6 border border-red-200">
      {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
          <th class="p-4 font-medium">Sabor</th>
          <th class="p-4 font-medium text-right">Precio/Porción</th>
          <th class="p-4 font-medium text-center">Estado</th>
          <th class="p-4 font-medium text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each data.sabores as sabor}
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-bold text-slate-700">{sabor.nombre}</td>
            <td class="p-4 text-right font-bold text-emerald-600">${Number(sabor.precioPorcion).toFixed(2)}</td>
            <td class="p-4 text-center">
              <form action="?/toggle" method="POST" use:enhance class="inline">
                <input type="hidden" name="id" value={sabor.id} />
                <input type="hidden" name="activo" value={sabor.activo} />
                <button type="submit" class="px-2 py-1 text-xs font-bold rounded-full transition-colors hover:opacity-80 {sabor.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                  {sabor.activo ? 'Activo (Click para Desactivar)' : 'Inactivo (Click para Activar)'}
                </button>
              </form>
            </td>
            <td class="p-4 flex justify-end gap-2">
              <button 
                onclick={() => openEditModal(sabor)}
                class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                Editar
              </button>
              <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Eliminar sabor de forma permanente?') && e.preventDefault()}>
                <input type="hidden" name="id" value={sabor.id} />
                <button type="submit" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium">
                  Eliminar
                </button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

{#if isModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          {editMode ? 'Editar Sabor' : 'Nuevo Sabor'}
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
          <label class="block text-sm font-medium text-slate-700 mb-1">Nombre del Sabor</label>
          <input type="text" name="nombre" bind:value={formNombre} required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Ej: Hawaiana Especial" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Precio por Porción</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-400">$</span>
            <input type="number" step="0.01" name="precioPorcion" bind:value={formPrecioPorcion} required class="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
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
