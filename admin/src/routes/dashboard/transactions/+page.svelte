<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut } from '$lib/api/client';
	import { formatDate, formatCurrency } from '$lib/utils/helpers';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-svelte';
	import type { AdminTransaction } from '$lib/api/types';

	let transactions = $state<AdminTransaction[]>([]);
	let total = $state(0);
	let page = $state(1);
	let limit = $state(20);
	let typeFilter = $state('');
	let statusFilter = $state('');
	let loading = $state(true);
	let error = $state('');

	let reviewModal = $state(false);
	let selectedTx = $state<AdminTransaction | null>(null);
	let reviewStatus = $state('COMPLETED');
	let rejectionReason = $state('');

	const typeTabs = [
		{ id: '', label: 'الكل' },
		{ id: 'DEPOSIT', label: 'إيداع' },
		{ id: 'WITHDRAWAL', label: 'سحب' }
	];
	const statusTabs = [
		{ id: '', label: 'الكل' },
		{ id: 'PENDING', label: 'معلق' },
		{ id: 'COMPLETED', label: 'مكتمل' },
		{ id: 'REJECTED', label: 'مرفوض' }
	];

	onMount(() => loadTransactions());

	async function loadTransactions() {
		loading = true; error = '';
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (typeFilter) params.set('type', typeFilter);
		if (statusFilter) params.set('status', statusFilter);
		const res = await authGet<AdminTransaction[]>(`/api/v1/admin/transactions?${params}`);
		if (res.success && res.data) {
			transactions = Array.isArray(res.data) ? res.data : [];
			total = res.total || transactions.length;
		} else { error = res.error || 'فشل تحميل المعاملات'; }
		loading = false;
	}

	function setTypeFilter(t: string) { typeFilter = t; page = 1; loadTransactions(); }
	function setStatusFilter(s: string) { statusFilter = s; page = 1; loadTransactions(); }

	function openReview(tx: AdminTransaction) {
		selectedTx = tx; reviewStatus = 'COMPLETED'; rejectionReason = '';
		reviewModal = true;
	}

	async function submitReview() {
		if (!selectedTx) return;
		const body: any = { status: reviewStatus };
		if (reviewStatus === 'REJECTED' && rejectionReason) body.rejection_reason = rejectionReason;
		const res = await authPut(`/api/v1/admin/transactions/${selectedTx.id}/review`, body);
		if (res.success) {
			addToast('success', 'تم مراجعة المعاملة');
			reviewModal = false; loadTransactions();
		} else { addToast('error', res.error || 'فشل المراجعة'); }
	}
</script>

<PageHeader title="المعاملات المالية" subtitle="إدارة الإيداعات والسحوبات" />

<div class="flex flex-wrap gap-2 mb-4">
	{#each typeTabs as tab}
		<button class="tab-btn {typeFilter === tab.id ? 'tab-btn-active' : ''}" onclick={() => setTypeFilter(tab.id)}>{tab.label}</button>
	{/each}
	<span class="mx-2 text-[var(--ink-faint)]">|</span>
	{#each statusTabs as tab}
		<button class="tab-btn {statusFilter === tab.id ? 'tab-btn-active' : ''}" onclick={() => setStatusFilter(tab.id)}>{tab.label}</button>
	{/each}
</div>

{#if error}
	<ErrorAlert message={error} onretry={loadTransactions} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if transactions.length === 0}
	<EmptyState message="لا توجد معاملات" />
{:else}
	<div class="panel overflow-x-auto">
		<table class="data-table">
			<thead><tr><th>المستخدم</th><th>النوع</th><th>العملة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
			<tbody>
				{#each transactions as tx}
					<tr>
						<td><p class="text-sm font-medium">{tx.username}</p><p class="text-xs text-[var(--ink-muted)]">{tx.email}</p></td>
						<td>{#if tx.type === 'DEPOSIT'}<span class="text-[var(--mint)] text-xs flex items-center gap-1"><ArrowDownToLine size={12}/>إيداع</span>{:else}<span class="text-[var(--rose)] text-xs flex items-center gap-1"><ArrowUpFromLine size={12}/>سحب</span>{/if}</td>
						<td class="text-sm">{tx.currency}</td>
						<td class="text-sm tabular-nums font-medium">{formatCurrency(tx.amount)}</td>
						<td><span class="pill pill-{tx.status === 'COMPLETED' ? 'completed' : tx.status === 'PENDING' ? 'pending' : 'rejected'}">{tx.status === 'COMPLETED' ? 'مكتمل' : tx.status === 'PENDING' ? 'معلق' : 'مرفوض'}</span></td>
						<td class="text-xs text-[var(--ink-muted)]">{formatDate(tx.createdAt)}</td>
						<td>{#if tx.status === 'PENDING'}<button class="btn-ghost text-xs" onclick={() => openReview(tx)}>مراجعة</button>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination {page} {total} {limit} onchange={(p) => { page = p; loadTransactions(); }} />
{/if}

<Modal open={reviewModal} title="مراجعة المعاملة" onclose={() => reviewModal = false}>
	{#snippet children()}
		<p class="text-sm text-[var(--ink-secondary)] mb-4">{selectedTx?.type === 'DEPOSIT' ? 'إيداع' : 'سحب'} — {formatCurrency(selectedTx?.amount || 0)}</p>
		<div class="space-y-3">
			<label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="txReview" value="COMPLETED" bind:group={reviewStatus} /><span class="text-sm text-[var(--mint)]">إكمال</span></label>
			<label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="txReview" value="REJECTED" bind:group={reviewStatus} /><span class="text-sm text-[var(--rose)]">رفض</span></label>
			{#if reviewStatus === 'REJECTED'}<textarea class="input-field" placeholder="سبب الرفض..." bind:value={rejectionReason} rows="3"></textarea>{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn-secondary" onclick={() => reviewModal = false}>إلغاء</button>
		<button class="btn-primary" onclick={submitReview}>تأكيد</button>
	{/snippet}
</Modal>
