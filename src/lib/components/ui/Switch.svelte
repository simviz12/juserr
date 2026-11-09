<script lang="ts">
	/** Interruptor accesible que envía "on" en formularios (compatible con checkbox). */
	interface Props {
		checked: boolean;
		name?: string;
		label: string;
		id?: string;
	}
	let { checked = $bindable(), name, label, id }: Props = $props();
</script>

<label class="relative inline-flex cursor-pointer items-center" for={id}>
	<input {id} type="checkbox" {name} bind:checked class="peer sr-only" aria-label={label} />
	<span
		class="h-5 w-9 rounded-full bg-input transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50"
	></span>
	<span
		class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4"
	></span>
</label>
