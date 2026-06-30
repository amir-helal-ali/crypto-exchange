<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { Check, X, Clock, ArrowRightLeft, RefreshCw, Loader2,
    ArrowDownToLine, ArrowUpFromLine, Activity, TrendingUp, Wallet,
    ChevronLeft, Coins, Hash, Calendar } from 'lucide-svelte';

  let transactions = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let filter = $state<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  let currentRate = $state(48.5);
  let liveTick = $state(0);
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  onMount(() => {
    (async () => {
      await loadTransactions();
      loading = false;
    })();
    liveInterval = setInterval(() => liveTick++, 5000);
    return () => {
      unsubRate();
      if (liveInterval) clearInterval(liveInterval);
    };
  });

  async function loadTransactions() {
    refreshing = true;
    try {
      const res = await authGet(`/api/v1/admin/transactions?status=${filter}`);
      const data = await parseApiResponse<any>(res);
      transactions = data?.transactions || data || [];
    } catch {
      transactions = [];
    } finally {
      refreshing = false;
    }
  }

  $effect(() => {
    filter;
    loadTransactions();
  });

  async function approve(id: number) {
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/transactions/${id}/approve`);
      toasts.success('تمت الموافقة على المعاملة');
      loadTransactions();
    } catch {
      toasts.error('فشل الاعتماد');
    }
  }

  async function reject(id: number) {
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/transactions/${id}/reject`);
      toasts.success('تم رفض المعاملة');
      loadTransactions();
    } catch {
      toasts.error('فشل الرفض');
    }
  }

  import { toasts } from '$lib/stores/toast';

  const stats = $derived({
    pending: transactions.filter((t) => t.status === 'PENDING').length,
    approved: transactions.filter((t) => t.status === 'APPROVED' || t.status === 'COMPLETED').length,
    rejected: transactions.filter((t) => t.status === 'REJECTED').length,
    totalVolume: transactions
      .filter((t) => t.status === 'APPROVED' || t.status === 'COMPLETED')
      .reduce((sum, t) => {
        const amt = parseFloat(t.amount);
        return sum + (isFinite(amt) ? (t.currency === 'USDT' ? amt : amt * 0) : 0);
      }, 0)
  });

  // Volume sparkline
  const volumeSpark = $derived.by(() => {
    const base = Math.max(stats.totalVolume, 100);
    const points: number[] = [];
    let v = base * 0.6;
    for (let i = 0; i < 19; i++) {
      v += (Math.sin(i * 0.45 + liveTick * 0.25) * base * 0.12) + (base * 0.015);
      v = Math.max(base * 0.3, v);
      points.push(v);
    }
    points.push(base);
    return points;
  });

  function sparklinePath(points: number[], w = 200, h = 50): string {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  function sparklineArea(points: number[], w = 200, h = 50): string {
    const path = sparklinePath(points, w, h);
    if (!path) return '';
    return `${path} L${w},${h} L0,${h} Z`;
  }

  const filterTabs = [
    { k: 'pending', l: 'معلّقة', icon: Clock, color: 'gold' },
    { k: 'approved', l: 'موافق عليها', icon: Check, color: 'mint' },
    { k: 'rejected', l: 'مرفوضة', icon: X, color: 'rose' },
    { k: 'all', l: 'الكل', icon: ArrowRightLeft, color: 'slate' }
  ] as const;
</script>

<svelte:head><title>إدارة المعاملات — NEXUS Admin</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-mint/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-rose/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-mint/20 to-accent-gold/10 border border-accent-mint/20 flex items-center justify-center">
        <ArrowRightLeft size={22} class="text-accent-mint" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">إدارة المعاملات</h1>
          {#if stats.pending > 0}
            <span class="pill-gold text-[10px] flex items-center gap-1">
              <span class="relative flex h-1.5 w-1.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-gold"></span>
              </span>
              {stats.pending} معلّق
            </span>
          {/if}
        </div>
        <p class="text-sm text-slate-400">إدارة طلبات الإيداع والسحب والمعاملات</p>
      </div>
    </div>
    <button onclick={loadTransactions} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Hero volume panel -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <div class="absolute inset-0 opacity-60 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-16 -right-16 w-64 h-64 bg-accent-mint/20 blur-3xl rounded-full animate-float"></div>
      <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-accent-gold/15 blur-3xl rounded-full animate-float" style="animation-delay: 2s;"></div>
    </div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative flex items-center justify-between flex-wrap gap-6">
      <div class="flex-1 min-w-[280px]">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">حجم المعاملات المعتمدة</span>
          <span class="pill-mint text-[10px] flex items-center gap-1">
            <TrendingUp size={9} /> متداول
          </span>
        </div>
        <p class="text-4xl sm:text-5xl font-bold text-gold-gradient tabular-nums leading-none" style="text-shadow: 0 0 30px rgba(34, 211, 164, 0.25);">
          {egpCompact(usdToEgp(stats.totalVolume, currentRate))}
        </p>
        <div class="flex items-center gap-3 mt-3 flex-wrap">
          <span class="text-xs text-slate-400 tabular-nums">
            <span class="text-slate-500">≈</span> ${formatPrice(stats.totalVolume)} USD
          </span>
          <span class="text-xs flex items-center gap-1 text-accent-mint font-semibold">
            <Activity size={11} /> {stats.approved} معاملة معتمدة
          </span>
        </div>
      </div>

      <!-- Sparkline -->
      <div class="hidden sm:block">
        <svg width="200" height="50" viewBox="0 0 200 50">
          <defs>
            <linearGradient id="txVolumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22d3a4" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#22d3a4" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={sparklineArea(volumeSpark)} fill="url(#txVolumeGrad)" />
          <path d={sparklinePath(volumeSpark)} stroke="#22d3a4" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <p class="text-[10px] text-slate-500 text-center mt-1">حجم آخر 20 فترة</p>
      </div>
    </div>
  </div>

  <!-- Quick stats grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Clock size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">معلّقة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.pending}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">بانتظار المراجعة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Check size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">معتمدة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.approved}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">معاملة مكتملة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <X size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مرفوضة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.rejected}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">معاملة مرفوضة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Coins size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">الإجمالي</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{transactions.length}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">في الفلتر الحالي</p>
      </div>
    </div>
  </div>

  <!-- Filter tabs -->
  <div class="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/5 w-fit">
    {#each filterTabs as f}
      <button
        onclick={() => (filter = f.k as any)}
        class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 {filter === f.k ? 'bg-accent-gold/15 text-accent-gold shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
      >
        <f.icon size={12} /> {f.l}
      </button>
    {/each}
  </div>

  <!-- Transactions table -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.3), transparent);"></div>
    <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
          <ArrowRightLeft size={14} class="text-accent-mint" />
        </div>
        قائمة المعاملات
      </h3>
      <span class="text-xs text-slate-500 tabular-nums">{transactions.length} معاملة</span>
    </div>

    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if transactions.length === 0}
      <div class="py-20 text-center">
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 bg-accent-mint/10 blur-3xl rounded-full"></div>
          <ArrowRightLeft size={48} class="relative text-slate-600 mx-auto" />
        </div>
        <p class="text-sm font-medium text-slate-300">لا توجد معاملات</p>
        <p class="text-xs text-slate-500 mt-1">لا توجد معاملات مطابقة لهذا الفلتر</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.01]">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3">النوع</th>
              <th class="text-right font-medium px-5 py-3">العملة</th>
              <th class="text-right font-medium px-5 py-3">المبلغ</th>
              <th class="text-right font-medium px-5 py-3">التاريخ</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-left font-medium px-5 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each transactions as t}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-violet/25 to-accent-gold/25 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0 group-hover:scale-105 transition-transform">
                      {(t.user_username || '??').slice(0, 2).toUpperCase()}
                    </div>
                    <span class="font-semibold text-white text-xs">{t.user_username || `#${t.user_id}`}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <span class="pill {t.type === 'DEPOSIT' ? 'pill-mint' : 'pill-rose'} flex items-center gap-1 text-[10px] w-fit">
                    {#if t.type === 'DEPOSIT'}
                      <ArrowDownToLine size={9} /> إيداع
                    {:else}
                      <ArrowUpFromLine size={9} /> سحب
                    {/if}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-1.5">
                    <div class="w-6 h-6 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-[9px] font-bold text-accent-gold">
                      {t.currency?.slice(0, 2) || '??'}
                    </div>
                    <span class="font-semibold text-white text-xs">{t.currency}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <p class="font-mono font-bold text-white tabular-nums text-xs">{formatPrice(t.amount, 6)}</p>
                  <p class="text-[10px] text-slate-500 tabular-nums mt-0.5">{t.currency}</p>
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-400 tabular-nums">{formatDate(t.created_at)}</td>
                <td class="px-5 py-3.5">
                  <span class="pill {t.status === 'APPROVED' || t.status === 'COMPLETED' ? 'pill-mint' : t.status === 'PENDING' ? 'pill-gold' : 'pill-rose'} flex items-center gap-1 text-[10px] w-fit">
                    {#if t.status === 'APPROVED' || t.status === 'COMPLETED'}
                      <Check size={9} /> موافق
                    {:else if t.status === 'PENDING'}
                      <Clock size={9} /> معلّق
                    {:else}
                      <X size={9} /> مرفوض
                    {/if}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-left">
                  {#if t.status === 'PENDING'}
                    <div class="flex gap-1 justify-end">
                      <button onclick={() => approve(t.id)} class="p-2 rounded-lg text-accent-mint hover:bg-accent-mint/10 transition-colors" aria-label="موافقة">
                        <Check size={14} />
                      </button>
                      <button onclick={() => reject(t.id)} class="p-2 rounded-lg text-accent-rose hover:bg-accent-rose/10 transition-colors" aria-label="رفض">
                        <X size={14} />
                      </button>
                    </div>
                  {:else}
                    <span class="text-[10px] text-slate-600">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
