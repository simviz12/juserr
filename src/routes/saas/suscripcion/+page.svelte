<script lang="ts">
  import { enhance } from '$app/forms';
  import { 
    CreditCard, 
    Check, 
    Sparkles, 
    ShieldCheck, 
    Smartphone, 
    Users, 
    Clock, 
    CheckCircle2, 
    AlertTriangle,
    Zap,
    Building2,
    CalendarCheck
  } from '@lucide/svelte';

  let { data, form } = $props();

  let cicloSeleccionado = $state('mensual'); // 'mensual' | 'trimestral' | 'anual'
  let planActivoCodigo = $derived(data.suscripcion?.planCodigo || 'pro');

  function calcularPrecioDisplay(precioMes: number) {
    if (cicloSeleccionado === 'trimestral') {
      return Math.round(precioMes * 0.91);
    }
    if (cicloSeleccionado === 'anual') {
      return Math.round(precioMes * 0.833);
    }
    return precioMes;
  }
</script>

<div class="max-w-6xl mx-auto space-y-8 font-sans">
  <!-- Cabecera SaaS y Resumen de Estado Actual -->
  <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
    <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-xs font-black uppercase tracking-wider mb-3">
          <Sparkles size={14} /> ChuzoOS / GastroFlow Cloud SaaS
        </div>
        <h1 class="text-3xl font-black tracking-tight text-white">Membresía & Facturación</h1>
        <p class="text-slate-300 text-sm mt-1 max-w-xl">
          Administra tu suscripción SaaS, renueva tu ciclo en pesos colombianos y desbloquea funciones multi-usuario y anti-fraude.
        </p>
      </div>

      <!-- Tarjeta de estado de suscripción -->
      <div class="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[260px]">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs uppercase tracking-wider text-slate-300 font-bold">Plan Actual</span>
          <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black rounded-full uppercase">
            {data.suscripcion.estado}
          </span>
        </div>
        <p class="text-2xl font-black text-white">{data.suscripcion.planNombre}</p>
        <p class="text-xs text-orange-300 mt-1 flex items-center gap-1.5 font-bold">
          <Clock size={13} /> {data.suscripcion.diasRestantes} días restantes de cobertura
        </p>
        <div class="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-slate-300">
          <span>Usuarios activos:</span>
          <span class="font-bold text-white">{data.conteoUsuarios} / {data.suscripcion.limiteUsuarios} permitidos</span>
        </div>
      </div>
    </div>
  </div>

  {#if form?.success}
    <div class="bg-emerald-50 text-emerald-800 p-5 rounded-2xl shadow-sm border border-emerald-200 flex items-center gap-3">
      <CheckCircle2 size={24} class="text-emerald-600 shrink-0" />
      <div>
        <span class="font-bold block">Suscripción Actualizada con Éxito</span>
        <span class="text-sm">{form.message}</span>
      </div>
    </div>
  {/if}

  <!-- Selector de Ciclo de Facturación (Mensual / Trimestral / Anual) -->
  <div class="flex flex-col items-center justify-center space-y-4">
    <span class="text-xs font-black uppercase tracking-wider text-slate-400">Elige tu ciclo de pago</span>
    <div class="inline-flex p-1.5 bg-slate-100 border border-slate-200 rounded-2xl shadow-inner gap-1">
      <button 
        type="button" 
        onclick={() => cicloSeleccionado = 'mensual'}
        class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer {cicloSeleccionado === 'mensual' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
      >
        Mes a Mes
      </button>

      <button 
        type="button" 
        onclick={() => cicloSeleccionado = 'trimestral'}
        class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer {cicloSeleccionado === 'trimestral' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
      >
        Trimestral <span class="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-md ml-1 font-extrabold">-9%</span>
      </button>

      <button 
        type="button" 
        onclick={() => cicloSeleccionado = 'anual'}
        class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer {cicloSeleccionado === 'anual' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}"
      >
        Anual <span class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md ml-1 font-extrabold">Paga 10, Lleva 12</span>
      </button>
    </div>
  </div>

  <!-- Parrilla de Planes Disponibles -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {#each data.planes as plan}
      {@const esActivo = planActivoCodigo === plan.codigo}
      {@const precioFinalMes = calcularPrecioDisplay(plan.precioMes)}
      {@const precioDia = Math.round(precioFinalMes / 30)}

      <div class="bg-white rounded-3xl p-6 border-2 transition-all flex flex-col justify-between relative shadow-sm hover:shadow-md {plan.destacado ? 'border-orange-500 ring-4 ring-orange-500/10' : esActivo ? 'border-emerald-500' : 'border-slate-100'}">
        {#if plan.destacado}
          <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-sm">
            Más Popular en Pasto ⭐
          </div>
        {/if}

        <div>
          <!-- Cabecera de la Tarjeta -->
          <div class="flex justify-between items-start mb-4">
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{plan.badge}</span>
              <h3 class="text-xl font-black text-slate-900 mt-0.5">{plan.nombre}</h3>
            </div>
            {#if esActivo}
              <span class="px-2 py-1 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-lg uppercase">
                Plan Activo
              </span>
            {/if}
          </div>

          <!-- Precios en COP -->
          <div class="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-black text-slate-900">${precioFinalMes.toLocaleString('es-CO')}</span>
              <span class="text-xs text-slate-500 font-bold">/ mes</span>
            </div>
            <p class="text-xs text-orange-600 font-black mt-1">
              ≈ ${precioDia.toLocaleString('es-CO')} COP al día
            </p>
          </div>

          <!-- Lista de Características -->
          <ul class="space-y-2.5 my-6 text-xs text-slate-600 font-medium">
            {#each plan.caracteristicas as feature}
              <li class="flex items-start gap-2">
                <Check size={16} class="text-emerald-500 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Botón de Acción / Suscripción -->
        <form action="?/cambiarPlan" method="POST" use:enhance class="pt-4 border-t border-slate-100">
          <input type="hidden" name="plan_codigo" value={plan.codigo} />
          <input type="hidden" name="ciclo" value={cicloSeleccionado} />

          {#if esActivo}
            <button 
              type="submit" 
              class="w-full py-3.5 bg-emerald-50 text-emerald-800 font-black text-xs uppercase tracking-wider rounded-xl border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              ✓ Plan en Uso (Renovar)
            </button>
          {:else}
            <button 
              type="submit" 
              class="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-98"
            >
              Cambiar a este Plan
            </button>
          {/if}
        </form>
      </div>
    {/each}
  </div>

  <!-- Garantía y Transparencia Económica (Modelo SENOVA) -->
  <div class="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-slate-700">
        <ShieldCheck size={26} class="text-emerald-600" />
      </div>
      <div>
        <h4 class="font-black text-slate-900 text-sm">Transparencia Económica y Respaldo AWS Lambda</h4>
        <p class="text-xs text-slate-500">
          Infraestructura serverless con 99.7% de disponibilidad garantizada. Facturación en pesos colombianos (COP), sin cargos ocultos en dólares.
        </p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs font-bold text-slate-400">Pasarela Integrada:</span>
      <span class="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-extrabold">Wompi / Nequi / Bancolombia</span>
    </div>
  </div>
</div>
