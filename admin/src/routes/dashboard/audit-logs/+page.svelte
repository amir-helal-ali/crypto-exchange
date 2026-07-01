<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet } from '$lib/api/client';
	import { formatNumber, formatDate, actionLabels, debounce } from '$lib/utils/helpers';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import type { AuditLog } from '$lib/api/types';
	import { ScrollText, Download, RefreshCw } from 'lucide-svelte';
	import { API_BASE } from '$lib/api/client';

	let logs = $state<AuditLog[]>([]);
	let loading = $state(true);
	let error = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	let totalItems = $state(0);
	let search = $state('');
	let categoryFilter = $state('');

	const filters = [
		{
			key: 'action',
			label: 'التصنيف',
			options: [
				{ value: 'LOGIN', label: 'المصادقة' },
				{ value: 'UPDATE_USER_ROLE', label: 'إدارة' },
				{ value: 'PLACE_ORDER', label: 'تداول' }
			]
		}
	];
	let filterValues = $state<Record<string, string>>({});

	async function loadLogs() {
		loading = true;
		error = '';
		let path = `/api/v1/admin/audit-logs?page=${page}&limit=20`;
		if (search) path += `&search=${encodeURIComponent(search)}`;
		if (filterValues.action) path += `&action=${filterValues.action}`;
		const res = await authGet<AuditLog[]>(path);
		if (res.success && res.data) {
			logs = (res as any).data || [];
			totalItems = (res as any).total || 0;
			totalPages = Math.ceil(totalItems / 20);
		} else {
			error = res.error || 'فشل تحميل السجلات';
		}
		loading = false;
	}

	function exportCSV() {
		const token = localStorage.getItem('admin_token');
		let url = `${API_BASE}/api/v1/admin/audit-logs/export?token=${token}`;
		if (filterValues.action) url += `&action=${filterValues.action}`;
		window.open(url, '_blank');
	}

	$effect(() => { loadLogs(); });

	onMount(() => {
		loadLogs();
	});
</script>

<PageHeader title="سجل المراجعة" subtitle="سجل جميع العمليات والإجراءات">
	<button class="btn-ghost" onclick={exportCSV}>
		<Download size={16} /> تصدير CSV
	</button>
	<button class="btn-ghost" onclick={loadLogs} disabled={loading}>
		<RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
	</button>
</PageHeader>

{#if error}
	<ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

<SearchBar bind:value={search} placeholder="بحث بالاسم أو الإجراء..." {filters} bind:filterValues />

<DataTable headers={['المستخدم', 'الإجراء', 'التفاصيل', 'عنوان IP', 'التاريخ']} {loading} emptyIcon={ScrollText} emptyTitle="لا توجد سجلات">
	{#each logs as log}
		<tr>
			<td>
				<span class="text-sm font-medium text-ink-primary">{log.username}</span>
			</td>
			<td>
				<span class="pill-pending">{actionLabels[log.action] || log.action}</span>
			</td>
			<td>
				<span class="text-sm text-ink-secondary truncate max-w-[200px] block">{log.details || '—'}</span>
			</td>
			<td>
				<span class="text-xs text-ink-muted font-mono" dir="ltr">{log.ipAddress}</span>
			</td>
			<td>
				<span class="text-sm text-ink-muted">{formatDate(log.createdAt)}</span>
			</td>
		</tr>
	{/each}
</DataTable>

<Pagination bind:page {totalPages} {totalItems} itemLabel="سجل" />
