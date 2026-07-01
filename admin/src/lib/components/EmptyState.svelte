<script lang="ts">
	let {
		icon: Icon,
		title,
		description
	}: {
		icon?: any;
		title: string;
		description?: string;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	{#if Icon}
		<div class="w-16 h-16 rounded-2xl border border-white/8 bg-white/[0.02] flex items-center justify-center mb-4">
			<Icon size={28} class="text-ink-muted" />
		</div>
	{/if}
	<h3 class="text-lg font-bold text-ink-secondary mb-2">{title}</h3>
	{#if description}
		<p class="text-sm text-ink-muted max-w-sm">{description}</p>
	{/if}
</div>
