<script lang="ts">
	import { Search } from 'lucide-svelte';

	let {
		value = $bindable(''),
		placeholder = 'بحث...',
		filters = [] as Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>,
		filterValues = $bindable({} as Record<string, string>)
	}: {
		value: string;
		placeholder?: string;
		filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
		filterValues?: Record<string, string>;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-3 mb-4">
	<div class="relative flex-1 min-w-[200px]">
		<Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
		<input
			type="text"
			bind:value
			{placeholder}
			class="input-field pr-10"
		/>
	</div>
	{#each filters as filter}
		<select
			class="input-field w-auto min-w-[140px]"
			onchange={(e) => { filterValues[filter.key] = (e.target as HTMLSelectElement).value; }}
			value={filterValues[filter.key] || ''}
		>
			<option value="">{filter.label}</option>
			{#each filter.options as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	{/each}
</div>
