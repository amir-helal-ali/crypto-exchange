<script lang="ts">
  import { authStore } from '$lib/stores/auth';
  import { browser } from '$app/environment';

  let { size = 36, showName = false }: { size?: number; showName?: boolean } = $props();

  const initials = $derived.by(() => {
    const u = $authStore;
    if (!u) return '??';
    const name = u.full_name || u.username || u.email;
    const parts = name.split(/[\s@._]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });

  // Generate consistent gradient from username
  const gradient = $derived.by(() => {
    const u = $authStore;
    const seed = (u?.username || u?.email || 'unknown')
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const palettes = [
      ['#f5b544', '#f43f7a'],
      ['#22d3a4', '#3b82f6'],
      ['#a855f7', '#f5b544'],
      ['#f43f7a', '#a855f7'],
      ['#3b82f6', '#22d3a4']
    ];
    return palettes[seed % palettes.length];
  });
</script>

<div class="flex items-center gap-2.5">
  <div
    class="relative shrink-0 rounded-full flex items-center justify-center font-bold text-ink-950 overflow-hidden"
    style="width: {size}px; height: {size}px; font-size: {size * 0.4}px; background: linear-gradient(135deg, {gradient[0]}, {gradient[1]}); box-shadow: 0 4px 12px -2px {gradient[0]}40;"
  >
    {initials}
  </div>
  {#if showName && $authStore}
    <div class="hidden sm:block min-w-0">
      <p class="text-sm font-semibold text-white truncate">{$authStore.username}</p>
      <p class="text-xs text-slate-400 truncate">{$authStore.email}</p>
    </div>
  {/if}
</div>
