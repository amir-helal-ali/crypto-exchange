<script lang="ts">
  import { ChevronRight, ChevronLeft } from 'lucide-svelte';

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
    const arr: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  });
</script>

{#if totalPages > 1}
  <div class="panel p-4 flex items-center justify-between flex-wrap gap-3">
    <p class="text-xs" style="color: var(--text-tertiary);">
      إجمالي {totalItems.toLocaleString('ar-EG')} {itemLabel} · صفحة {page} من {totalPages}
    </p>

    <div class="flex items-center gap-1">
      <button
        class="btn-ghost p-2 rounded-lg"
        onclick={() => (page = Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <ChevronRight size={18} />
      </button>

      {#if pages[0] > 1}
        <button class="btn-ghost px-3 py-1.5 rounded-lg text-xs" onclick={() => (page = 1)}>1</button>
        {#if pages[0] > 2}
          <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
        {/if}
      {/if}

      {#each pages as p}
        <button
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
          class:btn-primary={p === page}
          class:btn-ghost={p !== page}
          onclick={() => (page = p)}
          disabled={p === page}
        >
          {p}
        </button>
      {/each}

      {#if pages[pages.length - 1] < totalPages}
        {#if pages[pages.length - 1] < totalPages - 1}
          <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
        {/if}
        <button
          class="btn-ghost px-3 py-1.5 rounded-lg text-xs"
          onclick={() => (page = totalPages)}
        >
          {totalPages}
        </button>
      {/if}

      <button
        class="btn-ghost p-2 rounded-lg"
        onclick={() => (page = Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        <ChevronLeft size={18} />
      </button>
    </div>
  </div>
{/if}
