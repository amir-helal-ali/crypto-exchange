<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Users,
    ShoppingCart,
    ArrowLeftRight,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    Activity,
    Clock,
    User as UserIcon,
    AlertCircle
  } from 'lucide-svelte';
  import { authGet, API, getToken } from '$lib/api/client';
  import type { AdminStats, AuditLog } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';

  // ─── State ───
  let stats = $state<AdminStats | null>(null);
  let auditLogs = $state<AuditLog[]>([]);
  let loading = $state(true);
  let sseConnected = $state(false);
  let error = $state<string | null>(null);

  // ─── Action Labels ───
  const actionLabels: Record<string, string> = {
    REGISTER: 'تسجيل',
    LOGIN: 'تسجيل دخول',
    LOGIN_2FA: 'تسجيل 2FA',
    LOGOUT: 'تسجيل خروج',
    UPDATE_USER_ROLE: 'تحديث دور',
    KYC_SUBMITTED: 'تقديم KYC',
    KYC_APPROVED: 'قبول KYC',
    KYC_REJECTED: 'رفض KYC',
    DEPOSIT_APPROVED: 'قبول إيداع',
    DEPOSIT_REJECTED: 'رفض إيداع',
    WITHDRAWAL_APPROVED: 'قبول سحب',
    WITHDRAWAL_REJECTED: 'رفض سحب',
    ORDER_PLACED: 'طلب جديد',
    ORDER_CANCELLED: 'إلغاء طلب',
    SETTINGS_UPDATE: 'تحديث إعدادات'
  };

  // ─── Action pill classes ───
  const actionPillClass: Record<string, string> = {
    REGISTER: 'pill-azure',
    LOGIN: 'pill-azure',
    LOGIN_2FA: 'pill-violet',
    LOGOUT: 'pill-rose',
    UPDATE_USER_ROLE: 'pill-violet',
    KYC_SUBMITTED: 'pill-azure',
    KYC_APPROVED: 'pill-mint',
    KYC_REJECTED: 'pill-rose',
    DEPOSIT_APPROVED: 'pill-mint',
    DEPOSIT_REJECTED: 'pill-rose',
    WITHDRAWAL_APPROVED: 'pill-mint',
    WITHDRAWAL_REJECTED: 'pill-rose',
    ORDER_PLACED: 'pill-gold',
    ORDER_CANCELLED: 'pill-rose',
    SETTINGS_UPDATE: 'pill-violet'
  };

  // ─── Stat card config ───
  const statCards = $derived([
    {
      key: 'totalUsers' as const,
      label: 'إجمالي المستخدمين',
      icon: Users,
      accent: 'gold',
      pillClass: 'pill-gold',
      iconBg: 'rgba(245,181,68,0.12)',
      iconColor: '#f5b544',
      sparkColor: '#f5b544'
    },
    {
      key: 'totalOrders' as const,
      label: 'إجمالي الأوامر',
      icon: ShoppingCart,
      accent: 'azure',
      pillClass: 'pill-azure',
      iconBg: 'rgba(59,130,246,0.12)',
      iconColor: '#3b82f6',
      sparkColor: '#3b82f6'
    },
    {
      key: 'totalTransactions' as const,
      label: 'إجمالي المعاملات',
      icon: ArrowLeftRight,
      accent: 'violet',
      pillClass: 'pill-violet',
      iconBg: 'rgba(168,85,247,0.12)',
      iconColor: '#a855f7',
      sparkColor: '#a855f7'
    },
    {
      key: 'pendingDeposits' as const,
      label: 'إيداعات معلقة',
      icon: TrendingUp,
      accent: 'mint',
      pillClass: 'pill-mint',
      iconBg: 'rgba(34,211,164,0.12)',
      iconColor: '#22d3a4',
      sparkColor: '#22d3a4'
    },
    {
      key: 'pendingWithdrawals' as const,
      label: 'سحوبات معلقة',
      icon: TrendingDown,
      accent: 'rose',
      pillClass: 'pill-rose',
      iconBg: 'rgba(244,63,122,0.12)',
      iconColor: '#f43f7a',
      sparkColor: '#f43f7a'
    },
    {
      key: 'pendingKYC' as const,
      label: 'طلبات KYC معلقة',
      icon: ShieldCheck,
      accent: 'azure',
      pillClass: 'pill-azure',
      iconBg: 'rgba(59,130,246,0.12)',
      iconColor: '#3b82f6',
      sparkColor: '#3b82f6'
    }
  ]);

  // ─── Sparkline generator ───
  function generateSparkline(color: string, seed: number = 0): string {
    const points: string[] = [];
    const width = 80;
    const height = 28;
    const steps = 8;
    let y = height / 2;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      // deterministic-ish variation using seed
      const variation = Math.sin(seed * 7 + i * 3.7) * 6;
      y = Math.max(4, Math.min(height - 4, height / 2 + variation));
      points.push(`${x},${y}`);
    }
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-30">
      <polyline points="${points.join(' ')}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`;
  }

  // ─── Format number ───
  function formatNum(n: number): string {
    return n.toLocaleString('ar-EG');
  }

  // ─── Format date ───
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ─── Get action label ───
  function getActionLabel(action: string): string {
    return actionLabels[action] || action;
  }

  // ─── Get action pill ───
  function getActionPill(action: string): string {
    return actionPillClass[action] || 'pill-azure';
  }

  // ─── Fetch data ───
  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/stats');
      if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
      const json = await res.json();
      if (json.success) {
        stats = json.data;
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function fetchAuditLogs() {
    try {
      const res = await authGet('/api/v1/admin/audit-logs?limit=5');
      if (!res.ok) throw new Error('فشل تحميل سجل المراجعة');
      const json = await res.json();
      if (json.success) {
        auditLogs = json.data;
      }
    } catch (e: any) {
      // non-fatal
      console.warn('Audit logs fetch failed:', e);
    }
  }

  // ─── SSE ───
  function connectSSE() {
    const es = createAdminStream(['stats', 'audit']);
    if (!es) return;

    es.onopen = () => {
      sseConnected = true;
    };

    es.addEventListener('stats', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data) {
          stats = data;
        }
      } catch {}
    });

    es.addEventListener('audit', (e) => {
      try {
        const entry: AuditLog = JSON.parse(e.data);
        if (entry) {
          auditLogs = [entry, ...auditLogs].slice(0, 5);
        }
      } catch {}
    });

    es.onerror = () => {
      sseConnected = false;
      // Reconnect after 5s
      setTimeout(() => {
        es.close();
        connectSSE();
      }, 5000);
    };

    return es;
  }

  // ─── Lifecycle ───
  let eventSource: EventSource | null = $state(null);

  onMount(() => {
    (async () => {
      try {
        await Promise.all([fetchStats(), fetchAuditLogs()]);
      } finally {
        loading = false;
      }
      eventSource = connectSSE() ?? null;
    })();

    return () => {
      eventSource?.close();
    };
  });

  // ─── Skeleton pulse key (for animation) ───
  let skeletonKey = $state(0);
  $effect(() => {
    const id = setInterval(() => (skeletonKey++), 2000);
    return () => clearInterval(id);
  });
</script>

<!-- Aurora Background Blobs -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
  <div
    class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[120px]"
    style="background: var(--accent-gold);"
  ></div>
  <div
    class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
    style="background: var(--accent-violet);"
  ></div>
  <div
    class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.05] blur-[100px]"
    style="background: var(--accent-mint);"
  ></div>
  <div
    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px]"
    style="background: var(--accent-azure);"
  ></div>
</div>

<!-- Main Content -->
<div class="relative z-10 p-6 lg:p-8 space-y-8">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">لوحة التحكم</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">نظرة عامة على النظام</p>
    </div>

    <!-- Live Indicator -->
    <div class="flex items-center gap-3">
      {#if sseConnected}
        <span class="pill-mint">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: #22d3a4;"></span>
            <span class="relative inline-flex rounded-full h-2 w-2" style="background: #22d3a4;"></span>
          </span>
          مباشر
        </span>
      {:else}
        <span class="pill-rose">
          <span class="inline-flex rounded-full h-2 w-2" style="background: #f43f7a;"></span>
          غير متصل
        </span>
      {/if}
    </div>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3 border-rose-500/30" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
    </div>
  {/if}

  <!-- Stat Cards Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
    {#each statCards as card, i}
      <div class="stat-card group">
        {#if loading}
          <!-- Skeleton -->
          <div class="flex items-start justify-between">
            <div class="space-y-3 flex-1">
              <div class="animate-shimmer h-4 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
              <div class="animate-shimmer h-8 w-32 rounded" style="background: rgba(255,255,255,0.06);"></div>
            </div>
            <div class="animate-shimmer h-12 w-12 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
          </div>
          <div class="animate-shimmer h-7 w-full mt-4 rounded" style="background: rgba(255,255,255,0.04);"></div>
        {:else if stats}
          <!-- Icon + Label row -->
          <div class="flex items-start justify-between">
            <div class="space-y-1 flex-1">
              <p class="text-xs font-medium" style="color: var(--text-tertiary);">{card.label}</p>
              <p class="text-3xl font-bold font-mono tabular-nums" style="color: {card.iconColor};">
                {formatNum(stats[card.key])}
              </p>
            </div>
            <div
              class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
              style="background: {card.iconBg};"
            >
              <card.icon size={22} style="color: {card.iconColor};" />
            </div>
          </div>

          <!-- Sparkline -->
          <div class="mt-4 -mb-1 flex justify-end">
            {@html generateSparkline(card.sparkColor, i)}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Recent Audit Logs -->
  <div class="panel p-6">
    <div class="flex items-center gap-3 mb-5">
      <Activity size={20} style="color: var(--accent-violet);" />
      <h2 class="text-lg font-bold">سجل المراجعة الأخير</h2>
    </div>

    {#if loading}
      <!-- Table Skeleton -->
      <div class="space-y-4">
        {#each Array(5) as _}
          <div class="flex items-center gap-4">
            <div class="animate-shimmer h-8 w-8 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
            <div class="flex-1 space-y-2">
              <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.06);"></div>
              <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.04);"></div>
            </div>
            <div class="animate-shimmer h-6 w-20 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
          </div>
        {/each}
      </div>
    {:else if auditLogs.length > 0}
      <!-- Audit Table -->
      <div class="overflow-x-auto scrollbar-none -mx-2">
        <table class="w-full text-sm">
          <thead>
            <tr style="color: var(--text-tertiary);" class="text-xs">
              <th class="text-right py-3 px-3 font-medium">المستخدم</th>
              <th class="text-right py-3 px-3 font-medium">الإجراء</th>
              <th class="text-right py-3 px-3 font-medium hidden md:table-cell">التفاصيل</th>
              <th class="text-right py-3 px-3 font-medium hidden lg:table-cell">عنوان IP</th>
              <th class="text-right py-3 px-3 font-medium">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {#each auditLogs as log (log.id)}
              <tr
                class="border-t transition-colors hover:bg-white/[0.02]"
                style="border-color: var(--border-subtle);"
              >
                <td class="py-3 px-3">
                  <div class="flex items-center gap-2">
                    <div
                      class="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                      style="background: rgba(59,130,246,0.12); color: #3b82f6;"
                    >
                      {log.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span class="font-medium truncate max-w-[120px]">{log.username || '—'}</span>
                  </div>
                </td>
                <td class="py-3 px-3">
                  <span class={getActionPill(log.action)}>
                    {getActionLabel(log.action)}
                  </span>
                </td>
                <td class="py-3 px-3 hidden md:table-cell">
                  <span class="truncate block max-w-[200px]" style="color: var(--text-secondary);">
                    {log.details || '—'}
                  </span>
                </td>
                <td class="py-3 px-3 hidden lg:table-cell">
                  <span class="font-mono text-xs" style="color: var(--text-quaternary);">
                    {log.ipAddress || '—'}
                  </span>
                </td>
                <td class="py-3 px-3">
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
      <!-- Empty state -->
      <div class="text-center py-12" style="color: var(--text-quaternary);">
        <Activity size={40} class="mx-auto mb-3 opacity-30" />
        <p class="text-sm">لا توجد سجلات مراجعة حتى الآن</p>
      </div>
    {/if}
  </div>
</div>
