<script lang="ts">
	let { connected = false } = $props<{ connected: boolean }>();
</script>

<div class="flex items-center gap-2">
	<div class="relative flex items-center justify-center w-2.5 h-2.5">
		{#if connected}
			<div class="absolute w-2.5 h-2.5 rounded-full bg-accent-mint animate-ping opacity-75"></div>
			<div class="w-2 h-2 rounded-full bg-accent-mint"></div>
		{:else}
			<div class="w-2 h-2 rounded-full bg-accent-rose"></div>
		{/if}
	</div>
	<span class="text-xs font-medium {connected ? 'text-accent-mint' : 'text-accent-rose'}">
		{connected ? 'مباشر' : 'غير متصل'}
	</span>
</div>
