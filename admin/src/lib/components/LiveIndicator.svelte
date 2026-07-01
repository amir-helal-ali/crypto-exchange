<script lang="ts">
  let { connected = false } = $props<{ connected: boolean }>();
</script>

<div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300"
  style="background: {connected ? 'rgba(34,211,164,0.08)' : 'rgba(244,63,122,0.08)'}; border: 1px solid {connected ? 'rgba(34,211,164,0.15)' : 'rgba(244,63,122,0.15)'};"
>
  <span class="relative flex h-2 w-2">
    {#if connected}
      <span class="animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-75" style="background: #22d3a4;"></span>
    {/if}
    <span class="relative inline-flex rounded-full h-2 w-2" style="background: {connected ? '#22d3a4' : '#f43f7a'};"></span>
  </span>
  <span style="color: {connected ? '#22d3a4' : '#f43f7a'};">
    {connected ? 'مباشر' : 'غير متصل'}
  </span>
</div>
