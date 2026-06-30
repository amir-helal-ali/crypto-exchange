<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/login');
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="animate-shimmer w-12 h-12 rounded-xl bg-white/5"></div>
</div>
