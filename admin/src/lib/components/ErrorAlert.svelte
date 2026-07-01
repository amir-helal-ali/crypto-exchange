<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		message: string;
		onretry?: () => void;
	}

	let { message, onretry }: Props = $props();
</script>

<div class="panel panel-rose p-4 flex items-center gap-3">
	<AlertTriangle size={20} class="text-[var(--rose)] flex-shrink-0" />
	<p class="text-sm text-[var(--rose)] flex-1">{message}</p>
	{#if onretry}
		<button class="btn-ghost text-xs text-[var(--rose)]" onclick={onretry}>إعادة المحاولة</button>
	{/if}
</div>
