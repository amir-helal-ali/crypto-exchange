<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/login');
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="animate-spin w-10 h-10 rounded-xl border-2 border-transparent" style="border-top-color: #f5b544; border-right-color: #f5b544;"></div>
</div>
