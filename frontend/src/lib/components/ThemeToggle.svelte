<script lang="ts">
  import { theme } from '$lib/stores/theme';
  import { Sun, Moon } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let mounted = $state(false);
  onMount(() => (mounted = true));

  let { size = 18, className = '' }: { size?: number; className?: string } = $props();

  // Subscribe to theme store reactively
  const current = $derived($theme);

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    theme.toggle();
  }
</script>

<button
  type="button"
  onclick={handleClick}
  aria-label={current.resolved === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
  title={current.resolved === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
  class="theme-toggle relative p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors overflow-hidden {className}"
>
  {#if mounted}
    {#if current.resolved === 'dark'}
      <Sun {size} class="block animate-theme-in" />
    {:else}
      <Moon {size} class="block animate-theme-in" />
    {/if}
  {:else}
    <!-- SSR: render a neutral icon to avoid hydration mismatch -->
    <Sun {size} class="block" />
  {/if}
</button>

<style>
  @keyframes themeIn {
    0% {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
    100% {
      opacity: 1;
      transform: rotate(0) scale(1);
    }
  }
  .animate-theme-in {
    animation: themeIn 0.25s ease-out;
  }
</style>
