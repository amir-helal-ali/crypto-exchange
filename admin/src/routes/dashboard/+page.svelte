<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Users, ShoppingCart, ArrowLeftRight, TrendingUp, TrendingDown,
    ShieldCheck, Activity, Clock, AlertCircle
  } from 'lucide-svelte';
  import { authGet } from '$lib/api/client';
  import type { AdminStats, AuditLog } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatNumber, formatDate, getActionLabel, getActionPill } from '$lib/utils/helpers';
  import StatCard from '$lib/components/StatCard.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  // ─── State ───
  let stats = $state<AdminStats | null>(null);
  let auditLogs = $state<AuditLog[]>([]);
  let loading = $state(true);
  let sseConnected = $state(false);
  let error = $state<string | null>(null);

  // ─── Stat Card Config ───
  const statCards = [
    { key: 'totalUsers' as const, label: 'إجمالي المستخدمين', icon: Users, iconColor: '#f5b544', iconBg: 'rgba(245,181,68,0.12)', sparkColor: '#f5b544' },
    { key: 'totalOrders' as const, label: 'إجمالي الأوامر', icon: ShoppingCart, iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)', sparkColor: '#3b82f6' },
    { key: 'totalTransactions' as const, label: 'إجمالي المعاملات', icon: ArrowLeftRight, iconColor: '#a855f7', iconBg: 'rgba(168,85,247,0.12)', sparkColor: '#a855f7' },
    { key: 'pendingDeposits' as const, label: 'إيداعات معلقة', icon: TrendingUp, iconColor: '#22d3a4', iconBg: 'rgba(34,211,164,0.12)', sparkColor: '#22d3a4' },
    { key: 'pendingWithdrawals' as const, label: 'سحوبات معلقة', icon: TrendingDown, iconColor: '#f43f7a', iconBg: 'rgba(244,63,122,0.12)', sparkColor: '#f43f7a' },
    { key: 'pendingKYC' as const, label: 'طلبات KYC معلقة', icon: ShieldCheck, iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)', sparkColor: '#3b82f6' }
  ];

  // ─── Fetch Data ───
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
      const res = await authGet('/api/v1/admin/audit-logs?limit=5');
      if (!res.ok) throw new Error('فشل تحميل سجل المراجعة');
      const json = await res.json();
      if (json.success) auditLogs = json.data;
    } catch { /* non-fatal */ }
  }

  // ─── SSE ───
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
        if (entry) auditLogs = [entry, ...auditLogs].slice(0, 5);
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
  <div class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[120px]" style="background: var(--accent-gold);"></div>
  <div class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]" style="background: var(--accent-violet);"></div>
  <div class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.05] blur-[100px]" style="background: var(--accent-mint);"></div>
</div>

<!-- Main Content -->
<div class="relative z-10 space-y-8">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">لوحة التحكم</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">نظرة عامة على النظام</p>
    </div>
    <LiveIndicator connected={sseConnected} />
  </div>

  <!-- Error -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
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
        sparkColor={card.sparkColor}
        sparkSeed={i}
        loading={loading}
      />
    {/each}
  </div>

  <!-- Recent Audit Logs -->
  <div class="panel p-6">
    <div class="flex items-center gap-3 mb-5">
      <Activity size={20} style="color: var(--accent-violet);" />
      <h2 class="text-lg font-bold">سجل المراجعة الأخير</h2>
    </div>

    {#if loading}
      <div class="space-y-4">
        {#each Array(5) as _}
          <div class="flex items-center gap-4">
            <div class="animate-shimmer h-8 w-8 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
            <div class="flex-1 space-y-2">
              <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.06);"></div>
              <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.04);"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if auditLogs.length > 0}
      <div class="overflow-x-auto scrollbar-none -mx-2">
        <table class="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th class="hidden md:table-cell">التفاصيل</th>
              <th class="hidden lg:table-cell">عنوان IP</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody>
            {#each auditLogs as log (log.id)}
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style="background: rgba(59,130,246,0.12); color: #3b82f6;">
                      {log.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span class="font-medium truncate max-w-[120px]">{log.username || '—'}</span>
                  </div>
                </td>
                <td><span class={getActionPill(log.action)}>{getActionLabel(log.action)}</span></td>
                <td class="hidden md:table-cell"><span class="truncate block max-w-[200px]" style="color: var(--text-secondary);">{log.details || '—'}</span></td>
                <td class="hidden lg:table-cell"><span class="font-mono text-xs" style="color: var(--text-quaternary);">{log.ipAddress || '—'}</span></td>
                <td>
                  <div class="flex items-center gap-1.5" style="color: var(--text-tertiary);">
                    <Clock size={12} />
                    <span class="text-xs whitespace-nowrap">{formatDate(log.createdAt)}</span>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <EmptyState icon={Activity} title="لا توجد سجلات مراجعة" description="ستظهر سجلات المراجعة هنا عند تسجيل أي نشاط" />
    {/if}
  </div>
</div>
