<script lang="ts">
  import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';

  interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
  }

  let { toasts = $bindable([]) } = $props<{ toasts: ToastItem[] }>();

  let nextId = $state(0);

  const iconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
  };

  const styleMap = {
    success: {
      bg: 'rgba(34,211,164,0.12)',
      border: 'rgba(34,211,164,0.25)',
      color: '#6ee7b7',
      glow: '0 0 24px rgba(34,211,164,0.15)'
    },
    error: {
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)',
      color: '#fca5a5',
      glow: '0 0 24px rgba(239,68,68,0.15)'
    },
    info: {
      bg: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.25)',
      color: '#93c5fd',
      glow: '0 0 24px rgba(59,130,246,0.15)'
    }
  };

  export function show(message: string, type: ToastItem['type'] = 'info') {
    const id = nextId++;
    toasts = [...toasts, { id, message, type }];
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, 4000);
  }

  function dismiss(id: number) {
    toasts = toasts.filter(t => t.id !== id);
  }
</script>

{#if toasts.length > 0}
  <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-md px-4">
    {#each toasts as toast (toast.id)}
      {@const style = styleMap[toast.type]}
      {@const Icon = iconMap[toast.type]}
      <div
        class="flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl text-sm font-medium animate-slide-down"
        style="background: {style.bg}; border: 1px solid {style.border}; color: {style.color}; box-shadow: {style.glow};"
      >
        <Icon size={18} class="shrink-0" />
        <span class="flex-1">{toast.message}</span>
        <button
          class="shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10"
          onclick={() => dismiss(toast.id)}
        >
          <X size={14} />
        </button>
      </div>
    {/each}
  </div>
{/if}
