<script lang="ts">
	/** Muestra el resultado estándar de una form action ({ success, message } | { error }). */
	import Alert from './Alert.svelte';
	interface Props {
		form: { success?: boolean; message?: string; error?: string } | null | undefined;
	}
	let { form }: Props = $props();
</script>

{#if form?.error}
	<Alert variant="danger">{form.error}</Alert>
{:else if form?.success && form?.message}
	<Alert variant="success">{form.message}</Alert>
{/if}
