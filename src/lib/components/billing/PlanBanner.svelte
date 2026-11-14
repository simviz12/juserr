<script lang="ts">
	/**
	 * Aviso del estado del plan en todas las páginas: por vencer, en gracia,
	 * solo lectura o suspendido. A los roles operativos se les dice que avisen
	 * al administrador (no ven montos ni detalles de facturación).
	 */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { CircleAlert, Clock } from '@lucide/svelte';
	import type { Entitlements } from '$lib/modules/registry';

	interface Props {
		plan: Entitlements;
		esJefe: boolean;
	}
	let { plan, esJefe }: Props = $props();

	const AVISAR_DESDE_DIAS = 5;
	const dias = (n: number) => `${n} día${n === 1 ? '' : 's'}`;

	let aviso = $derived.by(() => {
		switch (plan.estadoCore) {
			case 'suspendido':
				return { tono: 'danger', texto: 'El servicio de este restaurante está suspendido.' };
			case 'solo-lectura':
				return {
					tono: 'danger',
					texto:
						'El plan está vencido: puedes consultar y exportar, pero no registrar turnos, compras ni cambios hasta renovar.'
				};
			case 'gracia':
				return {
					tono: 'warning',
					texto: `El plan venció. Te ${plan.diasGraciaRestantes === 1 ? 'queda' : 'quedan'} ${dias(plan.diasGraciaRestantes ?? 0)} de gracia antes de pasar a solo lectura.`
				};
			default:
				return plan.diasParaVencer !== null && plan.diasParaVencer <= AVISAR_DESDE_DIAS
					? {
							tono: 'info',
							texto:
								plan.diasParaVencer === 0
									? 'Tu plan vence hoy.'
									: `Tu plan vence en ${dias(plan.diasParaVencer)}.`
						}
					: null;
		}
	});

	const tonos: Record<string, string> = {
		danger: 'border-danger/30 bg-danger-soft text-danger',
		warning: 'border-warning/30 bg-warning-soft text-warning',
		info: 'border-border bg-muted text-foreground'
	};
	let enFacturacion = $derived(page.url.pathname.startsWith('/facturacion'));
</script>

{#if aviso && !enFacturacion}
	<div
		role="status"
		class="mb-6 flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between {tonos[
			aviso.tono
		]}"
	>
		<p class="flex items-start gap-2">
			{#if aviso.tono === 'info'}<Clock size={16} class="mt-0.5 shrink-0" />{:else}<CircleAlert
					size={16}
					class="mt-0.5 shrink-0"
				/>{/if}
			<span
				>{aviso.texto}{#if !esJefe}&nbsp;Avísale al administrador del restaurante.{/if}</span
			>
		</p>
		{#if esJefe}
			<a href={resolve('/facturacion')} class="shrink-0 font-medium underline underline-offset-2"
				>Ver cómo pagar</a
			>
		{/if}
	</div>
{/if}
