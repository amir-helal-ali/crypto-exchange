<script lang="ts">
  import { Search } from 'lucide-svelte';

  let {
    value = $bindable(''),
    placeholder = 'بحث...',
    filters = [] as { key: string; label: string; options: { value: string; label: string }[] }[]
  } = $props<{
    value: string;
    placeholder?: string;
    filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  }>();

  let filterValues = $state<Record<string, string>>({});

  export function getFilters(): Record<string, string> {
    return filterValues;
  }
</script>

<div class="panel p-4">
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
    <div class="relative flex-1">
      <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
      <input type="text" class="input-field pr-10" {placeholder} bind:value dir="rtl" />
    </div>
    {#each filters as filter}
      <div class="relative">
        <select class="input-field appearance-none cursor-pointer min-w-[140px]"
          value={filterValues[filter.key] || ''}
          onchange={(e) => { filterValues[filter.key] = (e.target as HTMLSelectElement).value; }}
          dir="rtl">
          <option value="">{filter.label}</option>
          {#each filter.options as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    {/each}
  </div>
</div>
