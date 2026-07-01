<script lang="ts">
  import { X } from 'lucide-svelte';

  let {
    open = $bindable(false),
    title = '',
    icon = null as any,
    iconColor = '#f5b544',
    iconBg = 'rgba(245,181,68,0.12)',
    size = 'md',
    children,
    footer
  } = $props<{
    open: boolean;
    title?: string;
    icon?: any;
    iconColor?: string;
    iconBg?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  }>();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-4xl'
  };

  function close() { open = false; }
  function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" onkeydown={handleKeydown}>
    <div class="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onclick={close} role="presentation"></div>
    <div class="relative z-10 w-full {sizeClasses[size]} panel overflow-hidden animate-scale-in">
      {#if title}
        <div class="flex items-center justify-between p-5 border-b" style="border-color: var(--border-subtle);">
          <div class="flex items-center gap-3">
            {#if icon}
              <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: {iconBg};">
                <icon size={20} style="color: {iconColor};"></icon>
              </div>
            {/if}
            <h3 class="font-bold text-[var(--text-primary)]">{title}</h3>
          </div>
          <button class="btn-ghost rounded-lg p-2" onclick={close} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
      {/if}
      <div class="p-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
        {@render children()}
      </div>
      {#if footer}
        <div class="px-5 pb-5">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
