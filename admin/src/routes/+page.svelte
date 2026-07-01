<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { isAuthenticated } from '$lib/api/client';

  onMount(() => {
    if (isAuthenticated()) {
      goto('/dashboard');
    } else {
      goto('/login');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center" style="background: var(--bg-base);">
  <div class="animate-spin h-8 w-8 rounded-full border-2" style="border-color: var(--border-medium); border-top-color: var(--accent-gold);"></div>
</div>
