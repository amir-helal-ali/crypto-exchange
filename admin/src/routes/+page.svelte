<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/api/client';
	import { onMount } from 'svelte';

	onMount(() => {
		if (isAuthenticated()) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center">
	<div class="text-[var(--ink-muted)] text-sm">جاري التحميل...</div>
</div>
