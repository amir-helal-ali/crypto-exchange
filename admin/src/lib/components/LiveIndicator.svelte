<script lang="ts">
	interface Props {
		label?: string;
	}

	let { label = 'مباشر' }: Props = $props();
</script>

<div class="flex items-center gap-2 text-xs font-medium" style="color: var(--mint)">
	<span class="relative flex h-2 w-2">
		<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: var(--mint)"></span>
		<span class="relative inline-flex rounded-full h-2 w-2" style="background: var(--mint)"></span>
	</span>
	{label}
</div>
