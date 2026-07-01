<script lang="ts">
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();
</script>

<div class="relative min-h-screen">
  {@render children()}
  <Toast />
</div>
