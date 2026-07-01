<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	import { formatPercent } from '$lib/utils/helpers';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import type { FeeSchedule } from '$lib/api/types';
	import { Coins, Save, RotateCcw, RefreshCw } from 'lucide-svelte';

	let fees = $state<FeeSchedule[]>([]);
	let loading = $state(true);
	let error = $state('');
	let dirtyFields = $state<Record<string, boolean>>({});
	let originals = $state<Record<number, FeeSchedule>>({});
	let savingId = $state<number | null>(null);

	async function loadFees() {
		loading = true;
		error = '';
		const res = await authGet<FeeSchedule[]>('/api/v1/admin/fees');
		if (res.success && res.data) {
			fees = Array.isArray(res.data) ? res.data : [];
			fees.forEach((f) => { originals[f.id] = { ...f }; });
			dirtyFields = {};
		} else {
			error = res.error || 'فشل تحميل الرسوم';
		}
		loading = false;
	}

	function isDirty(id: number, field: string): boolean {
		const fee = fees.find((f) => f.id === id);
		if (!fee) return false;
		return fee[field as keyof FeeSchedule] !== originals[id]?.[field as keyof FeeSchedule];
	}

	async function saveFee(fee: FeeSchedule) {
		savingId = fee.id;
		const body: any = {};
		if (isDirty(fee.id, 'maker_fee')) body.maker_fee = fee.maker_fee;
		if (isDirty(fee.id, 'taker_fee')) body.taker_fee = fee.taker_fee;
		if (isDirty(fee.id, 'min_fee')) body.min_fee = fee.min_fee;

		if (!Object.keys(body).length) {
			toast.info('لا توجد تعديلات');
			savingId = null;
			return;
		}

		const res = await authPut(`/api/v1/admin/fees/${fee.id}`, body);
		if (res.success) {
			toast.success('تم تحديث الرسوم');
			originals[fee.id] = { ...fee };
			dirtyFields = {};
		} else {
			toast.error(res.error || 'فشل تحديث الرسوم');
		}
		savingId = null;
	}

	function resetFee(fee: FeeSchedule) {
		const orig = originals[fee.id];
		if (!orig) return;
		const idx = fees.findIndex((f) => f.id === fee.id);
		if (idx >= 0) fees[idx] = { ...orig };
		dirtyFields = {};
	}

	// Group fees by user_type
	let groupedFees = $derived.by(() => {
		const groups: Record<string, FeeSchedule[]> = {};
		fees.forEach((f) => {
			if (!groups[f.user_type]) groups[f.user_type] = [];
			groups[f.user_type].push(f);
		});
		return groups;
	});

	const userTypeLabels: Record<string, string> = {
		USER: 'مستخدم عادي',
		VERIFIED_USER: 'مستخدم موثّق'
	};

	onMount(() => { loadFees(); });
</script>

<PageHeader title="إدارة الرسوم" subtitle="تعديل جداول الرسوم حسب نوع المستخدم">
	<button class="btn-ghost" onclick={loadFees} disabled={loading}>
		<RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
	</button>
</PageHeader>

{#if error}
	<ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

{#if loading}
	<div class="panel p-6"><div class="skeleton h-64"></div></div>
{:else}
	{#each Object.entries(groupedFees) as [userType, groupFees]}
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-4">
				<Coins size={20} class="text-accent-gold" />
				<h2 class="text-lg font-bold text-ink-primary">{userTypeLabels[userType] || userType}</h2>
				<div class="flex items-center gap-4 mr-auto text-xs text-ink-muted">
					<span>متوسط Maker: {formatPercent(groupFees.reduce((s, f) => s + f.maker_fee, 0) / groupFees.length)}</span>
					<span>متوسط Taker: {formatPercent(groupFees.reduce((s, f) => s + f.taker_fee, 0) / groupFees.length)}</span>
				</div>
			</div>

			<div class="panel overflow-hidden">
				<table class="data-table">
					<thead>
						<tr>
							<th>نوع الطلب</th>
							<th>رسوم Maker</th>
							<th>رسوم Taker</th>
							<th>الحد الأدنى</th>
							<th>إجراءات</th>
						</tr>
					</thead>
					<tbody>
						{#each groupFees as fee}
							<tr>
								<td>
									<span class="text-sm font-medium text-ink-primary">{fee.order_type}</span>
								</td>
								<td class="relative">
									<div class="flex items-center gap-1">
										{#if isDirty(fee.id, 'maker_fee')}
											<div class="w-1.5 h-1.5 rounded-full bg-accent-gold absolute -top-1 -right-1"></div>
										{/if}
										<input
											type="number"
											step="0.01"
											value={fee.maker_fee}
											onchange={(e) => { fee.maker_fee = parseFloat((e.target as HTMLInputElement).value); dirtyFields = { ...dirtyFields }; }}
											class="input-field w-24 py-1.5 text-sm tabular-nums"
											dir="ltr"
										/>
										<span class="text-xs text-ink-muted">%</span>
									</div>
								</td>
								<td class="relative">
									<div class="flex items-center gap-1">
										{#if isDirty(fee.id, 'taker_fee')}
											<div class="w-1.5 h-1.5 rounded-full bg-accent-gold absolute -top-1 -right-1"></div>
										{/if}
										<input
											type="number"
											step="0.01"
											value={fee.taker_fee}
											onchange={(e) => { fee.taker_fee = parseFloat((e.target as HTMLInputElement).value); dirtyFields = { ...dirtyFields }; }}
											class="input-field w-24 py-1.5 text-sm tabular-nums"
											dir="ltr"
										/>
										<span class="text-xs text-ink-muted">%</span>
									</div>
								</td>
								<td class="relative">
									<div class="flex items-center gap-1">
										{#if isDirty(fee.id, 'min_fee')}
											<div class="w-1.5 h-1.5 rounded-full bg-accent-gold absolute -top-1 -right-1"></div>
										{/if}
										<input
											type="number"
											step="0.01"
											value={fee.min_fee}
											onchange={(e) => { fee.min_fee = parseFloat((e.target as HTMLInputElement).value); dirtyFields = { ...dirtyFields }; }}
											class="input-field w-24 py-1.5 text-sm tabular-nums"
											dir="ltr"
										/>
										<span class="text-xs text-ink-muted">%</span>
									</div>
								</td>
								<td>
									<div class="flex items-center gap-2">
										<button class="btn-buy text-xs px-2 py-1" onclick={() => saveFee(fee)} disabled={savingId === fee.id}>
											{#if savingId === fee.id}<RefreshCw size={12} class="animate-spin" />{:else}<Save size={12} />{/if}
											حفظ
										</button>
										<button class="btn-ghost text-xs px-2 py-1" onclick={() => resetFee(fee)}>
											<RotateCcw size={12} /> استعادة
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}
{/if}
