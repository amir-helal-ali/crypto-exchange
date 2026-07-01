<script lang="ts">
  import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-svelte';
  import { toast, type ToastItem } from '$lib/stores/toast';

  const iconMap: Record<string, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle
  };

  const styleMap: Record<string, { bg: string; border: string; color: string; glow: string }> = {
    success: { bg: 'rgba(34,211,164,0.1)', border: 'rgba(34,211,164,0.2)', color: '#6ee7b7', glow: '0 0 20px rgba(34,211,164,0.12)' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', color: '#fca5a5', glow: '0 0 20px rgba(239,68,68,0.12)' },
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', color: '#93c5fd', glow: '0 0 20px rgba(59,130,246,0.12)' },
    warning: { bg: 'rgba(245,181,68,0.1)', border: 'rgba(245,181,68,0.2)', color: '#fcd34d', glow: '0 0 20px rgba(245,181,68,0.12)' }
  };
</script>

{#if $toast.length > 0}
  <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-md px-4">
    {#each $toast as item (item.id)}
      {@const style = styleMap[item.type] || styleMap.info}
      {@const Icon = iconMap[item.type] || Info}
      <div class="flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl text-sm font-medium animate-slide-down"
        style="background: {style.bg}; border: 1px solid {style.border}; color: {style.color}; box-shadow: {style.glow};">
        <Icon size={18} class="shrink-0" />
        <span class="flex-1">{item.message}</span>
        <button class="shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10" onclick={() => toast.dismiss(item.id)}>
          <X size={14} />
        </button>
      </div>
    {/each}
  </div>
{/if}
