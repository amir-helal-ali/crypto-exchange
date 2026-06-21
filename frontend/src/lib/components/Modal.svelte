<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, size = 'md', onClose, children, footer }: Props = $props();

  const sizeClass = $derived(
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
        ? 'max-w-2xl'
        : size === 'xl'
          ? 'max-w-4xl'
          : 'max-w-md'
  );

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={onBackdropClick}
    role="presentation"
  >
    <div class="absolute inset-0 bg-ink-950/80 backdrop-blur-md"></div>

    <div
      class="panel-glow relative w-full {sizeClass} max-h-[90vh] overflow-hidden flex flex-col"
      style="animation: modalIn 0.2s ease-out;"
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 class="text-base font-bold text-white">{title}</h3>
          <button
            class="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            onclick={onClose}
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
      {/if}

      <div class="overflow-y-auto px-5 py-4 flex-1">
        {@render children()}
      </div>

      {#if footer}
        <div class="border-t border-white/5 px-5 py-4 flex items-center justify-end gap-2">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes modalIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
