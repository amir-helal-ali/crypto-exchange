<script lang="ts">
  import { AlertCircle, X } from 'lucide-svelte';

  let {
    message = '',
    onclose
  } = $props<{
    message: string;
    onclose?: () => void;
  }>();
</script>

{#if message}
  <div class="panel p-4 flex items-center gap-3 animate-slide-down" style="border-color: rgba(244,63,122,0.2);">
    <AlertCircle size={20} class="shrink-0" style="color: #f43f7a;" />
    <p class="text-sm flex-1" style="color: #fca5a5;">{message}</p>
    {#if onclose}
      <button class="btn-ghost text-xs p-1 rounded" onclick={onclose}>
        <X size={14} />
      </button>
    {/if}
  </div>
{/if}
