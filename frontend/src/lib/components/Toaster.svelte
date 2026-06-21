<script lang="ts">
  import { toasts, type ToastType } from '$lib/stores/toast';
  import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-svelte';

  const iconMap: Record<ToastType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle
  };

  const colorMap: Record<ToastType, string> = {
    success: 'text-accent-mint border-accent-mint/30',
    error: 'text-accent-rose border-accent-rose/30',
    info: 'text-accent-azure border-accent-azure/30',
    warning: 'text-accent-gold border-accent-gold/30'
  };
</script>

<div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
  {#each $toasts as toast (toast.id)}
    {@const Icon = iconMap[toast.type]}
    <div
      class="panel pointer-events-auto flex items-start gap-3 px-4 py-3 {colorMap[toast.type]}"
      style="animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);"
    >
      <Icon size={18} class="shrink-0 mt-0.5" />
      <p class="text-sm text-white flex-1">{toast.message}</p>
      <button
        class="text-slate-400 hover:text-white transition-colors"
        onclick={() => toasts.remove(toast.id)}
        aria-label="إغلاق"
      >
        <X size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
