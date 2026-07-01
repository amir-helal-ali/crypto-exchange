<script lang="ts">
  let {
    headers = [] as { key: string; label: string; hidden?: string }[],
    rows = [] as any[],
    loading = false,
    emptyIcon = null as any,
    emptyTitle = 'لا توجد بيانات',
    emptyDescription = '',
    rowKey = 'id',
    children
  } = $props<{
    headers: { key: string; label: string; hidden?: string }[];
    rows: any[];
    loading?: boolean;
    emptyIcon?: any;
    emptyTitle?: string;
    emptyDescription?: string;
    rowKey?: string;
    children: import('svelte').Snippet<{ row: any; index: number }>;
  }>();
</script>

{#if loading}
  <div class="space-y-3">
    {#each Array(6) as _}
      <div class="panel p-4 flex items-center gap-4">
        <div class="animate-shimmer h-10 w-10 rounded-xl" style="background: rgba(255,255,255,0.05);"></div>
        <div class="flex-1 space-y-2">
          <div class="animate-shimmer h-4 w-1/3 rounded" style="background: rgba(255,255,255,0.05);"></div>
          <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.03);"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if rows.length === 0}
  <div class="panel">
    {#if emptyIcon}
      <svelte:component this={import('./EmptyState.svelte').then(m => m.default)} icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
    {:else}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <p class="text-sm" style="color: var(--text-quaternary);">{emptyTitle}</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="panel overflow-hidden">
    <div class="overflow-x-auto scrollbar-none">
      <table class="data-table">
        <thead>
          <tr>
            {#each headers as h}
              <th class={h.hidden || ''}>{h.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row[rowKey])}
            {@render children({ row, index: i })}
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
