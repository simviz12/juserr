<script lang="ts">
  import { enhance } from '$app/forms';
  import { displayStock } from '$lib/utils/fractions';
  let { data, form } = $props();

  let isEditModalOpen = $state(false);
  let editMovId = $state(0);
  let editCantidad = $state('');
  let editTipo = $state('');

  function openEditModal(mov: any) {
    editMovId = mov.id;
    editCantidad = mov.cantidad.toString();
    editTipo = mov.tipo;
    isEditModalOpen = true;
  }

  function closeEditModal() {
    isEditModalOpen = false;
  }

  function formatDateTime(dateStr: string | null) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return {
          date: d.toLocaleDateString('es-CO'),
          time: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="mb-6">
    <a href="/inventory" class="text-slate-500 hover:text-orange-500 text-sm font-medium mb-4 inline-block transition-colors">
      ← Volver al Inventario
    </a>
    <h1 class="text-2xl font-bold text-slate-800">
      Historial: <span class="text-orange-500">{data.producto.nombre}</span>
    </h1>
    <p class="text-slate-500 mt-1">
      Stock actual: <span class="font-bold text-slate-700">{displayStock(data.producto.stockActual, data.producto.unidadMedida)} {data.producto.unidadMedida}s</span>
    </p>
  </div>

  {#if form?.success}
    <div class="bg-green-100 text-green-800 p-4 rounded-xl mb-6 shadow-sm border border-green-200">
      <span class="font-bold">¡Éxito!</span> {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-100 text-red-800 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      <span class="font-bold">Error:</span> {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    {#if data.movimientos.length === 0}
      <div class="p-8 text-center text-slate-500">
        No hay movimientos registrados para este producto.
      </div>
    {:else}
      <div class="divide-y divide-slate-100">
        {#each data.movimientos as mov}
          {@const dt = formatDateTime(mov.fecha)}
          <div class="p-4 sm:p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors">
            <!-- Icono -->
            <div class="mt-1 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center {mov.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
              {#if mov.tipo === 'entrada'}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
              {/if}
            </div>
            
            <!-- Contenido -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900">
                {mov.tipo === 'entrada' ? 'Entrada al inventario' : 'Salida del inventario'}
              </p>
              <p class="text-sm text-slate-500 mt-0.5">
                Por <span class="font-medium text-slate-700">{mov.usuarioNombre || 'Usuario desconocido'}</span>
              </p>
              <p class="text-xs text-slate-400 mt-1">
                {dt.date} a las {dt.time}
              </p>
            </div>
            
            <!-- Cantidad -->
            <div class="text-right flex-shrink-0">
              <p class="text-lg font-bold {mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}">
                {mov.tipo === 'entrada' ? '+' : '-'}{displayStock(mov.cantidad, data.producto.unidadMedida)}
              </p>
              <p class="text-xs text-slate-500 capitalize">{data.producto.unidadMedida}s</p>
            </div>
            <!-- Acciones (Editar/Eliminar) -->
            <div class="ml-4 flex items-center gap-2 border-l border-slate-200 pl-4">
              <button 
                onclick={() => openEditModal(mov)}
                class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors text-sm"
                title="Editar cantidad"
              >
                ✏️
              </button>
              <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm('¿Estás seguro de eliminar este movimiento? El stock será recalculado.') && e.preventDefault()}>
                <input type="hidden" name="movId" value={mov.id} />
                <button 
                  type="submit"
                  class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors text-sm"
                  title="Eliminar movimiento"
                >
                  🗑️
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal de Edición -->
{#if isEditModalOpen}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">
          Editar Cantidad ({editTipo})
        </h2>
        <button onclick={closeEditModal} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
      </div>
      
      <form action="?/update" method="POST" use:enhance={() => {
        return async ({ update }) => {
          await update();
          closeEditModal();
        };
      }} class="p-6 space-y-4">
        
        <input type="hidden" name="movId" value={editMovId} />

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Nueva cantidad</label>
          <div class="relative">
            <input 
              type="number" 
              step="0.01"
              min="0.01"
              name="cantidad" 
              bind:value={editCantidad} 
              required 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
            />
            <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span class="text-slate-400 capitalize">{data.producto.unidadMedida}s</span>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-2">El stock principal del producto se recalculará de forma automática tras esta edición.</p>
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button type="button" onclick={closeEditModal} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium">
            Cancelar
          </button>
          <button type="submit" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium shadow-sm">
            Actualizar y Recalcular
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
