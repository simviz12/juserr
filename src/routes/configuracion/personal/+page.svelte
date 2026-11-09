<script lang="ts">
	import { enhance } from '$app/forms';
	import { UserPlus, Pencil, Trash2, Eye, EyeOff } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FormFeedback from '$lib/components/ui/FormFeedback.svelte';
	import DataTable from '$lib/components/data-table/DataTable.svelte';
	import type { Column } from '$lib/components/data-table/types';
	import { inputClass, selectClass, btn } from '$lib/components/ui/styles';
	import { cn } from '$lib/utils/cn';
	import { formatDate } from '$lib/utils/format';
	import { ROL_LABELS, normalizeRol } from '$lib/auth/access';

	let { data, form } = $props();
	type U = (typeof data.personal)[number];

	const ROL_INFO = [
		{ value: 'cajero', desc: 'Solo cierre de turno' },
		{ value: 'empleado', desc: 'Solo cierre de turno' },
		{ value: 'bodeguero', desc: 'Bodega y cierre de turno' },
		{ value: 'jefe', desc: 'Acceso total' }
	] as const;

	let open = $state(false);
	let editing = $state<U | null>(null);
	let nombre = $state('');
	let rol = $state('cajero');
	let password = $state('');
	let showPwd = $state(false);
	function openForm(u: U | null) {
		editing = u;
		nombre = u?.nombre ?? '';
		rol = u ? normalizeRol(u.rol) : 'cajero';
		password = '';
		showPwd = false;
		open = true;
	}
	let alLimite = $derived(data.limite !== null && data.personal.length >= data.limite);

	const columns: Column<U>[] = [
		{ id: 'nombre', header: 'Usuario', accessor: (u) => u.nombre },
		{ id: 'rol', header: 'Rol', accessor: (u) => u.rol },
		{ id: 'creado', header: 'Creado', accessor: (u) => u.createdAt, format: (v) => (v ? formatDate(String(v)) : '—'), hideOnMobile: true },
		{ id: 'acciones', header: '', accessor: () => null, sortable: false, align: 'right' }
	];
</script>

<svelte:head><title>Personal · MesaCapital</title></svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6">
	<PageHeader title="Personal" description={data.limite !== null ? `${data.personal.length} de ${data.limite} usuarios de tu plan.` : 'Usuarios con acceso al sistema.'}>
		{#snippet actions()}
			<button type="button" class={cn(btn.base, btn.primary)} onclick={() => openForm(null)} disabled={alLimite} title={alLimite ? 'Límite del plan alcanzado' : undefined}><UserPlus size={15} /> Nuevo usuario</button>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />
	<Card>
		<DataTable rows={data.personal} {columns} rowKey={(u) => u.id} initialSort={{ id: 'nombre', dir: 'asc' }} searchPlaceholder="Buscar usuario…" emptyTitle="Sin usuarios">
			{#snippet cell(u, col)}
				{#if col.id === 'nombre'}
					<div class="flex items-center gap-3">
						<span class="grid h-8 w-8 place-items-center rounded-full bg-muted text-sm font-semibold">{u.nombre.charAt(0).toUpperCase()}</span>
						<span class="font-medium">{u.nombre}</span>
						{#if u.id === data.yo}<Badge variant="outline">Tú</Badge>{/if}
					</div>
				{:else if col.id === 'rol'}
					{@const r = normalizeRol(u.rol)}
					<Badge variant={r === 'jefe' ? 'success' : 'neutral'}>{ROL_LABELS[r]}</Badge>
				{:else if col.id === 'acciones'}
					<div class="flex justify-end">
						<button type="button" class={cn(btn.base, btn.icon)} aria-label={`Editar ${u.nombre}`} onclick={() => openForm(u)}><Pencil size={14} /></button>
						<form method="POST" action="?/delete" use:enhance={({ cancel }) => { if (!confirm(`¿Eliminar a ${u.nombre}? Perderá el acceso inmediatamente.`)) cancel(); }}>
							<input type="hidden" name="id" value={u.id} />
							<button class={cn(btn.base, btn.icon, 'hover:text-danger')} aria-label={`Eliminar ${u.nombre}`} disabled={u.id === data.yo}><Trash2 size={14} /></button>
						</form>
					</div>
				{:else}
					{col.format ? col.format(col.accessor(u), u) : col.accessor(u)}
				{/if}
			{/snippet}
		</DataTable>
	</Card>
</div>

<Dialog bind:open title={editing ? `Editar a ${editing.nombre}` : 'Nuevo usuario'} size="sm">
	<form id="user-form" method="POST" action={editing ? '?/update' : '?/create'} class="flex flex-col gap-4" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') open = false; }}>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<Field label="Nombre de usuario" for="u-nombre" hint="Con este nombre inicia sesión">
			<input id="u-nombre" name="nombre" bind:value={nombre} required maxlength="60" autocomplete="off" class={inputClass} />
		</Field>
		<Field label="Rol" for="u-rol" hint={ROL_INFO.find((r) => r.value === rol)?.desc}>
			<select id="u-rol" name="rol" bind:value={rol} class={selectClass}>
				{#each ROL_INFO as r (r.value)}<option value={r.value}>{ROL_LABELS[r.value]}</option>{/each}
			</select>
		</Field>
		<Field label={editing ? 'Nueva contraseña' : 'Contraseña'} for="u-pwd" hint={editing ? 'Déjala vacía para no cambiarla. Si la cambias, se cerrarán sus sesiones.' : 'Mínimo 8 caracteres'} error={password && password.length < 8 ? 'Mínimo 8 caracteres' : undefined}>
			<div class="relative">
				<input id="u-pwd" name="password" type={showPwd ? 'text' : 'password'} bind:value={password} required={!editing} minlength="8" autocomplete="new-password" class={cn(inputClass, 'pr-9')} />
				<button type="button" class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} onclick={() => (showPwd = !showPwd)}>
					{#if showPwd}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
				</button>
			</div>
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class={cn(btn.base, btn.outline)} onclick={() => (open = false)}>Cancelar</button>
		<button type="submit" form="user-form" class={cn(btn.base, btn.primary)}>Guardar</button>
	{/snippet}
</Dialog>
