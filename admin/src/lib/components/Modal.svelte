<script lang="ts">
	let {
		open = $bindable(false),
		title,
		icon: Icon,
		iconColor = '#f5b544',
		iconBg = 'rgba(245,181,68,0.15)',
		size = 'md',
		children,
		footer
	}: {
		open: boolean;
		title: string;
		icon?: any;
		iconColor?: string;
		iconBg?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	} = $props();

	const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_interactive_supports_focus -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center p-4"
		onclick={(e) => { if (e.target === e.currentTarget) open = false; }}
		onkeydown={handleKeydown}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

		<!-- Modal Content -->
		<div class="relative {sizeMap[size]} w-full panel p-0 animate-scale-in overflow-hidden" style="z-index: 101;">
			<!-- Header -->
			<div class="flex items-center gap-3 px-6 py-4 glass-divider">
				{#if Icon}
					<div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background: {iconBg}">
						<Icon size={18} style="color: {iconColor}" />
					</div>
				{/if}
				<h2 class="text-lg font-bold text-ink-primary">{title}</h2>
			</div>

			<!-- Body -->
			<div class="px-6 py-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
				{@render children()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="px-6 py-4 glass-divider flex items-center justify-end gap-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
