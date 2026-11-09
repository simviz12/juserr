<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let dark = $state(false);

	onMount(() => {
		dark = document.documentElement.classList.contains('dark');
	});

	function toggle() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		try {
			localStorage.setItem('mc-theme', dark ? 'dark' : 'light');
		} catch {
			/* almacenamiento no disponible: el tema solo dura la sesión */
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
	aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
	title={dark ? 'Modo claro' : 'Modo oscuro'}
>
	{#if dark}<Sun size={17} />{:else}<Moon size={17} />{/if}
</button>
