<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let isModalOpen = $state(false);
  let editMode = $state(false);
  
  let formId = $state('');
  let formNombre = $state('');
  let formRol = $state('cajero');
  let formPassword = $state('');

  function openCreateModal() {
    editMode = false;
    formId = '';
    formNombre = '';
    formRol = 'cajero';
    formPassword = '';
    isModalOpen = true;
  }

  function openEditModal(user: any) {
    editMode = true;
    formId = user.id;
    formNombre = user.nombre;
    formRol = user.rol;
    formPassword = ''; // Blank so they don't have to change it
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }

  function getRoleBadge(rol: string) {
    switch(rol) {
      case 'jefe': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'bodeguero': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cajero': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  }
</script>

<div class="max-w-5xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Gestión de Personal</h1>
      <p class="text-slate-500 text-sm mt-1">Crea y administra las cuentas de tus trabajadores</p>
    </div>
    <button 
      onclick={openCreateModal}
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2"
    >
      <span>+</span> Nuevo Usuario
    </button>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-700 p-4 rounded-xl mb-6 shadow-sm border border-red-200">
      {form.error}
    </div>
  {/if}

  <div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
            <th class="p-4 font-medium">Nombre de Usuario</th>
            <th class="p-4 font-medium">Rol Asignado</th>
            <th class="p-4 font-medium">Fecha Creación</th>
            <th class="p-4 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each data.personal as user}
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="p-4">
                <span class="block font-bold text-slate-800">{user.nombre}</span>
              </td>
              <td class="p-4">
                <span class="px-3 py-1 rounded-full text-xs font-bold border {getRoleBadge(user.rol)} uppercase tracking-wider">
                  {user.rol}
                </span>
              </td>
              <td class="p-4 text-sm text-slate-500">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td class="p-4 flex justify-end gap-2">
                <button 
                  onclick={() => openEditModal(user)}
                  class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                >
                  Editar
                </button>
                <form action="?/delete" method="POST" use:enhance onsubmit={(e) => !confirm(`¿Eliminar al usuario ${user.nombre}?`) && e.preventDefault()}>
                  <input type="hidden" name="id" value={user.id} />
                  <button 
                    type="submit"
                    class="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                  >
                    Eliminar
                  </button>
                </form>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="4" class="p-8 text-center text-slate-500">
                No hay usuarios registrados. Crea uno nuevo.
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
          {editMode ? 'Editar Usuario' : 'Nuevo Usuario'}
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
          <label class="block text-sm font-medium text-slate-700 mb-1">Nombre (Usuario)</label>
          <input type="text" name="nombre" bind:value={formNombre} required class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="Ej: Juan Perez" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Rol</label>
          <select name="rol" bind:value={formRol} class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow bg-white">
            <option value="cajero">Cajero (Mostrador, Ventas, Cierre)</option>
            <option value="bodeguero">Bodeguero (Nevera, Compras, Insumos)</option>
            <option value="jefe">Jefe (Acceso Total)</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Contraseña {editMode ? '(Opcional: Dejar en blanco para no cambiarla)' : ''}
          </label>
          <input 
            type="password" 
            name="password" 
            bind:value={formPassword} 
            required={!editMode} 
            class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
            placeholder="*********" 
          />
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button type="button" onclick={closeModal} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium">
            Cancelar
          </button>
          <button type="submit" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold shadow-sm">
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
