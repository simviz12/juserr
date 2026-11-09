<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Banknote,
		Smartphone,
		Receipt,
		LockKeyhole,
		Printer,
		Send,
		Plus,
		Trash2,
		CircleCheck,
		TriangleAlert,
		CircleAlert,
		LoaderCircle,
		Package,
		Pizza,
		Info
	} from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, textareaClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { parseFraction } from '$lib/utils/fractions';
	import { formatCOP, formatDateTime, formatNumber } from '$lib/utils/format';
	import { extractRefs, PORCIONES_POR_MASA } from '$lib/features/shifts/domain/close-shift';
	import { cerrarLinea } from '$lib/features/shifts/domain/line-close';

	let { data, form } = $props();

	let negocio = $derived(data.rubroConfig.nombreNegocio);
	let pizzasActivas = $derived(data.rubroConfig.habilitarPizzas ?? true);
	let modoChuzo = $derived(data.rubroConfig.rubroPrincipal === 'chuzos');
	let unidad = $derived(modoChuzo ? 'pinchos' : 'porciones');
	let materiaPrima = $derived(modoChuzo ? 'insumos crudos' : 'masas crudas');

	// ── Estado del formulario ──────────────────────────────────
	let monto = $state('');
	let nequi = $state('');
	let refNequi = $state('');
	let descripcion = $state('');
	let masasSobrantesStr = $state('');
	let porcionesSobrantesStr = $state('');
	let mermasManual = $state('');
	let quemadasPorSabor = $state<Record<number, string>>({});
	let gastos = $state<{ id: number; descripcion: string; monto: string }[]>([]);
	let nextId = 1;
	let submitting = $state(false);

	const addGasto = () => gastos.push({ id: nextId++, descripcion: '', monto: '' });
	const removeGasto = (id: number) => (gastos = gastos.filter((g) => g.id !== id));

	// ── Inventario ─────────────────────────────────────────────
	let masasIniciales = $derived(data.inventario.masasActuales);
	let porcionesAyer = $derived(data.inventario.porcionesAyer);
	let precioPorcion = $derived(data.inventario.precioPorcion);
	let masasSobrantes = $derived(parseFraction(masasSobrantesStr) || 0);
	let masasExceden = $derived(masasSobrantes > masasIniciales);
	let porcionesSobrantes = $derived(parseInt(porcionesSobrantesStr) || 0);
	let mermasPorSabor = $derived(Object.values(quemadasPorSabor).reduce((a, v) => a + (parseInt(v) || 0), 0));
	// Si se detallan quemadas por sabor, ese total manda; si no, el campo manual.
	let porcionesMermadas = $derived(mermasPorSabor > 0 ? mermasPorSabor : parseInt(mermasManual) || 0);
	let masasUsadas = $derived(Math.max(0, masasIniciales - masasSobrantes));
	let porcionesNuevas = $derived(masasUsadas * PORCIONES_POR_MASA);
	let porcionesVendidas = $derived(Math.max(0, Math.round(porcionesNuevas + porcionesAyer - porcionesSobrantes - porcionesMermadas)));
	let ventaPizza = $derived(pizzasActivas ? porcionesVendidas * precioPorcion : 0);

	// ── Otras líneas (hamburguesas, chuzos, lasañas, carnes): control por inventario ──
	let lineaSob = $state<Record<number, string>>({});
	let lineaMer = $state<Record<number, string>>({});
	let itemQty = $state<Record<number, string>>({});
	let lineas = $derived(
		data.lineas
			.filter((l) => l.producto)
			.map((l) => {
				const inicial = l.producto!.stock;
				const sobStr = lineaSob[l.id] ?? '';
				const sobrantes = parseFraction(sobStr) || 0;
				const mermas = parseFraction(lineaMer[l.id] ?? '') || 0;
				const desglose = l.platos.map((p) => ({ itemId: p.id, cantidad: parseInt(itemQty[p.id] ?? '') || 0 })).filter((d) => d.cantidad > 0);
				return {
					...l,
					inicial,
					contado: sobStr.trim() !== '',
					excede: sobrantes + mermas > inicial,
					r: cerrarLinea(inicial, sobrantes, mermas, l.platos, desglose),
					tieneDesglose: desglose.length > 0
				};
			})
	);
	let ventaLineas = $derived(lineas.reduce((a, l) => a + (l.contado ? l.r.ventaEsperada : 0), 0));
	let lineasPendientes = $derived(lineas.filter((l) => !l.contado));
	let lineaExcede = $derived(lineas.some((l) => l.excede));
	let hayControl = $derived(pizzasActivas || lineas.length > 0);
	let ventaEsperada = $derived(ventaPizza + ventaLineas);

	// ── Dinero ─────────────────────────────────────────────────
	let efectivoNum = $derived(parseFloat(monto) || 0);
	let nequiNum = $derived(parseFloat(nequi) || 0);
	let totalGastos = $derived(gastos.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0));
	let totalDeclarado = $derived(efectivoNum + nequiNum + totalGastos);
	let diferencia = $derived(totalDeclarado - ventaEsperada);
	let hayDatos = $derived(monto !== '' || nequi !== '' || gastos.length > 0);
	let estadoCuadre = $derived(
		!hayControl ? 'sin-inventario' : Math.abs(diferencia) < 1 ? 'cuadrado' : diferencia > 0 ? 'sobrante' : 'faltante'
	);

	function addEfectivo(v: number) {
		monto = String((parseFloat(monto) || 0) + v);
	}

	// ── Antifraude: comprobante repetido ───────────────────────
	let refsPrevias = $derived(
		new Set(data.historialTurnos.flatMap((t) => t.transacciones.flatMap((tr) => extractRefs(tr.referencias))))
	);
	let refRepetida = $derived(extractRefs(refNequi).find((r) => refsPrevias.has(r)) ?? null);

	// ── Reporte WhatsApp ───────────────────────────────────────
	let whatsappUrl = $derived.by(() => {
		const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
		const msg = [
			`*Cierre de turno · ${negocio}*`,
			ahora,
			'',
			`Efectivo: ${formatCOP(efectivoNum)}`,
			`Nequi: ${formatCOP(nequiNum)}`,
			`Gastos: ${formatCOP(totalGastos)}`,
			`*Total declarado: ${formatCOP(totalDeclarado)}*`
		];
		if (hayControl) {
			msg.push('');
			if (pizzasActivas) msg.push(`Pizza: ${porcionesVendidas} ${unidad} (${formatCOP(ventaPizza)}), mermas ${porcionesMermadas}`);
			for (const l of lineas) {
				if (l.contado) msg.push(`${l.nombre}: ${l.r.consumidas} ${l.etiqueta} (${formatCOP(l.r.ventaEsperada)})`);
			}
			msg.push(
				`Venta esperada: ${formatCOP(ventaEsperada)}`,
				`*Diferencia: ${diferencia >= 0 ? '+' : ''}${formatCOP(diferencia)} (${estadoCuadre === 'cuadrado' ? 'cuadrado' : estadoCuadre})*`
			);
		}
		if (refNequi.trim()) msg.push('', `Refs Nequi: ${refNequi.trim()}`);
		if (descripcion.trim()) msg.push(`Nota: ${descripcion.trim()}`);
		return `https://wa.me/?text=${encodeURIComponent(msg.join('\n'))}`;
	});

	function resetForm() {
		monto = nequi = refNequi = descripcion = masasSobrantesStr = porcionesSobrantesStr = mermasManual = '';
		quemadasPorSabor = {};
		lineaSob = {};
		lineaMer = {};
		itemQty = {};
		gastos = [];
	}

	// ── Historial ──────────────────────────────────────────────
	type Turno = (typeof data.historialTurnos)[number];
	const columns: Column<Turno>[] = [
		{ id: 'fecha', header: 'Fecha', accessor: (t) => t.fecha, format: (v) => formatDateTime(v as string | null) },
		{ id: 'id', header: 'Turno', accessor: (t) => t.id, format: (v) => `#${v}` },
		{ id: 'porciones', header: 'Vendidas', accessor: (t) => t.porcionesVendidas ?? 0, align: 'right', hideOnMobile: true },
		{ id: 'mermas', header: 'Mermas', accessor: (t) => t.porcionesMermadas ?? 0, align: 'right', hideOnMobile: true },
		{ id: 'efectivo', header: 'Efectivo', accessor: (t) => Number(t.monto), format: (v) => formatCOP(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'nequi', header: 'Nequi', accessor: (t) => Number(t.transferencias ?? 0), format: (v) => formatCOP(Number(v)), align: 'right', hideOnMobile: true },
		{ id: 'gastos', header: 'Gastos', accessor: (t) => t.totalGastos, align: 'right' },
		{ id: 'total', header: 'Total', accessor: (t) => Number(t.monto) + Number(t.transferencias ?? 0) + t.totalGastos, format: (v) => formatCOP(Number(v)), align: 'right' }
	];

	const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000];
</script>

<svelte:head><title>Cierre de turno · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 print:hidden">
	<PageHeader eyebrow={negocio} title="Cierre de turno" description="Cuenta el inventario y el dinero. El sistema calcula cuánto debió entrar y te muestra la diferencia." />

	<FormFeedback {form} />

	<form
		method="POST"
		class="grid items-start gap-6 lg:grid-cols-[1fr_340px]"
		use:enhance={({ cancel }) => {
			if ((pizzasActivas && masasExceden) || lineaExcede || lineasPendientes.length > 0) {
				cancel();
				document.getElementById(lineasPendientes.length ? `linea-${lineasPendientes[0].id}` : 'masas_sobrantes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				return;
			}
			submitting = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				submitting = false;
				if (result.type === 'success') resetForm();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			};
		}}
	>
		<div class="flex min-w-0 flex-col gap-6">
			{#if pizzasActivas}
				<!-- 1. Inventario -->
				<Card title="1. Inventario físico" description="Lo que queda al final del turno. Masas iniciales y vitrina de ayer se toman de bodega automáticamente.">
					<div class="grid gap-4 sm:grid-cols-3">
						<Field
							label={`Sobrantes (${materiaPrima})`}
							for="masas_sobrantes"
							hint={`De ${formatNumber(masasIniciales)} en bodega al iniciar`}
							error={masasExceden ? `No puede superar ${formatNumber(masasIniciales)}` : undefined}
						>
							<input id="masas_sobrantes" name="masas_sobrantes" bind:value={masasSobrantesStr} required inputmode="decimal" placeholder="Ej: 11 1/2" class={inputClass} />
						</Field>
						<Field label={`${unidad[0].toUpperCase() + unidad.slice(1)} en vitrina`} for="porciones_sobrantes" hint="Quedan para mañana">
							<input id="porciones_sobrantes" name="porciones_sobrantes" type="number" min="0" step="1" bind:value={porcionesSobrantesStr} required placeholder="0" class={inputClass} />
						</Field>
						<Field label="Mermas (quemadas o dañadas)" for="porciones_mermadas" hint={mermasPorSabor > 0 ? 'Calculado desde el detalle por sabor' : 'No se cobran, pero quedan registradas'}>
							<input
								id="porciones_mermadas"
								name="porciones_mermadas"
								type="number"
								min="0"
								step="1"
								value={mermasPorSabor > 0 ? mermasPorSabor : mermasManual}
								oninput={(e) => (mermasManual = e.currentTarget.value)}
								readonly={mermasPorSabor > 0}
								placeholder="0"
								class={cn(inputClass, mermasPorSabor > 0 && 'bg-muted')}
							/>
						</Field>
					</div>

					<!-- Fórmula en vivo -->
					<div class="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-center sm:grid-cols-4">
						{#each [
							{ l: 'De ayer', v: porcionesAyer, h: 'vitrina' },
							{ l: 'Nuevas hoy', v: porcionesNuevas, h: `${formatNumber(masasUsadas)} × ${PORCIONES_POR_MASA}` },
							{ l: 'Sobran + mermas', v: porcionesSobrantes + porcionesMermadas, h: `${porcionesSobrantes} + ${porcionesMermadas}` },
							{ l: 'Vendidas', v: porcionesVendidas, h: formatCOP(ventaEsperada), strong: true }
						] as s (s.l)}
							<div class="bg-card px-3 py-3">
								<p class="text-xs text-muted-foreground">{s.l}</p>
								<p class="mt-0.5 text-lg font-semibold tabular-nums {s.strong ? 'text-foreground' : ''}">{formatNumber(s.v)}</p>
								<p class="text-[11px] text-muted-foreground tabular-nums">{s.h}</p>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-xs text-muted-foreground">
						Precio usado: {formatCOP(precioPorcion)} por porción {data.inventario.precioEsPromedio ? '(promedio de tus sabores)' : '(valor por defecto; configura precios en Sabores)'}.
					</p>
				</Card>

				<!-- 2. Sabores -->
				{#if data.sabores.length > 0}
					<Card title="2. Detalle por sabor" description="Opcional. Ruedas preparadas, porciones sobrantes y quemadas de cada sabor (alimenta el ranking de ventas).">
						<div class="overflow-x-auto rounded-md border border-border custom-scrollbar">
							<table class="w-full text-sm">
								<thead class="bg-muted/60 text-left text-xs text-muted-foreground">
									<tr>
										<th class="h-10 px-3 font-medium">Sabor</th>
										<th class="h-10 px-3 font-medium">Ruedas</th>
										<th class="h-10 px-3 font-medium">Sobrantes</th>
										<th class="h-10 px-3 font-medium">Quemadas</th>
									</tr>
								</thead>
								<tbody>
									{#each data.sabores as s (s.id)}
										<tr class="border-t border-border">
											<td class="px-3 py-2 font-medium">{s.nombre}</td>
											<td class="px-3 py-2"><input type="number" name="ruedas_{s.id}" min="0" step="1" placeholder="0" aria-label={`Ruedas de ${s.nombre}`} class={cn(inputClass, 'h-8 w-24')} /></td>
											<td class="px-3 py-2"><input type="number" name="sobras_{s.id}" min="0" step="0.5" placeholder="0" aria-label={`Sobrantes de ${s.nombre}`} class={cn(inputClass, 'h-8 w-24')} /></td>
											<td class="px-3 py-2">
												<input type="number" name="quemadas_{s.id}" min="0" step="1" placeholder="0" aria-label={`Quemadas de ${s.nombre}`} bind:value={quemadasPorSabor[s.id]} class={cn(inputClass, 'h-8 w-24')} />
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				{/if}
			{/if}

			<!-- Otras líneas: control por inventario del insumo de cada línea -->
			{#each lineas as l (l.id)}
				{@const unidadLbl = l.etiqueta}
				<div id={`linea-${l.id}`} class="scroll-mt-24">
					<Card title={l.nombre} description={`Cuenta los ${unidadLbl} que quedan (${l.producto?.nombre}). Lo que había se toma de bodega automáticamente.`}>
						{#snippet actions()}
							{#if l.contado && !l.excede}
								<Badge variant="success"><CircleCheck size={12} /> {formatNumber(l.r.consumidas)} vendidos</Badge>
							{:else if !l.contado}
								<Badge variant="outline">Pendiente</Badge>
							{/if}
						{/snippet}
						<div class="grid gap-4 sm:grid-cols-3">
							<div class="flex flex-col gap-1.5">
								<span class="text-sm font-medium">Había al iniciar</span>
								<div class="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm tabular-nums">{formatNumber(l.inicial)} {unidadLbl}</div>
								<p class="text-xs text-muted-foreground">Según bodega{l.inicial === 0 ? ' — registra la compra en Bodega' : ''}</p>
							</div>
							<Field label={`${unidadLbl[0].toUpperCase() + unidadLbl.slice(1)} sobrantes`} for={`linea_${l.id}_sobrantes`} error={l.excede ? `Sobrantes + mermas no pueden superar ${formatNumber(l.inicial)}` : undefined} hint="Cuéntalos físicamente">
								<input id={`linea_${l.id}_sobrantes`} name={`linea_${l.id}_sobrantes`} bind:value={lineaSob[l.id]} inputmode="decimal" placeholder="0" required class={cn(inputClass, l.excede && 'border-danger')} />
							</Field>
							<Field label="Mermas (dañados)" for={`linea_${l.id}_mermas`} hint="No se cobran">
								<input id={`linea_${l.id}_mermas`} name={`linea_${l.id}_mermas`} bind:value={lineaMer[l.id]} inputmode="decimal" placeholder="0" class={inputClass} />
							</Field>
						</div>

						{#if l.platos.length === 0}
							<Alert variant="warning" class="mt-4">
								Esta línea no tiene platos con precio. Agrégalos en <a href="/configuracion/rubros" class="underline">Líneas y combos</a> para calcular la venta esperada.
							</Alert>
						{:else}
							<details class="group mt-4 rounded-md border border-border" open={l.tieneDesglose}>
								<summary class="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-medium select-none">
									<span>Desglose por plato <span class="font-normal text-muted-foreground">(opcional, precio exacto y ranking)</span></span>
									{#if l.tieneDesglose}
										<Badge variant={l.r.desgloseCompleto ? 'success' : 'warning'}>{formatNumber(l.r.unidadesDesglose)} de {formatNumber(l.r.consumidas)}</Badge>
									{/if}
								</summary>
								<ul class="divide-y divide-border border-t border-border">
									{#each l.platos as p (p.id)}
										<li class="flex items-center gap-3 px-3 py-2">
											<span class="min-w-0 flex-1 truncate text-sm">{p.nombre}</span>
											<span class="text-xs text-muted-foreground tabular-nums">{formatCOP(p.precio)}{p.unidades !== 1 ? ` · ${p.unidades} ${unidadLbl}` : ''}</span>
											<input name={`item_${p.id}`} type="number" min="0" step="1" bind:value={itemQty[p.id]} placeholder="0" aria-label={`Vendidos de ${p.nombre}`} class={cn(inputClass, 'h-8 w-20 tabular-nums')} />
										</li>
									{/each}
								</ul>
								{#if l.tieneDesglose && !l.r.desgloseCompleto && l.contado}
									<p class="border-t border-border px-3 py-2 text-xs text-warning">
										{l.r.diferenciaUnidades > 0
											? `Faltan ${formatNumber(l.r.diferenciaUnidades)} ${unidadLbl} por explicar: se cobran al precio promedio.`
											: `El desglose supera lo consumido en ${formatNumber(-l.r.diferenciaUnidades)} ${unidadLbl}: revisa el conteo.`}
									</p>
								{/if}
							</details>
							<p class="mt-2 text-xs text-muted-foreground">
								Venta esperada: <span class="font-medium text-foreground tabular-nums">{l.contado ? formatCOP(l.r.ventaEsperada) : '—'}</span>
								{#if l.contado && !l.r.desgloseCompleto}(precio promedio {formatCOP(l.r.precioPorUnidad)} por {unidadLbl.replace(/s$/, '')}){/if}
							</p>
						{/if}
					</Card>
				</div>
			{/each}

			{#if !hayControl}
				<Alert variant="info" title="Sin control de inventario">
					No hay líneas activas en Líneas y combos, así que este cierre solo registra el dinero.
				</Alert>
			{/if}

			<!-- 3. Dinero -->
			<Card title="Dinero recibido" description="Cuenta el efectivo físicamente antes de escribirlo.">
				<div class="grid gap-5 md:grid-cols-2">
					<Field label="Efectivo en caja" for="monto">
						<div class="relative">
							<Banknote size={15} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
							<input id="monto" name="monto" type="number" min="0" step="100" bind:value={monto} required placeholder="0" class={cn(inputClass, 'h-10 pl-9 text-base font-medium tabular-nums')} />
						</div>
						<div class="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6 md:grid-cols-3 xl:grid-cols-6">
							{#each BILLETES as b (b)}
								<button type="button" class="h-8 rounded-md border border-border text-xs font-medium tabular-nums hover:bg-accent" onclick={() => addEfectivo(b)}>+{b / 1000}k</button>
							{/each}
						</div>
						{#if monto}
							<button type="button" class="self-start text-xs text-muted-foreground hover:text-foreground" onclick={() => (monto = '')}>Borrar efectivo</button>
						{/if}
					</Field>

					<div class="flex flex-col gap-4">
						<Field label="Nequi / Daviplata" for="nequi">
							<div class="relative">
								<Smartphone size={15} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
								<input id="nequi" name="nequi" type="number" min="0" step="100" bind:value={nequi} placeholder="0" class={cn(inputClass, 'h-10 pl-9 text-base font-medium tabular-nums')} />
							</div>
						</Field>
						<Field label="Referencias de comprobantes" for="ref_nequi" hint="Separadas por coma. El sistema bloquea comprobantes ya usados.">
							<input id="ref_nequi" name="ref_nequi" bind:value={refNequi} placeholder="Ej: M12345, C89012" class={cn(inputClass, refRepetida && 'border-danger ring-2 ring-danger/30')} />
						</Field>
						{#if refRepetida}
							<Alert variant="danger" title="Comprobante repetido">
								La referencia {refRepetida.toUpperCase()} ya se registró en un turno anterior. Verifica el pantallazo del cliente.
							</Alert>
						{/if}
					</div>
				</div>
			</Card>

			<!-- 4. Gastos -->
			<Card title="Gastos pagados con la caja" description="Compras inmediatas pagadas con dinero del turno (hielo, gas, domicilio…).">
				{#snippet actions()}
					<button type="button" class={cn(btn.base, btn.outline, btn.sm)} onclick={addGasto}><Plus size={14} /> Agregar</button>
				{/snippet}
				{#if gastos.length === 0}
					<p class="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Sin gastos en este turno.</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each gastos as g (g.id)}
							<li class="flex gap-2">
								<input name="gasto_descripcion" bind:value={g.descripcion} required placeholder="Concepto" aria-label="Concepto del gasto" class={cn(inputClass, 'flex-1')} />
								<input name="gasto_monto" type="number" min="1" step="100" bind:value={g.monto} required placeholder="Valor" aria-label="Valor del gasto" class={cn(inputClass, 'w-32 tabular-nums')} />
								<button type="button" class={cn(btn.base, btn.icon, 'h-9 w-9 hover:text-danger')} aria-label="Quitar gasto" onclick={() => removeGasto(g.id)}><Trash2 size={15} /></button>
							</li>
						{/each}
					</ul>
					<p class="mt-3 text-right text-sm text-muted-foreground">Total gastos <span class="font-medium text-foreground tabular-nums">{formatCOP(totalGastos)}</span></p>
				{/if}
			</Card>

			<Card title="Observaciones">
				<textarea name="descripcion" bind:value={descripcion} rows="2" maxlength="500" placeholder="Ej: el datáfono falló en la mañana…" class={textareaClass} aria-label="Observaciones del turno"></textarea>
			</Card>
		</div>

		<!-- Panel de cuadre (fijo en escritorio) -->
		<aside class="flex flex-col gap-4 lg:sticky lg:top-6">
			<Card title="Cuadre de caja">
				{#snippet actions()}
					{#if estadoCuadre === 'cuadrado' && hayDatos}
						<Badge variant="success"><CircleCheck size={12} /> Cuadrado</Badge>
					{:else if estadoCuadre === 'sobrante' && hayDatos}
						<Badge variant="warning"><Info size={12} /> Sobrante</Badge>
					{:else if estadoCuadre === 'faltante' && hayDatos}
						<Badge variant="danger"><CircleAlert size={12} /> Faltante</Badge>
					{/if}
				{/snippet}
				<dl class="flex flex-col gap-2 text-sm">
					<div class="flex justify-between"><dt class="flex items-center gap-1.5 text-muted-foreground"><Banknote size={14} /> Efectivo</dt><dd class="tabular-nums">{formatCOP(efectivoNum)}</dd></div>
					<div class="flex justify-between"><dt class="flex items-center gap-1.5 text-muted-foreground"><Smartphone size={14} /> Nequi</dt><dd class="tabular-nums">{formatCOP(nequiNum)}</dd></div>
					<div class="flex justify-between"><dt class="flex items-center gap-1.5 text-muted-foreground"><Receipt size={14} /> Gastos</dt><dd class="tabular-nums">{formatCOP(totalGastos)}</dd></div>
					<div class="mt-1 flex justify-between border-t border-border pt-2 font-medium"><dt>Total declarado</dt><dd class="tabular-nums">{formatCOP(totalDeclarado)}</dd></div>
					{#if hayControl}
						{#if pizzasActivas}
							<div class="flex justify-between"><dt class="flex items-center gap-1.5 text-muted-foreground"><Pizza size={14} /> Pizza</dt><dd class="tabular-nums">{formatCOP(ventaPizza)}</dd></div>
						{/if}
						{#each lineas as l (l.id)}
							<div class="flex justify-between"><dt class="flex items-center gap-1.5 text-muted-foreground"><Package size={14} /> <span class="max-w-36 truncate">{l.nombre}</span></dt><dd class="tabular-nums {l.contado ? '' : 'text-muted-foreground'}">{l.contado ? formatCOP(l.r.ventaEsperada) : 'sin contar'}</dd></div>
						{/each}
						<div class="flex justify-between font-medium"><dt>Venta esperada</dt><dd class="tabular-nums">{formatCOP(ventaEsperada)}</dd></div>
						<div class="mt-1 flex items-baseline justify-between border-t border-border pt-3">
							<dt class="font-medium">Diferencia</dt>
							<dd class="text-2xl font-semibold tracking-tight tabular-nums {!hayDatos ? 'text-muted-foreground' : estadoCuadre === 'faltante' ? 'text-danger' : estadoCuadre === 'sobrante' ? 'text-warning' : 'text-success'}">
								{diferencia > 0 ? '+' : ''}{formatCOP(diferencia)}
							</dd>
						</div>
					{/if}
				</dl>
				{#if hayDatos && estadoCuadre === 'faltante'}
					<p class="mt-3 text-xs text-muted-foreground">Revisa si falta registrar un gasto, un pago por Nequi o una merma.</p>
				{:else if hayDatos && estadoCuadre === 'sobrante'}
					<p class="mt-3 text-xs text-muted-foreground">Entró más de lo esperado: propinas, bebidas o redondeos.</p>
				{/if}
			</Card>

			<div class="flex flex-col gap-2">
				{#if lineasPendientes.length}
					<p class="flex items-center gap-1.5 text-xs text-muted-foreground"><Info size={13} /> Falta contar: {lineasPendientes.map((l) => l.nombre).join(', ')}.</p>
				{/if}
				<button type="submit" class={cn(btn.base, btn.primary, 'h-11 text-base')} disabled={submitting || (pizzasActivas && masasExceden) || lineaExcede || !!refRepetida}>
					{#if submitting}<LoaderCircle size={17} class="animate-spin" /> Guardando…{:else}<LockKeyhole size={17} /> Guardar y cerrar turno{/if}
				</button>
				<div class="grid grid-cols-2 gap-2">
					<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" class={cn(btn.base, btn.outline)}><Send size={15} /> WhatsApp</a>
					<button type="button" class={cn(btn.base, btn.outline)} onclick={() => window.print()}><Printer size={15} /> Tirilla</button>
				</div>
				{#if refRepetida}<p class="flex items-center gap-1.5 text-xs text-danger"><TriangleAlert size={13} /> Corrige el comprobante repetido para guardar.</p>{/if}
			</div>
		</aside>
	</form>

	<Card title="Últimos turnos" description="Los 20 cierres más recientes.">
		<DataTable rows={data.historialTurnos} {columns} rowKey={(t) => t.id} searchPlaceholder="Buscar turno o nota…" initialSort={{ id: 'fecha', dir: 'desc' }} emptyTitle="Aún no hay turnos" emptyDescription="El primer cierre aparecerá aquí.">
			{#snippet cell(t, c)}
				{#if c.id === 'gastos'}
					<span class={t.totalGastos > 0 ? 'text-danger' : 'text-muted-foreground'}>{t.totalGastos > 0 ? `−${formatCOP(t.totalGastos)}` : '—'}</span>
				{:else if c.id === 'total'}
					<span class="font-medium">{c.format?.(c.accessor(t), t)}</span>
				{:else if c.id === 'fecha'}
					<span>{formatDateTime(t.fecha)}</span>
					{#if t.descripcion}<span class="block max-w-52 truncate text-xs text-muted-foreground" title={t.descripcion}>{t.descripcion}</span>{/if}
				{:else}
					{c.format ? c.format(c.accessor(t), t) : c.accessor(t)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>

<!-- Tirilla térmica (58/80 mm): solo visible al imprimir -->
<div class="receipt hidden font-mono text-[11px] leading-snug text-black print:block">
	<p class="text-center text-sm font-bold">{negocio}</p>
	<p class="text-center">CIERRE DE TURNO</p>
	<p class="text-center">{new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })}</p>
	<hr class="my-1 border-dashed border-black" />
	<p class="flex justify-between"><span>Efectivo</span><span>{formatCOP(efectivoNum)}</span></p>
	<p class="flex justify-between"><span>Nequi</span><span>{formatCOP(nequiNum)}</span></p>
	{#each gastos.filter((g) => g.descripcion && parseFloat(g.monto) > 0) as g (g.id)}
		<p class="flex justify-between"><span>- {g.descripcion}</span><span>{formatCOP(parseFloat(g.monto))}</span></p>
	{/each}
	<p class="flex justify-between font-bold"><span>TOTAL DECLARADO</span><span>{formatCOP(totalDeclarado)}</span></p>
	{#if hayControl}
		<hr class="my-1 border-dashed border-black" />
		{#if pizzasActivas}
			<p class="flex justify-between"><span>Pizza: {porcionesVendidas} {unidad}</span><span>{formatCOP(ventaPizza)}</span></p>
			<p class="flex justify-between"><span>Mermas pizza</span><span>{porcionesMermadas}</span></p>
		{/if}
		{#each lineas.filter((x) => x.contado) as l (l.id)}
			<p class="flex justify-between"><span>{l.nombre}: {l.r.consumidas}</span><span>{formatCOP(l.r.ventaEsperada)}</span></p>
		{/each}
		<p class="flex justify-between"><span>Venta esperada</span><span>{formatCOP(ventaEsperada)}</span></p>
		<p class="flex justify-between font-bold"><span>DIFERENCIA</span><span>{diferencia > 0 ? '+' : ''}{formatCOP(diferencia)}</span></p>
	{/if}
	{#if refNequi.trim()}<p class="mt-1">Refs: {refNequi}</p>{/if}
	{#if descripcion.trim()}<p>Nota: {descripcion}</p>{/if}
	<hr class="my-1 border-dashed border-black" />
	<p class="mt-6 text-center">_______________________</p>
	<p class="text-center">Firma cajero</p>
</div>

<style>
	@media print {
		:global(html, body) {
			background: white !important;
		}
		.receipt {
			width: 72mm;
			margin: 0 auto;
		}
		:global(.receipt p) {
			margin: 0;
		}
	}
	@page {
		margin: 4mm;
	}
</style>
