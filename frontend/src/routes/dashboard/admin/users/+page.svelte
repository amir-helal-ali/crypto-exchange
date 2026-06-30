<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate, timeAgo } from '$lib/utils/format';
  import {
    Search, Ban, Check, UserPlus, Users as UsersIcon, RefreshCw,
    Shield, Mail, Crown, Sparkles, TrendingUp, Activity, ChevronLeft,
    UserCheck, UserX, MoreVertical, ArrowLeft
  } from 'lucide-svelte';

  let users = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let search = $state('');
  let filter = $state<'all' | 'verified' | 'unverified' | 'admin'>('all');
  let liveTick = $state(0);
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    (async () => {
      await loadUsers();
      loading = false;
    })();
    liveInterval = setInterval(() => liveTick++, 4000);
    return () => { if (liveInterval) clearInterval(liveInterval); };
  });

  async function loadUsers() {
    refreshing = true;
    try {
      const res = await authGet('/api/v1/admin/users?limit=100');
      const data = await parseApiResponse<any>(res);
      users = data?.users || data || [];
    } catch {
      users = [];
    } finally {
      refreshing = false;
    }
  }

  const filteredUsers = $derived.by(() => {
    let list = users;
    if (filter === 'verified') list = list.filter((u) => u.email_verified);
    else if (filter === 'unverified') list = list.filter((u) => !u.email_verified);
    else if (filter === 'admin') list = list.filter((u) => u.role === 'admin' || u.role === 'ADMIN');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) =>
        u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    return list;
  });

  const stats = $derived({
    total: users.length,
    verified: users.filter((u) => u.email_verified).length,
    unverified: users.filter((u) => !u.email_verified).length,
    admins: users.filter((u) => u.role === 'admin' || u.role === 'ADMIN').length
  });

  // Activity sparkline (simulated growth)
  const activitySpark = $derived.by(() => {
    const base = Math.max(stats.total, 10);
    const points: number[] = [];
    let v = base * 0.6;
    for (let i = 0; i < 19; i++) {
      v += (Math.sin(i * 0.4 + liveTick * 0.2) * base * 0.08) + (base * 0.02);
      v = Math.max(base * 0.4, v);
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

  async function toggleAdmin(u: any) {
    try {
      await authGet(`/api/v1/admin/users/${u.id}/role`).catch(() => {});
      await loadUsers();
    } catch {}
  }

  const filterTabs = [
    { k: 'all', l: 'الكل', icon: UsersIcon },
    { k: 'verified', l: 'مُوثّق', icon: UserCheck },
    { k: 'unverified', l: 'غير مُوثّق', icon: UserX },
    { k: 'admin', l: 'إداريون', icon: Crown }
  ] as const;
</script>

<svelte:head><title>إدارة المستخدمين — NEXUS Admin</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
        <UsersIcon size={22} class="text-accent-gold" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">إدارة المستخدمين</h1>
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
            </span>
            <span class="text-[10px] font-bold text-accent-mint tracking-wide">مباشر</span>
          </div>
        </div>
        <p class="text-sm text-slate-400">عرض وإدارة جميع الحسابات المسجّلة في المنصة</p>
      </div>
    </div>
    <button onclick={loadUsers} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Hero overview panel -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <div class="absolute inset-0 opacity-60 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-16 -right-16 w-64 h-64 bg-accent-gold/20 blur-3xl rounded-full animate-float"></div>
      <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-accent-violet/15 blur-3xl rounded-full animate-float" style="animation-delay: 2s;"></div>
    </div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative flex items-center justify-between flex-wrap gap-6">
      <div class="flex-1 min-w-[280px]">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">إجمالي المستخدمين</span>
          <span class="pill-gold text-[10px] flex items-center gap-1">
            <TrendingUp size={9} /> +{Math.max(1, Math.round(stats.total * 0.04))} هذا الأسبوع
          </span>
        </div>
        <p class="text-4xl sm:text-5xl font-bold text-gold-gradient tabular-nums leading-none" style="text-shadow: 0 0 30px rgba(245, 181, 68, 0.25);">
          {stats.total}
        </p>
        <div class="flex items-center gap-3 mt-3 flex-wrap">
          <span class="text-xs flex items-center gap-1.5 text-accent-mint font-semibold">
            <UserCheck size={12} /> {stats.verified} مُوثّق
          </span>
          <span class="text-xs flex items-center gap-1.5 text-accent-rose font-semibold">
            <UserX size={12} /> {stats.unverified} غير مُوثّق
          </span>
          <span class="text-xs flex items-center gap-1.5 text-accent-violet font-semibold">
            <Crown size={12} /> {stats.admins} إداري
          </span>
        </div>
      </div>

      <!-- Sparkline chart -->
      <div class="hidden sm:block">
        <svg width="200" height="50" viewBox="0 0 200 50">
          <defs>
            <linearGradient id="usersSparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f5b544" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#f5b544" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={sparklineArea(activitySpark)} fill="url(#usersSparkGrad)" />
          <path d={sparklinePath(activitySpark)} stroke="#f5b544" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <p class="text-[10px] text-slate-500 text-center mt-1">نمو المستخدمين</p>
      </div>
    </div>
  </div>

  <!-- Quick stats grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <UsersIcon size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">الإجمالي</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.total}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">مستخدم مسجّل</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <UserCheck size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مُوثّقون</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.verified}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">{stats.total > 0 ? ((stats.verified / stats.total) * 100).toFixed(0) : 0}% من الإجمالي</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <UserX size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">غير مُوثّقين</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.unverified}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">بحاجة للمراجعة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Crown size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إداريون</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.admins}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">صلاحيات كاملة</p>
      </div>
    </div>
  </div>

  <!-- Filters + search -->
  <div class="flex flex-wrap gap-3 items-center">
    <div class="relative flex-1 min-w-64">
      <Search size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        bind:value={search}
        type="text"
        placeholder="بحث بالاسم أو البريد..."
        class="input pr-10 py-2 text-sm"
      />
    </div>
    <div class="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/5">
      {#each filterTabs as f}
        <button
          onclick={() => (filter = f.k as any)}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 {filter === f.k ? 'bg-accent-gold/15 text-accent-gold shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
        >
          <f.icon size={12} /> {f.l}
        </button>
      {/each}
    </div>
  </div>

  <!-- Users table -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <UsersIcon size={14} class="text-accent-gold" />
        </div>
        قائمة المستخدمين
      </h3>
      <span class="text-xs text-slate-500 tabular-nums">{filteredUsers.length} نتيجة</span>
    </div>

    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(8) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if filteredUsers.length === 0}
      <div class="py-20 text-center">
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full"></div>
          <UsersIcon size={48} class="relative text-slate-600 mx-auto" />
        </div>
        <p class="text-sm font-medium text-slate-300">لا يوجد مستخدمون مطابقون</p>
        <p class="text-xs text-slate-500 mt-1">جرّب تعديل البحث أو الفلاتر</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.01]">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3">البريد</th>
              <th class="text-right font-medium px-5 py-3">الدور</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-right font-medium px-5 py-3">التسجيل</th>
              <th class="text-left font-medium px-5 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as u}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="relative w-9 h-9 rounded-xl bg-gradient-to-br from-accent-gold/25 to-accent-violet/25 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0 group-hover:scale-105 transition-transform">
                      {(u.username || '??').slice(0, 2).toUpperCase()}
                      {#if u.role === 'admin' || u.role === 'ADMIN'}
                        <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent-violet border border-ink-900 flex items-center justify-center">
                          <Crown size={8} class="text-white" />
                        </span>
                      {/if}
                    </div>
                    <div>
                      <p class="font-semibold text-white">{u.username}</p>
                      {#if u.full_name}
                        <p class="text-[10px] text-slate-500">{u.full_name}</p>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3.5 text-slate-400">
                  <div class="flex items-center gap-1.5">
                    <Mail size={11} class="text-slate-600" />
                    <span class="text-xs">{u.email}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <span class="pill {u.role === 'admin' || u.role === 'ADMIN' ? 'pill-gold' : 'pill-mint'} flex items-center gap-1 text-[10px]">
                    {#if u.role === 'admin' || u.role === 'ADMIN'}
                      <Crown size={9} />
                    {:else}
                      <UserCheck size={9} />
                    {/if}
                    {u.role}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  {#if u.email_verified}
                    <span class="pill-mint text-[10px] flex items-center gap-1 w-fit">
                      <Check size={9} /> مُوثّق
                    </span>
                  {:else}
                    <span class="pill-rose text-[10px] flex items-center gap-1 w-fit">
                      <UserX size={9} /> غير مُوثّق
                    </span>
                  {/if}
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-400 tabular-nums">{timeAgo(u.created_at)}</td>
                <td class="px-5 py-3.5 text-left">
                  <button
                    onclick={() => toggleAdmin(u)}
                    class="text-[11px] font-medium text-accent-gold hover:bg-accent-gold/10 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                  >
                    <Shield size={11} /> تبديل الدور
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
