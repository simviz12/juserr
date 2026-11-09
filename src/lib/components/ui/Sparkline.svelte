<script lang="ts">
	/** Mini serie temporal sin ejes (solo forma). Decorativa: el valor exacto está en el KPI. */
	interface Props {
		values: number[];
		color?: string;
		class?: string;
	}
	let { values, color = 'var(--series-1)', class: className = 'h-8 w-24' }: Props = $props();

	const W = 96;
	const H = 32;
	let path = $derived.by(() => {
		if (values.length < 2) return '';
		const min = Math.min(...values);
		const max = Math.max(...values);
		if (max === min) return ''; // sin variación: no aporta forma
		const span = max - min || 1;
		return values
			.map((v, i) => {
				const x = (i / (values.length - 1)) * W;
				const y = H - 3 - ((v - min) / span) * (H - 6);
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});
	const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if path}
	<svg viewBox="0 0 {W} {H}" class={className} aria-hidden="true" preserveAspectRatio="none">
		<defs>
			<linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.18" />
				<stop offset="100%" stop-color={color} stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d="{path} L{W},{H} L0,{H} Z" fill="url(#{gid})" />
		<path d={path} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
	</svg>
{/if}
