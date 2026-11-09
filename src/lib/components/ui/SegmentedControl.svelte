<script lang="ts" generics="T extends string">
	interface Props {
		options: { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
		label: string;
	}
	let { options, value, onchange, label }: Props = $props();
</script>

<div role="radiogroup" aria-label={label} class="inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground">
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			onclick={() => onchange(opt.value)}
			class="inline-flex h-7 items-center rounded-[5px] px-3 text-[13px] font-medium whitespace-nowrap transition-all duration-150 {value ===
			opt.value
				? 'bg-card text-foreground shadow-sm'
				: 'hover:text-foreground'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
