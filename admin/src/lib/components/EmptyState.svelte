<script lang="ts">
	import { Inbox } from 'lucide-svelte';

	interface Props {
		message?: string;
	}

	let { message = 'لا توجد بيانات' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	<Inbox size={40} class="text-[var(--ink-faint)] mb-3" />
	<p class="text-[var(--ink-muted)] text-sm">{message}</p>
</div>
