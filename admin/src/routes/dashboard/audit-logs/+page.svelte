<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet } from '$lib/api/client';
	import { formatDate, actionLabels, truncate } from '$lib/utils/helpers';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { ScrollText, Download } from 'lucide-svelte';
	import type { AuditLog } from '$lib/api/types';

	let logs = $state<AuditLog[]>([]);
	let total = $state(0);
	let page = $state(1);
	let limit = $state(20);
	let search = $state('');
	let loading = $state(true);
	let error = $state('');

	const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

	onMount(() => loadLogs());

	async function loadLogs() {
		loading = true; error = '';
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (search) params.set('search', search);
		const res = await authGet<AuditLog[]>(`/api/v1/admin/audit-logs?${params}`);
		if (res.success && res.data) {
			logs = Array.isArray(res.data) ? res.data : [];
			total = res.total || logs.length;
		} else { error = res.error || 'فشل تحميل السجلات'; }
		loading = false;
	}

	function exportLogs() {
		const token = localStorage.getItem('admin_token');
		window.open(`${API_BASE}/api/v1/admin/audit-logs/export?token=${token}`, '_blank');
	}
</script>

<PageHeader title="سجل العمليات" subtitle="تتبع جميع العمليات على المنصة" />

<div class="flex items-center gap-4 mb-4">
	<div class="flex-1 max-w-sm"><SearchBar placeholder="بحث في السجلات..." onchange={(v) => { search = v; page = 1; loadLogs(); }} /></div>
	<button class="btn-secondary text-xs" onclick={exportLogs}><Download size={14} />تصدير</button>
</div>

{#if error}
	<ErrorAlert message={error} onretry={loadLogs} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if logs.length === 0}
	<EmptyState message="لا توجد سجلات" />
{:else}
	<div class="panel overflow-x-auto">
		<table class="data-table">
			<thead><tr><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>IP</th><th>التاريخ</th></tr></thead>
			<tbody>
				{#each logs as log}
					<tr>
						<td class="text-sm font-medium">{log.username}</td>
						<td class="text-sm">{actionLabels[log.action] || log.action}</td>
						<td class="text-xs text-[var(--ink-muted)] max-w-xs truncate">{truncate(log.details, 50)}</td>
						<td class="text-xs text-[var(--ink-faint)] tabular-nums">{log.ipAddress}</td>
						<td class="text-xs text-[var(--ink-muted)]">{formatDate(log.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination {page} {total} {limit} onchange={(p) => { page = p; loadLogs(); }} />
{/if}
