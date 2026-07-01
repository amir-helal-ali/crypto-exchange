<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  let {
    page = $bindable(1),
    totalPages = 1,
    totalItems = 0,
    itemLabel = 'عنصر'
  } = $props<{
    page: number;
    totalPages: number;
    totalItems: number;
    itemLabel?: string;
  }>();

  let pages = $derived.by(() => {
    const p = [];
    const current = page;
    const total = totalPages;
    if (total <= 7) {
      for (let i = 1; i <= total; i++) p.push(i);
    } else {
      p.push(1);
      if (current > 3) p.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) p.push(i);
      if (current < total - 2) p.push('...');
      p.push(total);
    }
    return p;
  });
</script>

{#if totalPages > 1}
  <div class="flex items-center justify-between pt-4 animate-fade-in">
    <span class="text-xs" style="color: var(--text-quaternary);">
      {totalItems.toLocaleString('ar-EG')} {itemLabel}
    </span>
    <div class="flex items-center gap-1">
      <button class="btn-ghost p-2 rounded-lg" onclick={() => page = Math.max(1, page - 1)} disabled={page <= 1}>
        <ChevronRight size={16} />
      </button>

      {#each pages as p}
        {#if p === '...'}
          <span class="px-2 text-xs" style="color: var(--text-quaternary);">...</span>
        {:else}
          <button
            class="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
            style={page === p
              ? 'background: rgba(245,181,68,0.12); color: #f5b544; border: 1px solid rgba(245,181,68,0.2);'
              : 'color: var(--text-secondary); background: transparent; border: 1px solid transparent;'}
            onclick={() => page = p as number}
            disabled={page === p}
          >
            {p}
          </button>
        {/if}
      {/each}

      <button class="btn-ghost p-2 rounded-lg" onclick={() => page = Math.min(totalPages, page + 1)} disabled={page >= totalPages}>
        <ChevronLeft size={16} />
      </button>
    </div>
  </div>
{/if}
