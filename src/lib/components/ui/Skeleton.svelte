<script lang="ts">
	import { cn } from '$lib/utils/cn';
	let { class: className }: { class?: string } = $props();
</script>

<div aria-hidden="true" class={cn('animate-shimmer rounded-md bg-muted', className)}></div>
