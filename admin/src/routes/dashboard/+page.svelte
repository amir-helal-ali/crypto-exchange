<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Users, ShoppingCart, ArrowLeftRight, TrendingUp, TrendingDown,
    ShieldCheck, Activity, Clock, AlertCircle, Zap
  } from 'lucide-svelte';
  import { authGet } from '$lib/api/client';
  import type { AdminStats, AuditLog } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatNumber, formatDate, getActionLabel, getActionPill, formatCompact } from '$lib/utils/helpers';
  import StatCard from '$lib/components/StatCard.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let stats = $state<AdminStats | null>(null);
  let auditLogs = $state<AuditLog[]>([]);
  let loading = $state(true);
  let sseConnected = $state(false);
  let error = $state<string | null>(null);

  const statCards = [
    { key: 'totalUsers' as const, label: 'إجمالي المستخدمين', icon: Users, iconColor: '#f5b544', iconBg: 'rgba(245,181,68,0.1)', chartColor: '#f5b544', sparkSeed: 1 },
    { key: 'totalOrders' as const, label: 'إجمالي الأوامر', icon: ShoppingCart, iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.1)', chartColor: '#3b82f6', sparkSeed: 2 },
    { key: 'totalTransactions' as const, label: 'إجمالي المعاملات', icon: ArrowLeftRight, iconColor: '#a855f7', iconBg: 'rgba(168,85,247,0.1)', chartColor: '#a855f7', sparkSeed: 3 },
    { key: 'pendingDeposits' as const, label: 'إيداعات معلقة', icon: TrendingUp, iconColor: '#22d3a4', iconBg: 'rgba(34,211,164,0.1)', chartColor: '#22d3a4', sparkSeed: 4 },
    { key: 'pendingWithdrawals' as const, label: 'سحوبات معلقة', icon: TrendingDown, iconColor: '#f43f7a', iconBg: 'rgba(244,63,122,0.1)', chartColor: '#f43f7a', sparkSeed: 5 },
    { key: 'pendingKYC' as const, label: 'طلبات KYC معلقة', icon: ShieldCheck, iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.1)', chartColor: '#3b82f6', sparkSeed: 6 }
  ];

  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/stats');
      if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
      const json = await res.json();
      if (json.success) stats = json.data;
    } catch (e: any) { error = e.message; }
  }

  async function fetchAuditLogs() {
    try {
      const res = await authGet('/api/v1/admin/audit-logs?limit=8');
      if (!res.ok) throw new Error('فشل تحميل سجل المراجعة');
      const json = await res.json();
      if (json.success) auditLogs = json.data;
    } catch { /* non-fatal */ }
  }

  let eventSource: EventSource | null = $state(null);

  function connectSSE() {
    const es = createAdminStream(['stats', 'audit']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('stats', (e) => {
      try { const data = JSON.parse(e.data); if (data) stats = data; } catch {}
    });
    es.addEventListener('audit', (e) => {
      try {
        const entry: AuditLog = JSON.parse(e.data);
        if (entry) auditLogs = [entry, ...auditLogs].slice(0, 8);
      } catch {}
    });
    es.onerror = () => {
      sseConnected = false;
      setTimeout(() => { es.close(); connectSSE(); }, 5000);
    };
    return es;
  }

  onMount(() => {
    (async () => {
      await Promise.all([fetchStats(), fetchAuditLogs()]);
      loading = false;
      eventSource = connectSSE() ?? null;
    })();
    return () => { eventSource?.close(); };
  });
</script>

<!-- Aurora Background -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
  <div class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px]" style="background: var(--accent-gold);"></div>
  <div class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]" style="background: var(--accent-violet);"></div>
  <div class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.04] blur-[100px]" style="background: var(--accent-mint);"></div>
</div>

<div class="relative z-10 space-y-8">
  <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على النظام">
    <LiveIndicator connected={sseConnected} />
  </PageHeader>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.2);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
    </div>
  {/if}

  <!-- Stat Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
    {#each statCards as card, i}
      <StatCard
        label={card.label}
        value={stats ? stats[card.key] : 0}
        icon={card.icon}
        iconColor={card.iconColor}
        iconBg={card.iconBg}
        chartColor={card.chartColor}
        chartSeed={card.sparkSeed}
        loading={loading}
      />
    {/each}
  </div>

  <!-- Recent Audit Logs -->
  <div class="panel p-6">
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.1);">
          <Activity size={20} style="color: #a855f7;" />
        </div>
        <div>
          <h2 class="text-lg font-bold">سجل المراجعة الأخير</h2>
          <p class="text-xs" style="color: var(--text-quaternary);">آخر الأنشطة المسجلة</p>
        </div>
      </div>
      <a href="/dashboard/audit-logs" class="btn-ghost text-xs">عرض الكل</a>
    </div>

    {#if loading}
      <div class="space-y-4">
        {#each Array(5) as _}
          <div class="flex items-center gap-4">
            <div class="animate-shimmer h-8 w-8 rounded-full" style="background: rgba(255,255,255,0.04);"></div>
            <div class="flex-1 space-y-2">
              <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.04);"></div>
              <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.03);"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if auditLogs.length > 0}
      <div class="space-y-1">
        {#each auditLogs as log (log.id)}
          <div class="flex items-center gap-4 py-3 px-3 rounded-xl transition-colors hover:bg-white/[0.02]">
            <div class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0" style="background: rgba(59,130,246,0.08); color: #3b82f6;">
              {log.username?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm truncate">{log.username || '—'}</span>
                <span class={getActionPill(log.action)}>{getActionLabel(log.action)}</span>
              </div>
              {#if log.details}
                <p class="text-xs truncate mt-0.5" style="color: var(--text-quaternary);">{log.details}</p>
              {/if}
            </div>
            <div class="flex items-center gap-1.5 shrink-0" style="color: var(--text-quaternary);">
              <Clock size={11} />
              <span class="text-[11px] whitespace-nowrap tabular-nums">{formatDate(log.createdAt)}</span>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center py-8">
        <Activity size={32} style="color: var(--text-quaternary);" />
        <p class="text-sm mt-2" style="color: var(--text-quaternary);">لا توجد سجلات مراجعة</p>
      </div>
    {/if}
  </div>

  <!-- Quick Stats Footer -->
  {#if stats}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="panel p-4 flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(245,181,68,0.08);">
          <Zap size={18} style="color: #f5b544;" />
        </div>
        <div>
          <p class="text-[11px]" style="color: var(--text-quaternary);">المعاملات المعلقة</p>
          <p class="text-lg font-bold tabular-nums" style="color: #f5b544;">{(stats.pendingDeposits || 0) + (stats.pendingWithdrawals || 0)}</p>
        </div>
      </div>
      <div class="panel p-4 flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(168,85,247,0.08);">
          <ShieldCheck size={18} style="color: #a855f7;" />
        </div>
        <div>
          <p class="text-[11px]" style="color: var(--text-quaternary);">KYC معلق</p>
          <p class="text-lg font-bold tabular-nums" style="color: #a855f7;">{stats.pendingKYC || 0}</p>
        </div>
      </div>
      <div class="panel p-4 flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(34,211,164,0.08);">
          <Users size={18} style="color: #22d3a4;" />
        </div>
        <div>
          <p class="text-[11px]" style="color: var(--text-quaternary);">إجمالي المستخدمين</p>
          <p class="text-lg font-bold tabular-nums" style="color: #22d3a4;">{formatCompact(stats.totalUsers || 0)}</p>
        </div>
      </div>
      <div class="panel p-4 flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(59,130,246,0.08);">
          <ShoppingCart size={18} style="color: #3b82f6;" />
        </div>
        <div>
          <p class="text-[11px]" style="color: var(--text-quaternary);">إجمالي الأوامر</p>
          <p class="text-lg font-bold tabular-nums" style="color: #3b82f6;">{formatCompact(stats.totalOrders || 0)}</p>
        </div>
      </div>
    </div>
  {/if}
</div>
