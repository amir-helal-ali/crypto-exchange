<script lang="ts">
	import { Search } from 'lucide-svelte';

	interface Props {
		placeholder?: string;
		onchange?: (value: string) => void;
	}

	let { placeholder = 'بحث...', onchange }: Props = $props();
	let value = $state('');

	function handleInput(e: Event) {
		value = (e.target as HTMLInputElement).value;
		onchange?.(value);
	}
</script>

<div class="relative">
	<Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
	<input
		type="text"
		class="input-field pr-10"
		{placeholder}
		value={value}
		oninput={handleInput}
	/>
</div>
