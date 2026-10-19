<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<div class="flex items-center justify-center min-h-screen bg-slate-50">
  <div class="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
    <div class="text-center mb-8 flex flex-col items-center">
      <div class="w-16 h-16 bg-gradient-to-br from-orange-500 via-amber-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/25 text-white mb-3 text-3xl">
        🍢
      </div>
      <h1 class="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-amber-600 to-red-600">
        ChuzoOS
      </h1>
      <span class="text-xs font-black uppercase tracking-widest text-orange-600">GastroFlow Pro · Pasto</span>
      <p class="text-slate-500 mt-2 text-sm">Control Operativo, Auditoría Anti-Robo e Inventario</p>
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
        <label for="password" class="block text-sm font-bold text-slate-700 mb-2">Contraseña</label>
        <input 
          id="password" 
          name="password" 
          type="password" 
          required 
          class="w-full px-5 py-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all text-base"
          placeholder="••••••••"
        />
      </div>

      <button 
        type="submit" 
        class="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl text-lg cursor-pointer transform active:scale-98"
      >
        Ingresar al Sistema
      </button>
    </form>
    
    <div class="mt-6 text-center text-xs text-slate-400">
      Credenciales por defecto: Gabo / password123
    </div>
  </div>
</div>
