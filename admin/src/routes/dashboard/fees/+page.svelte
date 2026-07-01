<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut } from '$lib/api/client';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Percent, Edit3 } from 'lucide-svelte';
	import type { FeeSchedule } from '$lib/api/types';

	let fees = $state<FeeSchedule[]>([]);
	let loading = $state(true);
	let error = $state('');
	let editModal = $state(false);
	let selectedFee = $state<FeeSchedule | null>(null);
	let form = $state({ maker_fee: 0, taker_fee: 0, min_fee: 0 });

	const userTypeLabels: Record<string, string> = { USER: 'مستخدم', ADMIN: 'مدير', VERIFIED_USER: 'مستخدم موثق' };
	const orderTypeLabels: Record<string, string> = { MARKET: 'سوقي', LIMIT: 'محدود' };

	onMount(() => loadFees());

	async function loadFees() {
		loading = true; error = '';
		const res = await authGet<FeeSchedule[]>('/api/v1/admin/fees');
		if (res.success && res.data) { fees = Array.isArray(res.data) ? res.data : []; }
		else { error = res.error || 'فشل تحميل الرسوم'; }
		loading = false;
	}

	function openEdit(fee: FeeSchedule) {
		selectedFee = fee;
		form = { maker_fee: fee.maker_fee, taker_fee: fee.taker_fee, min_fee: fee.min_fee };
		editModal = true;
	}

	async function saveFee() {
		if (!selectedFee) return;
		const res = await authPut(`/api/v1/admin/fees/${selectedFee.id}`, form);
		if (res.success) { addToast('success', 'تم تحديث الرسوم'); editModal = false; loadFees(); }
		else { addToast('error', res.error || 'فشل التحديث'); }
	}
</script>

<PageHeader title="الرسوم" subtitle="إدارة جداول الرسوم" />

{#if error}
	<ErrorAlert message={error} onretry={loadFees} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if fees.length === 0}
	<EmptyState message="لا توجد جداول رسوم" />
{:else}
	<div class="panel overflow-x-auto">
		<table class="data-table">
			<thead><tr><th>نوع المستخدم</th><th>نوع الطلب</th><th>رسوم الصانع</th><th>رسوم الآخذ</th><th>الحد الأدنى</th><th>إجراءات</th></tr></thead>
			<tbody>
				{#each fees as fee}
					<tr>
						<td class="text-sm">{userTypeLabels[fee.user_type] || fee.user_type}</td>
						<td class="text-sm">{orderTypeLabels[fee.order_type] || fee.order_type}</td>
						<td class="text-sm tabular-nums">{fee.maker_fee}%</td>
						<td class="text-sm tabular-nums">{fee.taker_fee}%</td>
						<td class="text-sm tabular-nums">{fee.min_fee}</td>
						<td><button class="btn-ghost text-xs" onclick={() => openEdit(fee)}><Edit3 size={14} /></button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<Modal open={editModal} title="تعديل الرسوم" onclose={() => editModal = false}>
	{#snippet children()}
		<p class="text-sm text-[var(--ink-secondary)] mb-4">{userTypeLabels[selectedFee?.user_type || '']} — {orderTypeLabels[selectedFee?.order_type || '']}</p>
		<div class="space-y-4">
			<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">رسوم الصانع %</label><input type="number" step="0.01" class="input-field" bind:value={form.maker_fee} /></div>
			<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">رسوم الآخذ %</label><input type="number" step="0.01" class="input-field" bind:value={form.taker_fee} /></div>
			<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">الحد الأدنى</label><input type="number" step="0.01" class="input-field" bind:value={form.min_fee} /></div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn-secondary" onclick={() => editModal = false}>إلغاء</button>
		<button class="btn-primary" onclick={saveFee}>حفظ</button>
	{/snippet}
</Modal>
