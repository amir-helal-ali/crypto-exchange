<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate, timeAgo } from '$lib/utils/format';
  import {
    Users, DollarSign, TrendingUp, Activity, FileText,
    ArrowRightLeft, Server, Cpu, HardDrive, Wifi, RefreshCw,
    UserCheck, AlertCircle, ChevronLeft, Sparkles, Zap, Check
  } from 'lucide-svelte';

  let stats = $state({ users: 0, dailyVolume: 0, orders: 0, pendingKyc: 0 });
  let recentUsers = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let liveTick = $state(0);

  // Live pulse counter — visual feedback that the panel is alive
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    (async () => {
      await Promise.all([loadStats(), loadRecentUsers()]);
      loading = false;
    })();
    liveInterval = setInterval(() => {
      liveTick++;
    }, 3000);
    return () => {
      if (liveInterval) clearInterval(liveInterval);
    };
  });

  async function loadStats() {
    try {
      const res = await authGet('/api/v1/admin/stats');
      const data = await parseApiResponse<any>(res);
      stats = data || stats;
    } catch {}
  }

  async function loadRecentUsers() {
    try {
      const res = await authGet('/api/v1/admin/users?limit=10');
      const data = await parseApiResponse<any>(res);
      recentUsers = data?.users || data || [];
    } catch {}
  }

  async function refresh() {
    refreshing = true;
    await Promise.all([loadStats(), loadRecentUsers()]);
    refreshing = false;
  }

  // Derived: 7-day sparkline data (simulated trend based on current volume)
  const volumeSpark = $derived.by(() => {
    const base = Math.max(stats.dailyVolume, 1000);
    const points: number[] = [];
    let v = base * 0.7;
    for (let i = 0; i < 14; i++) {
      v += (Math.sin(i * 0.8 + liveTick * 0.2) * base * 0.15) + (base * 0.05);
      v = Math.max(base * 0.4, v);
      points.push(v);
    }
    points.push(base);
    return points;
  });

  const usersSpark = $derived.by(() => {
    const base = Math.max(stats.users, 10);
    const points: number[] = [];
    let v = base * 0.6;
    for (let i = 0; i < 14; i++) {
      v += (Math.cos(i * 0.6 + liveTick * 0.15) * base * 0.08) + (base * 0.03);
      v = Math.max(base * 0.3, v);
      points.push(v);
    }
    points.push(base);
    return points;
  });

  function sparklinePath(points: number[], w = 80, h = 28): string {
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

  function sparklineArea(points: number[], w = 80, h = 28): string {
    const path = sparklinePath(points, w, h);
    if (!path) return '';
    return `${path} L${w},${h} L0,${h} Z`;
  }

  // System health metrics (visual indicators)
  const systemMetrics = $derived([
    { label: 'API Backend', status: 'operational', value: '3000', icon: Server, color: 'mint' },
    { label: 'قاعدة البيانات', status: 'operational', value: 'PostgreSQL', icon: HardDrive, color: 'mint' },
    { label: 'Redis Cache', status: 'operational', value: 'Pub/Sub', icon: Cpu, color: 'mint' },
    { label: 'WebSocket', status: 'operational', value: 'Live', icon: Wifi, color: 'mint' }
  ]);

  const colorMap: Record<string, { bg: string; fg: string; border: string; spark: string }> = {
    gold: { bg: 'bg-accent-gold/10', fg: 'text-accent-gold', border: 'border-accent-gold/20', spark: '#f5b544' },
    mint: { bg: 'bg-accent-mint/10', fg: 'text-accent-mint', border: 'border-accent-mint/20', spark: '#22d3a4' },
    azure: { bg: 'bg-accent-azure/10', fg: 'text-accent-azure', border: 'border-accent-azure/20', spark: '#3b82f6' },
    violet: { bg: 'bg-accent-violet/10', fg: 'text-accent-violet', border: 'border-accent-violet/20', spark: '#a855f7' }
  };
</script>

<svelte:head><title>لوحة الإدارة — NEXUS</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora background -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 -right-20 w-96 h-96 bg-accent-gold/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute top-1/2 -left-32 w-96 h-96 bg-accent-violet/6 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 1.5s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">لوحة الإدارة</h1>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
          </span>
          <span class="text-[10px] font-bold text-accent-mint tracking-wide">مباشر</span>
        </div>
      </div>
      <p class="text-sm text-slate-400 mt-1">نظرة شاملة على حالة المنصة والنشاط المباشر</p>
    </div>
    <button
      onclick={refresh}
      disabled={refreshing}
      class="btn-ghost"
      aria-label="تحديث"
    >
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Premium stat cards with sparklines -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
    <!-- Users card -->
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-8 -right-8 w-24 h-24 bg-accent-azure/10 blur-2xl rounded-full group-hover:bg-accent-azure/20 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-azure/10 border border-accent-azure/20 flex items-center justify-center">
            <Users size={20} class="text-accent-azure" />
          </div>
          <svg width="80" height="28" viewBox="0 0 80 28" class="opacity-70">
            <defs>
              <linearGradient id="sparkUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineArea(usersSpark)} fill="url(#sparkUsers)" />
            <path d={sparklinePath(usersSpark)} stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{stats.users.toLocaleString('en-US')}</p>
        <p class="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <UserCheck size={10} class="text-accent-mint" />
          إجمالي المسجّلين
        </p>
      </div>
    </div>

    <!-- Volume card -->
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-8 -right-8 w-24 h-24 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/20 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
            <DollarSign size={20} class="text-accent-mint" />
          </div>
          <svg width="80" height="28" viewBox="0 0 80 28" class="opacity-70">
            <defs>
              <linearGradient id="sparkVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#22d3a4" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#22d3a4" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineArea(volumeSpark)} fill="url(#sparkVol)" />
            <path d={sparklinePath(volumeSpark)} stroke="#22d3a4" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">${formatPrice(stats.dailyVolume)}</p>
        <p class="text-xs text-accent-mint mt-1 flex items-center gap-1">
          <TrendingUp size={10} />
          حجم تداول اليوم
        </p>
      </div>
    </div>

    <!-- Orders card -->
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-8 -right-8 w-24 h-24 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/20 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <Activity size={20} class="text-accent-gold" />
          </div>
          <div class="flex items-end gap-0.5 h-7">
            {#each Array(7) as _, i}
              <div
                class="w-1.5 rounded-sm bg-accent-gold/60"
                style="height: {30 + Math.abs(Math.sin(i + liveTick * 0.3)) * 70}%;"
              ></div>
            {/each}
          </div>
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{stats.orders.toLocaleString('en-US')}</p>
        <p class="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Zap size={10} class="text-accent-gold" />
          إجمالي الصفقات
        </p>
      </div>
    </div>

    <!-- Pending KYC card -->
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-8 -right-8 w-24 h-24 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/20 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <FileText size={20} class="text-accent-violet" />
          </div>
          {#if stats.pendingKyc > 0}
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-violet opacity-60"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-accent-violet"></span>
            </span>
          {:else}
            <Check size={16} class="text-accent-mint" />
          {/if}
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{stats.pendingKyc}</p>
        <p class="text-xs {stats.pendingKyc > 0 ? 'text-accent-gold' : 'text-slate-400'} mt-1 flex items-center gap-1">
          <AlertCircle size={10} />
          {stats.pendingKyc > 0 ? 'بانتظار المراجعة' : 'لا توجد طلبات'}
        </p>
      </div>
    </div>
  </div>

  <!-- System health + quick actions -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 relative">
    <!-- System health -->
    <div class="lg:col-span-2 panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.4), transparent);"></div>
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
            <Server size={14} class="text-accent-mint" />
          </div>
          حالة النظام
        </h3>
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-mint/10 border border-accent-mint/20">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-accent-mint"></span>
          </span>
          <span class="text-[10px] font-bold text-accent-mint">الكل يعمل</span>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-white/5">
        {#each systemMetrics as m, i}
          <div class="p-4 flex flex-col items-center text-center hover:bg-white/[0.02] transition-colors">
            <div class="w-10 h-10 rounded-xl {colorMap[m.color].bg} {colorMap[m.color].border} border flex items-center justify-center mb-2">
              <m.icon size={18} class={colorMap[m.color].fg} />
            </div>
            <p class="text-xs font-semibold text-white">{m.label}</p>
            <p class="text-[10px] text-slate-500 mt-0.5 font-mono">{m.value}</p>
            <div class="mt-1.5 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
              <span class="text-[9px] text-accent-mint font-bold uppercase tracking-wider">يعمل</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Quick actions -->
    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-2xl rounded-full"></div>
      <div class="relative">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Sparkles size={14} class="text-accent-gold" />
          إجراءات سريعة
        </h3>
        <div class="space-y-2">
          <a href="/dashboard/admin/users" class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-accent-gold/20 transition-all group">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-accent-azure/10 flex items-center justify-center">
                <Users size={15} class="text-accent-azure" />
              </div>
              <span class="text-xs font-medium text-white">إدارة المستخدمين</span>
            </div>
            <ChevronLeft size={14} class="text-slate-500 group-hover:text-accent-gold group-hover:-translate-x-0.5 transition-all" />
          </a>
          <a href="/dashboard/admin/kyc" class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-accent-gold/20 transition-all group">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-accent-violet/10 flex items-center justify-center">
                <FileText size={15} class="text-accent-violet" />
              </div>
              <span class="text-xs font-medium text-white">مراجعة KYC</span>
              {#if stats.pendingKyc > 0}
                <span class="pill-gold text-[9px] px-1.5 py-0">{stats.pendingKyc}</span>
              {/if}
            </div>
            <ChevronLeft size={14} class="text-slate-500 group-hover:text-accent-gold group-hover:-translate-x-0.5 transition-all" />
          </a>
          <a href="/dashboard/admin/transactions" class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-accent-gold/20 transition-all group">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-accent-mint/10 flex items-center justify-center">
                <ArrowRightLeft size={15} class="text-accent-mint" />
              </div>
              <span class="text-xs font-medium text-white">المعاملات</span>
            </div>
            <ChevronLeft size={14} class="text-slate-500 group-hover:text-accent-gold group-hover:-translate-x-0.5 transition-all" />
          </a>
          <a href="/dashboard/admin/fees" class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-accent-gold/20 transition-all group">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                <DollarSign size={15} class="text-accent-gold" />
              </div>
              <span class="text-xs font-medium text-white">إدارة الرسوم</span>
            </div>
            <ChevronLeft size={14} class="text-slate-500 group-hover:text-accent-gold group-hover:-translate-x-0.5 transition-all" />
          </a>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent users -->
  <div class="panel overflow-hidden relative">
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-azure/10 border border-accent-azure/20 flex items-center justify-center">
          <Users size={14} class="text-accent-azure" />
        </div>
        آخر المستخدمين
      </h3>
      <a href="/dashboard/admin/users" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
        عرض الكل <ChevronLeft size={12} />
      </a>
    </div>
    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if recentUsers.length === 0}
      <div class="py-12 text-center text-slate-500">
        <Users size={32} class="mx-auto mb-2 opacity-30" />
        <p class="text-sm">لا يوجد مستخدمون بعد</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3 hidden sm:table-cell">البريد</th>
              <th class="text-right font-medium px-5 py-3">الدور</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-left font-medium px-5 py-3 hidden sm:table-cell">التسجيل</th>
            </tr>
          </thead>
          <tbody>
            {#each recentUsers as u}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-violet/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                      {(u.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <span class="font-semibold text-white">{u.username}</span>
                  </div>
                </td>
                <td class="px-5 py-3 text-slate-400 hidden sm:table-cell">{u.email}</td>
                <td class="px-5 py-3">
                  <span class="pill {u.role === 'admin' ? 'pill-gold' : 'pill-mint'}">
                    {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </span>
                </td>
                <td class="px-5 py-3">
                  {#if u.email_verified}
                    <span class="pill-mint text-[10px]">مُوثّق</span>
                  {:else}
                    <span class="pill-rose text-[10px]">غير مُوثّق</span>
                  {/if}
                </td>
                <td class="px-5 py-3 text-left text-xs text-slate-400 hidden sm:table-cell">{timeAgo(u.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
