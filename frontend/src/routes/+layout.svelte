<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  let { children } = $props();

  // Dark mode is the only mode — no theme init needed.
  // data-theme="dark" is set inline in app.html before first paint.
  onMount(() => {});
</script>

{@render children()}
