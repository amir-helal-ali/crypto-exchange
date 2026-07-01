<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet } from '$lib/api/client';
	import { formatNumber, formatUptime } from '$lib/utils/helpers';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import LiveIndicator from '$lib/components/LiveIndicator.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import { Wifi, Users, Server, Cpu, HardDrive, Activity } from 'lucide-svelte';
	import type { MetricsData } from '$lib/api/types';

	let metrics = $state<MetricsData | null>(null);
	let loading = $state(true);
	let error = $state('');
	let refreshInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadMetrics();
		refreshInterval = setInterval(loadMetrics, 10000);
		return () => clearInterval(refreshInterval);
	});

	async function loadMetrics() {
		const res = await authGet<MetricsData>('/api/v1/admin/metrics');
		if (res.success && res.data) { metrics = res.data; error = ''; }
		else if (!metrics) { error = res.error || 'فشل تحميل المقاييس'; }
		loading = false;
	}
</script>

<PageHeader title="الأداء والمراقبة" subtitle="مقاييس البنية التحتية في الوقت الفعلي" />

{#if loading}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(8) as _}<div class="panel p-5"><div class="skeleton h-16"></div></div>{/each}
	</div>
{:else if error}
	<ErrorAlert message={error} onretry={loadMetrics} />
{:else if metrics}
	<div class="flex items-center gap-3 mb-6">
		<LiveIndicator label="تحديث تلقائي كل 10 ثوانٍ" />
		<span class="text-xs text-[var(--ink-muted)] tabular-nums">آخر تحديث: {new Date(metrics.ts * 1000).toLocaleTimeString('ar-EG')}</span>
	</div>

	<!-- WebSocket Stats -->
	<h2 class="text-sm font-bold text-[var(--ink-secondary)] mb-3 flex items-center gap-2"><Wifi size={16} style="color: var(--mint)" />اتصالات WebSocket</h2>
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
		<StatCard title="اتصالات السوق" value={formatNumber(metrics.websocket.market_clients)} accent="#22d3a4">
			{#snippet icon()}<Wifi size={18} />{/snippet}
		</StatCard>
		<StatCard title="اتصالات المستخدمين" value={formatNumber(metrics.websocket.user_clients)} accent="#3b82f6">
			{#snippet icon()}<Users size={18} />{/snippet}
		</StatCard>
		<StatCard title="المستخدمون النشطون" value={formatNumber(metrics.websocket.online_users)} accent="#f5b544">
			{#snippet icon()}<Activity size={18} />{/snippet}
		</StatCard>
	</div>

	<!-- SSE Stats -->
	<h2 class="text-sm font-bold text-[var(--ink-secondary)] mb-3 flex items-center gap-2"><Server size={16} style="color: var(--violet)" />SSE الخادم</h2>
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
		<StatCard title="مشتركي الأدمن" value={formatNumber(metrics.sse.admin_subscribers)} accent="#a855f7">
			{#snippet icon()}<Server size={18} />{/snippet}
		</StatCard>
		<StatCard title="الاتصالات النشطة" value={formatNumber(metrics.sse.active_conns)} accent="#06b6d4">
			{#snippet icon()}<Activity size={18} />{/snippet}
		</StatCard>
		<StatCard title="الحد الأقصى" value={formatNumber(metrics.sse.max_conns)} accent="#5a6478">
			{#snippet icon()}<Server size={18} />{/snippet}
		</StatCard>
	</div>

	<!-- Runtime Stats -->
	<h2 class="text-sm font-bold text-[var(--ink-secondary)] mb-3 flex items-center gap-2"><Cpu size={16} style="color: var(--gold)" />بيئة التشغيل</h2>
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
		<StatCard title="Goroutines" value={formatNumber(metrics.runtime.goroutines)} accent="#f5b544">
			{#snippet icon()}<Cpu size={18} />{/snippet}
		</StatCard>
		<StatCard title="Heap Alloc" value={`${metrics.runtime.heap_alloc_mb.toFixed(1)} MB`} accent="#fb7185">
			{#snippet icon()}<HardDrive size={18} />{/snippet}
		</StatCard>
		<StatCard title="GC Cycles" value={formatNumber(metrics.runtime.num_gc)} accent="#a855f7">
			{#snippet icon()}<Activity size={18} />{/snippet}
		</StatCard>
		<StatCard title="Go Version" value={metrics.runtime.go_version} accent="#22d3a4">
			{#snippet icon()}<Server size={18} />{/snippet}
		</StatCard>
	</div>

	<!-- Upstream -->
	<h2 class="text-sm font-bold text-[var(--ink-secondary)] mb-3 flex items-center gap-2"><Server size={16} style="color: var(--azure)" />مصدر البيانات</h2>
	<div class="panel p-4">
		<div class="grid grid-cols-2 gap-4 text-sm">
			<div><span class="text-[var(--ink-muted)]">Binance: </span><span style="color: {metrics.upstream.binance_connected ? 'var(--mint)' : 'var(--rose)'}">{metrics.upstream.binance_connected ? 'متصل' : 'غير متصل'}</span></div>
			<div><span class="text-[var(--ink-muted)]">الرموز: </span><span>{formatNumber(metrics.upstream.binance_symbols)}</span></div>
			<div><span class="text-[var(--ink-muted)]">الفترات: </span><span>{formatNumber(metrics.upstream.binance_intervals)}</span></div>
			<div><span class="text-[var(--ink-muted)]">Redis Pub/Sub: </span><span style="color: {metrics.upstream.redis_pubsub_enabled ? 'var(--mint)' : 'var(--ink-muted)'}">{metrics.upstream.redis_pubsub_enabled ? 'مفعّل' : 'معطّل'}</span></div>
		</div>
	</div>
{/if}
