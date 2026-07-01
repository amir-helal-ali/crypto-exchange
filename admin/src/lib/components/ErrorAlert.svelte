<script lang="ts">
	import { AlertOctagon, X } from 'lucide-svelte';

	let {
		message = '',
		onclose
	}: {
		message: string;
		onclose?: () => void;
	} = $props();
</script>

{#if message}
	<div class="panel panel-rose flex items-center gap-3 px-4 py-3 mb-4">
		<AlertOctagon size={18} class="text-accent-rose flex-shrink-0" />
		<span class="text-sm text-accent-rose flex-1">{message}</span>
		{#if onclose}
			<button onclick={onclose} class="text-accent-rose/60 hover:text-accent-rose transition-colors">
				<X size={14} />
			</button>
		{/if}
	</div>
{/if}
