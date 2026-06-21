<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  let { children } = $props();

  // Initialize theme from localStorage on client mount
  // (the actual data-theme attribute is also set inline in app.html to prevent FOUC)
  onMount(() => {
    theme.init();
  });
</script>

{@render children()}
