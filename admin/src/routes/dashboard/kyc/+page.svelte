<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut } from '$lib/api/client';
	import { formatDate, docTypeLabels, formatNumber } from '$lib/utils/helpers';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { ShieldCheck, CheckCircle, XCircle } from 'lucide-svelte';
	import type { KYCRequest } from '$lib/api/types';

	let requests = $state<KYCRequest[]>([]);
	let total = $state(0);
	let page = $state(1);
	let limit = $state(20);
	let statusFilter = $state('');
	let loading = $state(true);
	let error = $state('');

	let reviewModal = $state(false);
	let selectedKYC = $state<KYCRequest | null>(null);
	let reviewStatus = $state('APPROVED');
	let rejectionReason = $state('');

	const tabs = [
		{ id: '', label: 'الكل' },
		{ id: 'PENDING', label: 'قيد الانتظار' },
		{ id: 'APPROVED', label: 'مقبول' },
		{ id: 'REJECTED', label: 'مرفوض' }
	];

	onMount(() => loadKYC());

	async function loadKYC() {
		loading = true; error = '';
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (statusFilter) params.set('status', statusFilter);
		const res = await authGet<KYCRequest[]>(`/api/v1/admin/kyc?${params}`);
		if (res.success && res.data) {
			requests = Array.isArray(res.data) ? res.data : [];
			total = res.total || requests.length;
		} else { error = res.error || 'فشل تحميل طلبات التحقق'; }
		loading = false;
	}

	function setFilter(status: string) {
		statusFilter = status; page = 1; loadKYC();
	}

	function openReview(kyc: KYCRequest) {
		selectedKYC = kyc; reviewStatus = 'APPROVED'; rejectionReason = '';
		reviewModal = true;
	}

	async function submitReview() {
		if (!selectedKYC) return;
		const body: any = { status: reviewStatus };
		if (reviewStatus === 'REJECTED' && rejectionReason) body.rejection_reason = rejectionReason;
		const res = await authPut(`/api/v1/admin/kyc/${selectedKYC.id}/review`, body);
		if (res.success) {
			addToast('success', reviewStatus === 'APPROVED' ? 'تم قبول الطلب' : 'تم رفض الطلب');
			reviewModal = false; loadKYC();
		} else { addToast('error', res.error || 'فشل مراجعة الطلب'); }
	}
</script>

<PageHeader title="التحقق KYC" subtitle="مراجعة طلبات التحقق من الهوية" />

<div class="flex gap-2 mb-4">
	{#each tabs as tab}
		<button class="tab-btn {statusFilter === tab.id ? 'tab-btn-active' : ''}" onclick={() => setFilter(tab.id)}>
			{tab.label}
		</button>
	{/each}
</div>

{#if error}
	<ErrorAlert message={error} onretry={loadKYC} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if requests.length === 0}
	<EmptyState message="لا توجد طلبات تحقق" />
{:else}
	<div class="grid gap-4">
		{#each requests as req}
			<div class="panel p-4 flex items-center gap-4">
				<div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
					style="background: rgba(34,211,164,0.1);">
					<ShieldCheck size={22} style="color: var(--mint)" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-1">
						<span class="font-medium text-sm">{req.user?.username || '—'}</span>
						<span class="pill pill-{req.status === 'PENDING' ? 'pending' : req.status === 'APPROVED' ? 'approved' : 'rejected'}">
							{req.status === 'PENDING' ? 'قيد الانتظار' : req.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
						</span>
					</div>
					<p class="text-xs text-[var(--ink-muted)]">{docTypeLabels[req.document_type] || req.document_type} — {req.document_number}</p>
					<p class="text-xs text-[var(--ink-faint)]">{formatDate(req.created_at)}</p>
				</div>
				{#if req.status === 'PENDING'}
					<button class="btn-ghost text-xs" onclick={() => openReview(req)}>مراجعة</button>
				{/if}
			</div>
		{/each}
	</div>
	<Pagination {page} {total} {limit} onchange={(p) => { page = p; loadKYC(); }} />
{/if}

<Modal open={reviewModal} title="مراجعة طلب التحقق" onclose={() => reviewModal = false}>
	{#snippet children()}
		<p class="text-sm text-[var(--ink-secondary)] mb-4">المستخدم: <strong>{selectedKYC?.user?.username}</strong></p>
		<p class="text-sm text-[var(--ink-muted)] mb-4">نوع الوثيقة: {docTypeLabels[selectedKYC?.document_type || ''] || selectedKYC?.document_type}</p>
		<div class="space-y-3">
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="radio" name="review" value="APPROVED" bind:group={reviewStatus} />
				<span class="text-sm text-[var(--mint)]">قبول</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="radio" name="review" value="REJECTED" bind:group={reviewStatus} />
				<span class="text-sm text-[var(--rose)]">رفض</span>
			</label>
			{#if reviewStatus === 'REJECTED'}
				<textarea class="input-field" placeholder="سبب الرفض..." bind:value={rejectionReason} rows="3"></textarea>
			{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn-secondary" onclick={() => reviewModal = false}>إلغاء</button>
		<button class="btn-primary" onclick={submitReview}>تأكيد</button>
	{/snippet}
</Modal>
