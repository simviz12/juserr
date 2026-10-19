<script lang="ts">
  import { enhance } from '$app/forms';
  import { 
    UtensilsCrossed, 
    Pizza, 
    Flame, 
    Layers, 
    Beef, 
    CheckCircle2, 
    AlertTriangle, 
    Store,
    Plus,
    Save,
    Sparkles,
    SlidersHorizontal
  } from '@lucide/svelte';

  let { data, form } = $props();

  let nombreNegocio = $state(data.config?.nombreNegocio || 'ChuzoOS Gourmet Pasto');
  let rubroPrincipal = $state(data.config?.rubroPrincipal || 'mixto');
  let habilitarPizzas = $state(data.config?.habilitarPizzas ?? true);
  let habilitarChuzos = $state(data.config?.habilitarChuzos ?? true);
  let habilitarHamburguesas = $state(data.config?.habilitarHamburguesas ?? true);
  let habilitarLasanas = $state(data.config?.habilitarLasanas ?? true);
  let habilitarCarnes = $state(data.config?.habilitarCarnes ?? true);

  // Estados para modal de nuevo ítem
  let showModalItem = $state(false);
  let modalLineaId = $state(data.lineas[0]?.id || 1);
  let modalNombre = $state('');
  let modalPrecioVenta = $state('');
  let modalPrecioCosto = $state('');

  function openItemModal(lineaId: number) {
    modalLineaId = lineaId;
    modalNombre = '';
    modalPrecioVenta = '';
    modalPrecioCosto = '';
    showModalItem = true;
  }
</script>

<div class="max-w-6xl mx-auto space-y-8">
  <!-- Cabecera de Página -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-black mb-2">
        <Sparkles size={14} /> ChuzoOS / GastroFlow Multi-Rubro Engine
      </div>
      <h1 class="text-3xl font-black text-slate-900 tracking-tight">Arquitectura Multi-Rubro y Entrelazado</h1>
      <p class="text-slate-500 font-medium mt-1">
        Personaliza y activa las líneas gastronómicas que vende tu negocio: Chuzos, Asaderos, Hamburguesas, Lasañas o Pizzerías combinadas.
      </p>
    </div>
  </div>

  {#if form?.success}
    <div class="bg-emerald-50 text-emerald-800 p-5 rounded-2xl shadow-sm border border-emerald-200 flex items-center gap-3">
      <CheckCircle2 size={24} class="text-emerald-600 shrink-0" />
      <div>
        <span class="font-bold block">Configuración Actualizada</span>
        <span class="text-sm">{form.message}</span>
      </div>
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-5 rounded-2xl shadow-sm border border-red-200 flex items-center gap-3">
      <AlertTriangle size={24} class="text-red-600 shrink-0" />
      <div>
        <span class="font-bold block">Error</span>
        <span class="text-sm">{form.error}</span>
      </div>
    </div>
  {/if}

  <!-- Formulario de Configuración Principal -->
  <form action="?/actualizarRubros" method="POST" use:enhance class="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 space-y-8">
    <div class="border-b border-slate-100 pb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
          <Store size={24} />
        </span>
        <div>
          <h2 class="text-xl font-black text-slate-800">Identidad del Negocio</h2>
          <p class="text-xs text-slate-400">Define cómo se presenta tu establecimiento en tickets, turnos y arqueos.</p>
        </div>
      </div>
      <button 
        type="submit" 
        class="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
      >
        <Save size={18} /> Guardar Ajustes
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label for="nombre_negocio" class="block text-sm font-black text-slate-700 mb-2">Nombre Comercial del Negocio</label>
        <input 
          type="text" 
          id="nombre_negocio" 
          name="nombre_negocio" 
          bind:value={nombreNegocio}
          required
          placeholder="Ej: ChuzoBurgers & Pizza Pasto"
          class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-800"
        />
      </div>

      <div>
        <label for="rubro_principal" class="block text-sm font-black text-slate-700 mb-2">Modelo Operativo Principal</label>
        <select 
          id="rubro_principal" 
          name="rubro_principal" 
          bind:value={rubroPrincipal}
          class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-800 cursor-pointer"
        >
          <option value="mixto">🌟 Negocio Mixto / Combinado (Híbrido)</option>
          <option value="chuzos">🍢 Especialidad: Chuzos, Asaderos y Parrilla</option>
          <option value="hamburguesas">🍔 Especialidad: Hamburguesería & Comidas Rápidas</option>
          <option value="pizzas">🍕 Especialidad: Pizzería Artesanal</option>
          <option value="lasanas">🍝 Especialidad: Lasañas & Pastas al Horno</option>
          <option value="carnes">🥩 Especialidad: Asadero de Carnes & Cortes</option>
        </select>
      </div>
    </div>

    <!-- Switch de Rubros Activos Entrelazados -->
    <div>
      <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
        <SlidersHorizontal size={16} /> Activar / Entrelazar Líneas de Producción
      </h3>
      <p class="text-xs text-slate-500 mb-4">Marca las categorías que vende tu cocina. El sistema unificará el inventario cruzado y las alertas:</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Chuzos -->
        <label class="p-5 border-2 rounded-2xl cursor-pointer transition-all flex items-start gap-4 {habilitarChuzos ? 'border-orange-500 bg-orange-50/40 shadow-xs' : 'border-slate-100 bg-slate-50/50 opacity-70'}">
          <input type="checkbox" name="habilitar_chuzos" bind:checked={habilitarChuzos} class="w-5 h-5 accent-orange-600 rounded mt-1" />
          <div class="flex-1">
            <span class="text-2xl block mb-1">🍢</span>
            <span class="font-black text-slate-800 block text-base">Parrilla & Chuzos</span>
            <span class="text-xs text-slate-500">Pinchos ensartados, carbón, tocineta y pechugas.</span>
          </div>
        </label>

        <!-- Hamburguesas -->
        <label class="p-5 border-2 rounded-2xl cursor-pointer transition-all flex items-start gap-4 {habilitarHamburguesas ? 'border-amber-500 bg-amber-50/40 shadow-xs' : 'border-slate-100 bg-slate-50/50 opacity-70'}">
          <input type="checkbox" name="habilitar_hamburguesas" bind:checked={habilitarHamburguesas} class="w-5 h-5 accent-amber-600 rounded mt-1" />
          <div class="flex-1">
            <span class="text-2xl block mb-1">🍔</span>
            <span class="font-black text-slate-800 block text-base">Hamburguesas & Combos</span>
            <span class="text-xs text-slate-500">Pan artesanal, tortas de carne, papas a la francesa.</span>
          </div>
        </label>

        <!-- Pizzas -->
        <label class="p-5 border-2 rounded-2xl cursor-pointer transition-all flex items-start gap-4 {habilitarPizzas ? 'border-red-500 bg-red-50/40 shadow-xs' : 'border-slate-100 bg-slate-50/50 opacity-70'}">
          <input type="checkbox" name="habilitar_pizzas" bind:checked={habilitarPizzas} class="w-5 h-5 accent-red-600 rounded mt-1" />
          <div class="flex-1">
            <span class="text-2xl block mb-1">🍕</span>
            <span class="font-black text-slate-800 block text-base">Pizzas & Ruedas</span>
            <span class="text-xs text-slate-500">Bolas de masa cruda, porciones horneadas y vitrina.</span>
          </div>
        </label>

        <!-- Lasañas -->
        <label class="p-5 border-2 rounded-2xl cursor-pointer transition-all flex items-start gap-4 {habilitarLasanas ? 'border-purple-500 bg-purple-50/40 shadow-xs' : 'border-slate-100 bg-slate-50/50 opacity-70'}">
          <input type="checkbox" name="habilitar_lasanas" bind:checked={habilitarLasanas} class="w-5 h-5 accent-purple-600 rounded mt-1" />
          <div class="flex-1">
            <span class="text-2xl block mb-1">🍝</span>
            <span class="font-black text-slate-800 block text-base">Lasañas al Horno</span>
            <span class="text-xs text-slate-500">Bandejas familiares, porciones individuales y pasta.</span>
          </div>
        </label>

        <!-- Cortes y Asados -->
        <label class="p-5 border-2 rounded-2xl cursor-pointer transition-all flex items-start gap-4 {habilitarCarnes ? 'border-rose-500 bg-rose-50/40 shadow-xs' : 'border-slate-100 bg-slate-50/50 opacity-70'}">
          <input type="checkbox" name="habilitar_carnes" bind:checked={habilitarCarnes} class="w-5 h-5 accent-rose-600 rounded mt-1" />
          <div class="flex-1">
            <span class="text-2xl block mb-1">🥩</span>
            <span class="font-black text-slate-800 block text-base">Asados & Carnes en Kilos</span>
            <span class="text-xs text-slate-500">Lomos, costillas, pulpa por peso y mermas por asado.</span>
          </div>
        </label>
      </div>
    </div>
  </form>

  <!-- Catálogo de Líneas y Productos Entrelazados -->
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-black text-slate-900 tracking-tight">Catálogo de Productos por Línea</h2>
        <p class="text-xs text-slate-500">Administra los precios de venta al público y los costos de insumo por producto.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.lineas as linea}
        {@const itemsDeLinea = data.items.filter(i => i.lineaId === linea.id)}
        <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2.5">
                <span class="p-2 bg-orange-50 text-orange-600 rounded-xl font-bold">
                  {#if linea.codigo === 'chuzo'}🍢{:else if linea.codigo === 'burger'}🍔{:else if linea.codigo === 'pizza'}🍕{:else if linea.codigo === 'lasana'}🍝{:else}🥩{/if}
                </span>
                <div>
                  <h3 class="font-black text-slate-800 text-base">{linea.nombre}</h3>
                  <span class="text-[11px] font-bold text-slate-400 uppercase">Unidad: {linea.unidadPorcion}</span>
                </div>
              </div>
              <button 
                type="button" 
                onclick={() => openItemModal(linea.id)}
                class="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl font-black transition-colors cursor-pointer"
                title="Añadir plato a esta línea"
              >
                <Plus size={18} />
              </button>
            </div>

            <!-- Listado de ítems -->
            {#if itemsDeLinea.length === 0}
              <div class="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                No hay productos registrados en esta línea. Haz clic en <strong>+</strong> para añadir el primero.
              </div>
            {:else}
              <div class="space-y-2">
                {#each itemsDeLinea as item}
                  <div class="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p class="text-sm font-bold text-slate-800">{item.nombre}</p>
                      <p class="text-[11px] text-slate-400">Costo aprox: ${Number(item.precioCosto || 0).toLocaleString('es-CO')}</p>
                    </div>
                    <span class="font-black text-orange-600 text-sm">
                      ${Number(item.precioVenta).toLocaleString('es-CO')}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>{itemsDeLinea.length} productos activos</span>
            <button 
              type="button" 
              onclick={() => openItemModal(linea.id)}
              class="font-black text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              + Agregar plato
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Modal para Registrar Nuevo Plato en Línea Gastronómica -->
{#if showModalItem}
  <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="text-lg font-black text-slate-900">Nuevo Producto Gastronómico</h3>
        <button type="button" onclick={() => showModalItem = false} class="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
      </div>

      <form action="?/crearItem" method="POST" use:enhance={() => {
        return async ({ update }) => {
          await update();
          showModalItem = false;
        };
      }} class="space-y-4">
        <input type="hidden" name="linea_id" value={modalLineaId} />

        <div>
          <label for="nombre_item" class="block text-xs font-black uppercase text-slate-500 mb-1">Nombre del Plato / Combo</label>
          <input 
            type="text" 
            id="nombre_item" 
            name="nombre" 
            bind:value={modalNombre}
            required 
            placeholder="Ej: Hamburguesa Doble Queso + Papas"
            class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-800"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="precio_venta" class="block text-xs font-black uppercase text-slate-500 mb-1">Precio de Venta ($)</label>
            <input 
              type="number" 
              id="precio_venta" 
              name="precio_venta" 
              bind:value={modalPrecioVenta}
              required 
              min="0" 
              step="100" 
              placeholder="18000"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-black text-slate-900"
            />
          </div>

          <div>
            <label for="precio_costo" class="block text-xs font-black uppercase text-slate-500 mb-1">Costo Insumos ($)</label>
            <input 
              type="number" 
              id="precio_costo" 
              name="precio_costo" 
              bind:value={modalPrecioCosto}
              min="0" 
              step="100" 
              placeholder="7500"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700"
            />
          </div>
        </div>

        <div class="pt-4 flex gap-3">
          <button 
            type="button" 
            onclick={() => showModalItem = false}
            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            class="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl transition-all shadow-md cursor-pointer"
          >
            Guardar Plato
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
