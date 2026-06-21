<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    padding?: boolean;
    glow?: boolean;
    actions?: Snippet;
    children: Snippet;
  }

  let { title, subtitle, padding = true, glow = false, actions, children }: Props = $props();
</script>

<div class={glow ? 'panel-glow' : 'panel'} class:flex="{true}" class:flex-col="{true}">
  {#if title || actions}
    <div class="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-3.5">
      <div class="min-w-0">
        {#if title}
          <h3 class="text-sm font-semibold text-white truncate">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2 shrink-0">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  <div class={padding ? 'p-5' : ''} class:flex-1="{true}" class:min-h-0="{true}">
    {@render children()}
  </div>
</div>
