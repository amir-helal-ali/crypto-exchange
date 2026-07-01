<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/api/client';

	let checking = $state(true);

	onMount(() => {
		if (isAuthenticated()) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<div class="flex items-center justify-center min-h-screen">
	<div class="w-8 h-8 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
</div>
