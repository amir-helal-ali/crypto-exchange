<script lang="ts">
	import EmptyState from './EmptyState.svelte';

	let {
		headers = [] as string[],
		loading = false,
		emptyIcon,
		emptyTitle = 'لا توجد بيانات',
		emptyDescription,
		children
	}: {
		headers: string[];
		loading?: boolean;
		emptyIcon?: any;
		emptyTitle?: string;
		emptyDescription?: string;
		children: import('svelte').Snippet;
	} = $props();
</script>

<div class="panel overflow-hidden">
	<div class="overflow-x-auto">
		<table class="data-table">
			<thead>
				<tr>
					{#each headers as h}
						<th>{h}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if loading}
					{#each Array(5) as _, i}
						<tr>
							{#each headers as _}
								<td><div class="skeleton h-4 w-full max-w-[120px]"></div></td>
							{/each}
						</tr>
					{/each}
				{:else}
					{@render children()}
				{/if}
			</tbody>
		</table>
	</div>
</div>
