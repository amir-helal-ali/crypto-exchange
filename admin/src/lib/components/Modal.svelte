<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let { open, title, onclose, children, footer }: Props = $props();
</script>

{#if open}
	<div class="fixed inset-0 z-[9000] flex items-center justify-center p-4" onclick={onclose}>
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
		<div class="panel relative w-full max-w-lg p-6 z-10" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-bold">{title}</h2>
				<button onclick={onclose} class="btn-ghost p-1">
					<X size={18} />
				</button>
			</div>
			{@render children()}
			{#if footer}
				<div class="flex gap-3 justify-end mt-6 pt-4 glass-divider">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
