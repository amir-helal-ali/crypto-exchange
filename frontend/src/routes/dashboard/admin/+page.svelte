<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate, timeAgo } from '$lib/utils/format';
  import { Users, DollarSign, TrendingUp, Activity, FileText, ArrowRightLeft, Settings } from 'lucide-svelte';

  let stats = $state({ users: 0, dailyVolume: 0, orders: 0, pendingKyc: 0 });
  let recentUsers = $state<any[]>([]);
  let loading = $state(true);

  onMount(() => {
(async () => {
    await Promise.all([loadStats(), loadRecentUsers()]);
    loading = false;
  
  })();
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
</script>

<svelte:head><title>لوحة الإدارة — NEXUS</title></svelte:head>

<div class="space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">لوحة الإدارة</h1>
    <p class="text-sm text-slate-400 mt-1">نظرة عامة على المنصة</p>
  </div>

  <!-- Stats grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-azure/10 border border-accent-azure/20 flex items-center justify-center">
          <Users size={20} class="text-accent-azure" />
        </div>
        <span class="text-[10px] uppercase tracking-wider text-slate-500">المستخدمين</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{stats.users}</p>
      <p class="text-xs text-slate-400 mt-1">إجمالي المسجّلين</p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
          <DollarSign size={20} class="text-accent-mint" />
        </div>
        <span class="text-[10px] uppercase tracking-wider text-slate-500">حجم اليوم</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">${formatPrice(stats.dailyVolume)}</p>
      <p class="text-xs text-accent-mint mt-1">إجمالي التداول</p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <Activity size={20} class="text-accent-gold" />
        </div>
        <span class="text-[10px] uppercase tracking-wider text-slate-500">الصفقات</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{stats.orders}</p>
      <p class="text-xs text-slate-400 mt-1">إجمالي الصفقات</p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
          <FileText size={20} class="text-accent-violet" />
        </div>
        <span class="text-[10px] uppercase tracking-wider text-slate-500">KYC معلّق</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{stats.pendingKyc}</p>
      <p class="text-xs text-accent-gold mt-1">بانتظار المراجعة</p>
    </div>
  </div>

  <!-- Recent users -->
  <div class="panel overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <h3 class="text-sm font-bold text-white">آخر المستخدمين</h3>
      <a href="/dashboard/admin/users" class="text-xs text-accent-gold hover:underline">عرض الكل</a>
    </div>
    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if recentUsers.length === 0}
      <div class="py-10 text-center text-slate-500 text-sm">لا يوجد مستخدمون</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3">البريد</th>
              <th class="text-right font-medium px-5 py-3">الدور</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-left font-medium px-5 py-3">التسجيل</th>
            </tr>
          </thead>
          <tbody>
            {#each recentUsers as u}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td class="px-5 py-3 font-semibold text-white">{u.username}</td>
                <td class="px-5 py-3 text-slate-400">{u.email}</td>
                <td class="px-5 py-3">
                  <span class="pill {u.role === 'admin' ? 'pill-gold' : 'pill-mint'}">{u.role}</span>
                </td>
                <td class="px-5 py-3">
                  {#if u.email_verified}
                    <span class="pill-mint text-[10px]">مُوثّق</span>
                  {:else}
                    <span class="pill-rose text-[10px]">غير مُوثّق</span>
                  {/if}
                </td>
                <td class="px-5 py-3 text-left text-xs text-slate-400">{timeAgo(u.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
