<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<div class="flex items-center justify-center min-h-screen bg-slate-50">
  <div class="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
    <div class="text-center mb-8 flex flex-col items-center">
      <img src="/logo.png" alt="JuanchoPizza Logo" class="h-20 w-auto mb-4 rounded-2xl shadow-md" />
      <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
        JuanchoPizza
      </h1>
      <p class="text-slate-500 mt-2">Inicia sesión para continuar</p>
    </div>

    {#if form?.message}
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
        {form.message}
      </div>
    {/if}

    <form method="POST" use:enhance class="space-y-6">
      <div>
        <label for="username" class="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
        <input 
          id="username" 
          name="username" 
          type="text" 
          required 
          class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
          placeholder="Ej: Gabo"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
        <input 
          id="password" 
          name="password" 
          type="password" 
          required 
          class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
          placeholder="••••••••"
        />
      </div>

      <button 
        type="submit" 
        class="w-full py-3 px-4 bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold rounded-lg hover:from-orange-500 hover:to-red-600 transition-all shadow-md hover:shadow-lg"
      >
        Ingresar
      </button>
    </form>
    
    <div class="mt-6 text-center text-xs text-slate-400">
      Credenciales por defecto: Gabo / password123
    </div>
  </div>
</div>
