<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/Toast.svelte';
	import { toast } from '$lib/stores/toast';

	let { children } = $props<{ children: import('svelte').Snippet }>();

	let toasts = $state<import('$lib/stores/toast').ToastItem[]>([]);
	toast.subscribe((v) => { toasts = v; });
</script>

{@render children()}
<Toast bind:items={toasts} />
