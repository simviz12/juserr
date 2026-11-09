<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		title?: string;
		description?: string;
		class?: string;
		bodyClass?: string;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, description, class: className, bodyClass, actions, children }: Props = $props();
</script>

<section
	class={cn(
		// min-w-0: dentro de un grid la tarjeta puede encogerse (si no, el contenido largo la ensancha)
		'min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
		className
	)}
>
	{#if title || actions}
		<!-- En pantallas angostas las acciones bajan de línea en vez de aplastar el título -->
		<header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
			<div class="min-w-0 flex-1 basis-52">
				{#if title}<h2 class="text-sm font-semibold tracking-tight">{title}</h2>{/if}
				{#if description}<p class="mt-0.5 text-[13px] text-muted-foreground">{description}</p>{/if}
			</div>
			{#if actions}<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class={cn('p-4 sm:p-5', bodyClass)}>
		{@render children()}
	</div>
</section>
