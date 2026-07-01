<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
	}

	let { title, subtitle }: Props = $props();
</script>

<div class="mb-6">
	<h1 class="text-xl font-black text-aurora">{title}</h1>
	{#if subtitle}
		<p class="text-sm text-[var(--ink-muted)] mt-1">{subtitle}</p>
	{/if}
</div>
