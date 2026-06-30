<script lang="ts">
  let { connected = false } = $props<{ connected: boolean }>();
</script>

{#if connected}
  <span class="pill-mint">
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: #22d3a4;"></span>
      <span class="relative inline-flex rounded-full h-2 w-2" style="background: #22d3a4;"></span>
    </span>
    مباشر
  </span>
{:else}
  <span class="pill-rose">
    <span class="inline-flex rounded-full h-2 w-2" style="background: #f43f7a;"></span>
    غير متصل
  </span>
{/if}
