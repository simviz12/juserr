<script lang="ts" generics="T extends string">
	interface Props {
		options: { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
		label: string;
	}
	let { options, value, onchange, label }: Props = $props();
</script>

<!-- max-w-full + scroll horizontal: con muchas opciones en móvil se desliza en vez de desbordar la página -->
<div role="radiogroup" aria-label={label} class="no-scrollbar inline-flex h-9 max-w-full items-center overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground">
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			onclick={() => onchange(opt.value)}
			class="inline-flex h-7 shrink-0 items-center rounded-[5px] px-2.5 text-[13px] font-medium whitespace-nowrap transition-all duration-150 sm:px-3 {value ===
			opt.value
				? 'bg-card text-foreground shadow-sm'
				: 'hover:text-foreground'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
