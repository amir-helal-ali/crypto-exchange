<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, createAdminStream } from '$lib/api/client';
	import { formatNumber, formatCompact, generateAreaChart } from '$lib/utils/helpers';
	import StatCard from '$lib/components/StatCard.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import LiveIndicator from '$lib/components/LiveIndicator.svelte';
	import { Users, ArrowLeftRight, ShieldCheck, Clock, TrendingUp, AlertTriangle, ScrollText, Wallet } from 'lucide-svelte';
	import type { AdminStats, AuditLog } from '$lib/api/types';

	let stats = $state<AdminStats | null>(null);
	let recentAudits = $state<AuditLog[]>([]);
	let loading = $state(true);
	let error = $state('');
	let liveConnected = $state(false);

	onMount(async () => {
		await Promise.all([loadStats(), loadRecentAudits()]);
		connectSSE();
	});

	async function loadStats() {
		const res = await authGet<AdminStats>('/api/v1/admin/stats');
		if (res.success && res.data) stats = res.data;
		else error = res.error || 'فشل تحميل الإحصائيات';
		loading = false;
	}

	async function loadRecentAudits() {
		const res = await authGet<AuditLog[]>('/api/v1/admin/audit-logs?limit=5');
		if (res.success && res.data) recentAudits = Array.isArray(res.data) ? res.data : [];
	}

	function connectSSE() {
		const es = createAdminStream(['stats', 'audit']);
		if (es) {
			es.onopen = () => { liveConnected = true; };
			es.onerror = () => { liveConnected = false; };
			es.addEventListener('stats', (e) => {
				try { stats = JSON.parse(e.data); } catch {}
			});
			es.addEventListener('audit', (e) => {
				try {
					const log = JSON.parse(e.data);
					recentAudits = [log, ...recentAudits].slice(0, 5);
				} catch {}
			});
			es.addEventListener('heartbeat', () => { liveConnected = true; });
		}
	}
</script>

<PageHeader title="لوحة التحكم" subtitle="نظرة شاملة على حالة المنصة" />

{#if loading}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
		{#each Array(6) as _}
			<div class="panel p-5"><div class="skeleton h-20"></div></div>
		{/each}
	</div>
{:else if error}
	<div class="panel panel-rose p-4 text-center text-[var(--rose)]">{error}</div>
{:else}
	<!-- Stats Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
		<StatCard
			title="إجمالي المستخدمين"
			value={formatCompact(stats?.totalUsers || 0)}
			subtitle="مستخدم مسجل"
			accent="#f5b544"
			sparkline={generateAreaChart(42, undefined, undefined, '#f5b544')}
		>
			{#snippet icon()}<Users size={18} />{/snippet}
		</StatCard>

		<StatCard
			title="إجمالي الطلبات"
			value={formatCompact(stats?.totalOrders || 0)}
			subtitle="طلب تداول"
			accent="#a855f7"
			sparkline={generateAreaChart(77, undefined, undefined, '#a855f7')}
		>
			{#snippet icon()}<TrendingUp size={18} />{/snippet}
		</StatCard>

		<StatCard
			title="إجمالي المعاملات"
			value={formatCompact(stats?.totalTransactions || 0)}
			subtitle="معاملة مالية"
			accent="#3b82f6"
			sparkline={generateAreaChart(13, undefined, undefined, '#3b82f6')}
		>
			{#snippet icon()}<ArrowLeftRight size={18} />{/snippet}
		</StatCard>

		<StatCard
			title="طلبات السحب المعلقة"
			value={stats?.pendingWithdrawals || 0}
			subtitle="بانتظار المراجعة"
			accent="#fb7185"
		>
			{#snippet icon()}<Wallet size={18} />{/snippet}
		</StatCard>

		<StatCard
			title="طلبات الإيداع المعلقة"
			value={stats?.pendingDeposits || 0}
			subtitle="بانتظار التأكيد"
			accent="#22d3a4"
		>
			{#snippet icon()}<Clock size={18} />{/snippet}
		</StatCard>

		<StatCard
			title="طلبات KYC المعلقة"
			value={stats?.pendingKYC || 0}
			subtitle="بانتظار المراجعة"
			accent="#06b6d4"
		>
			{#snippet icon()}<ShieldCheck size={18} />{/snippet}
		</StatCard>
	</div>

	<!-- Recent Activity -->
	<div class="panel p-5">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-sm font-bold flex items-center gap-2">
				<ScrollText size={16} style="color: var(--gold)" />
				آخر العمليات
			</h2>
			<LiveIndicator />
		</div>
		{#if recentAudits.length === 0}
			<p class="text-sm text-[var(--ink-muted)] text-center py-4">لا توجد عمليات حديثة</p>
		{:else}
			<div class="space-y-3">
				{#each recentAudits as log}
					<div class="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
						<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
							style="background: rgba(245,181,68,0.1);">
							<AlertTriangle size={14} style="color: var(--gold)" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{log.action}</p>
							<p class="text-xs text-[var(--ink-muted)] truncate">{log.details}</p>
						</div>
						<div class="text-left flex-shrink-0">
							<p class="text-xs text-[var(--ink-muted)]">{log.username}</p>
							<p class="text-[10px] text-[var(--ink-faint)] tabular-nums">{log.ipAddress}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
