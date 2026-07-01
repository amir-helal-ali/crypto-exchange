<script lang="ts">
	let {
		title,
		subtitle,
		children
	}: {
		title: string;
		subtitle?: string;
		children: import('svelte').Snippet;
	} = $props();
</script>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-extrabold text-gold-gradient">{title}</h1>
		{#if subtitle}
			<p class="text-sm text-ink-muted mt-1">{subtitle}</p>
		{/if}
	</div>
	<div class="flex items-center gap-3">
		{@render children()}
	</div>
</div>
