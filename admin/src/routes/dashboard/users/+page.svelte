<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search, Users, MailCheck, Shield, AlertCircle, Mail,
    ToggleLeft, ToggleRight, Loader2, Filter, UserCheck, UserX
  } from 'lucide-svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { AdminUser } from '$lib/api/types';
  import type { UserStats } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatDate, getStatusConfig } from '$lib/utils/helpers';

  // ─── State ──────────────────────────────────────────────────
  let users = $state<AdminUser[]>([]);
  let stats = $state<UserStats | null>(null);
  let loading = $state(true);
  let statsLoading = $state(true);
  let error = $state('');
  let searchQuery = $state('');
  let roleFilter = $state('');
  let kycFilter = $state('');
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalUsers = $state(0);
  const limit = 15;
  let sseConnected = $state(false);
  let togglingUserId = $state<number | null>(null);
  let verifyingUserId = $state<number | null>(null);

  // ─── Role helpers ───────────────────────────────────────────
  const roleLabels: Record<string, string> = { ADMIN: 'مدير', USER: 'مستخدم' };
  const rolePillClasses: Record<string, string> = { ADMIN: 'pill-gold', USER: 'pill-azure' };

  // ─── Debounced search ───────────────────────────────────────
  let searchTimeout: ReturnType<typeof setTimeout>;

  $effect(() => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      fetchUsers();
    }, 350);
  });

  // ─── Re-fetch when filters or page change ───────────────────
  $effect(() => {
    roleFilter;
    kycFilter;
    currentPage;
    fetchUsers();
  });

  // ─── API Calls ──────────────────────────────────────────────
  async function fetchUsers() {
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit)
      });
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      if (kycFilter) params.set('kyc_status', kycFilter);

      const res = await authGet(`/api/v1/admin/users?${params}`);
      if (!res.ok) throw new Error('فشل تحميل المستخدمين');
      const json = await res.json();
      if (json.success) {
        users = json.data;
        totalPages = json.pagination.totalPages;
        totalUsers = json.pagination.total;
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ أثناء تحميل المستخدمين';
    }
  }

  async function fetchStats() {
    try {
      statsLoading = true;
      const res = await authGet('/api/v1/admin/users/stats');
      if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
      const json = await res.json();
      if (json.success) stats = json.data;
    } catch {
      /* non-fatal */
    } finally {
      statsLoading = false;
    }
  }

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    togglingUserId = user.id;
    try {
      const res = await authPut(`/api/v1/admin/users/${user.id}/role`, { role: newRole });
      if (!res.ok) throw new Error('فشل تحديث الدور');
      const json = await res.json();
      if (json.success) {
        users = users.map(u => u.id === user.id ? { ...u, role: newRole } : u);
        fetchStats();
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ أثناء تحديث الدور';
    } finally {
      togglingUserId = null;
    }
  }

  async function verifyEmail(user: AdminUser) {
    verifyingUserId = user.id;
    try {
      const res = await authPut(`/api/v1/admin/users/${user.id}/verify-email`);
      if (!res.ok) throw new Error('فشل توثيق البريد');
      const json = await res.json();
      if (json.success) {
        users = users.map(u =>
          u.id === user.id ? { ...u, email_verified: true } : u
        );
        fetchStats();
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ أثناء توثيق البريد';
    } finally {
      verifyingUserId = null;
    }
  }

  // ─── SSE ────────────────────────────────────────────────────
  let eventSource: EventSource | null = null;

  function connectSSE() {
    const es = createAdminStream(['users', 'user-stats']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('users', (e) => {
      try {
        const data: AdminUser = JSON.parse(e.data);
        if (data) {
          users = users.map(u => u.id === data.id ? data : u);
        }
      } catch { /* ignore parse errors */ }
    });
    es.addEventListener('user-stats', (e) => {
      try {
        const data: UserStats = JSON.parse(e.data);
        if (data) stats = data;
      } catch { /* ignore parse errors */ }
    });
    es.onerror = () => {
      sseConnected = false;
      setTimeout(() => { es.close(); connectSSE(); }, 5000);
    };
    eventSource = es;
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  onMount(async () => {
    await Promise.all([fetchUsers(), fetchStats()]);
    loading = false;
    connectSSE();
    return () => { eventSource?.close(); };
  });

  // ─── Helpers ────────────────────────────────────────────────
  function getUserInitials(user: AdminUser): string {
    if (!user.username) return '؟';
    const parts = user.username.trim().split(/\s+/);
    return parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : parts[0].slice(0, 2);
  }

  function getAvatarColor(id: number): string {
    const colors = ['#f5b544', '#a855f7', '#22d3a4', '#3b82f6', '#f43f7a'];
    return colors[id % colors.length];
  }
</script>

<!-- Aurora Background -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
  <div class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px]" style="background: var(--accent-gold);"></div>
  <div class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]" style="background: var(--accent-violet);"></div>
  <div class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.04] blur-[100px]" style="background: var(--accent-mint);"></div>
</div>

<div class="relative z-10 space-y-8">
  <!-- Header -->
  <PageHeader title="إدارة المستخدمين" subtitle="عرض وإدارة حسابات المستخدمين">
    <LiveIndicator connected={sseConnected} />
  </PageHeader>

  <!-- Error Alert -->
  <ErrorAlert message={error} onclose={() => { error = ''; }} />

  <!-- Stats Row -->
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
    <StatCard
      label="إجمالي المستخدمين"
      value={stats?.total ?? 0}
      icon={Users}
      iconColor="#f5b544"
      iconBg="rgba(245,181,68,0.1)"
      chartColor="#f5b544"
      chartSeed={10}
      loading={statsLoading}
    />
    <StatCard
      label="المدراء"
      value={stats?.admins ?? 0}
      icon={Shield}
      iconColor="#a855f7"
      iconBg="rgba(168,85,247,0.1)"
      chartColor="#a855f7"
      chartSeed={11}
      loading={statsLoading}
    />
    <StatCard
      label="بريد موثّق"
      value={stats?.emailVerified ?? 0}
      icon={MailCheck}
      iconColor="#22d3a4"
      iconBg="rgba(34,211,164,0.1)"
      chartColor="#22d3a4"
      chartSeed={12}
      loading={statsLoading}
    />
    <StatCard
      label="KYC موثّق"
      value={stats?.kycVerified ?? 0}
      icon={UserCheck}
      iconColor="#3b82f6"
      iconBg="rgba(59,130,246,0.1)"
      chartColor="#3b82f6"
      chartSeed={13}
      loading={statsLoading}
    />
  </div>

  <!-- Filters & Search -->
  <div class="panel p-5">
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
      <!-- Search -->
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field w-full pr-10 pl-4"
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
          bind:value={searchQuery}
        />
      </div>

      <!-- Role Filter -->
      <div class="relative min-w-[160px]">
        <Filter size={16} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <select class="input-field w-full pr-10 pl-4 appearance-none cursor-pointer" bind:value={roleFilter}>
          <option value="">جميع الأدوار</option>
          <option value="ADMIN">مدير</option>
          <option value="USER">مستخدم</option>
        </select>
      </div>

      <!-- KYC Filter -->
      <div class="relative min-w-[160px]">
        <Filter size={16} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <select class="input-field w-full pr-10 pl-4 appearance-none cursor-pointer" bind:value={kycFilter}>
          <option value="">جميع حالات KYC</option>
          <option value="VERIFIED">موثّق</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="NONE">لا يوجد</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Data Table -->
  <div class="panel overflow-hidden">
    <div class="data-table">
      <table class="w-full">
        <thead>
          <tr class="glass-divider">
            <th class="text-right px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">المستخدم</th>
            <th class="text-right px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">الدور</th>
            <th class="text-right px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">البريد الإلكتروني</th>
            <th class="text-right px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">KYC</th>
            <th class="text-right px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">تاريخ التسجيل</th>
            <th class="text-center px-5 py-4 text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            {#each Array(8) as _}
              <tr class="glass-divider">
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    <div class="animate-shimmer w-9 h-9 rounded-full" style="background: rgba(255,255,255,0.04);"></div>
                    <div class="space-y-2">
                      <div class="animate-shimmer h-3 w-24 rounded" style="background: rgba(255,255,255,0.04);"></div>
                      <div class="animate-shimmer h-2.5 w-16 rounded" style="background: rgba(255,255,255,0.03);"></div>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4"><div class="animate-shimmer h-6 w-16 rounded-full" style="background: rgba(255,255,255,0.04);"></div></td>
                <td class="px-5 py-4"><div class="animate-shimmer h-3 w-32 rounded" style="background: rgba(255,255,255,0.04);"></div></td>
                <td class="px-5 py-4"><div class="animate-shimmer h-6 w-20 rounded-full" style="background: rgba(255,255,255,0.04);"></div></td>
                <td class="px-5 py-4"><div class="animate-shimmer h-3 w-28 rounded" style="background: rgba(255,255,255,0.04);"></div></td>
                <td class="px-5 py-4"><div class="flex justify-center gap-2"><div class="animate-shimmer h-8 w-8 rounded-lg" style="background: rgba(255,255,255,0.04);"></div><div class="animate-shimmer h-8 w-8 rounded-lg" style="background: rgba(255,255,255,0.04);"></div></div></td>
              </tr>
            {/each}
          {:else if users.length > 0}
            {#each users as user (user.id)}
              <tr class="glass-divider transition-colors hover:bg-white/[0.015]">
                <!-- User Column -->
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0"
                      style="background: {getAvatarColor(user.id)}15; color: {getAvatarColor(user.id)};"
                    >
                      {getUserInitials(user)}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold truncate" style="color: var(--text-primary);">{user.username || '—'}</p>
                      <p class="text-[11px] font-mono tabular-nums" style="color: var(--text-quaternary);">#{user.id}</p>
                    </div>
                  </div>
                </td>

                <!-- Role Column -->
                <td class="px-5 py-4">
                  <span class={rolePillClasses[user.role] || 'pill-azure'}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>

                <!-- Email Column -->
                <td class="px-5 py-4">
                  <div class="flex items-center gap-2">
                    <span class="text-sm truncate max-w-[200px]" style="color: var(--text-secondary);">{user.email}</span>
                    {#if user.email_verified}
                      <MailCheck size={14} style="color: #22d3a4;" class="shrink-0" />
                    {:else}
                      <Mail size={14} style="color: var(--text-quaternary);" class="shrink-0" />
                    {/if}
                  </div>
                </td>

                <!-- KYC Column -->
                <td class="px-5 py-4">
                  <span class={getStatusConfig(user.kyc_status || 'NONE').pillClass}>{getStatusConfig(user.kyc_status || 'NONE').label}</span>
                </td>

                <!-- Registration Date Column -->
                <td class="px-5 py-4">
                  <span class="text-sm tabular-nums whitespace-nowrap" style="color: var(--text-tertiary);">
                    {formatDate(user.created_at)}
                  </span>
                </td>

                <!-- Actions Column -->
                <td class="px-5 py-4">
                  <div class="flex items-center justify-center gap-2">
                    <!-- Toggle Role -->
                    <button
                      class="btn-ghost p-2 rounded-lg transition-all duration-200 cursor-pointer"
                      title={user.role === 'ADMIN' ? 'تغيير إلى مستخدم' : 'تغيير إلى مدير'}
                      onclick={() => toggleRole(user)}
                      disabled={togglingUserId === user.id}
                    >
                      {#if togglingUserId === user.id}
                        <Loader2 size={16} class="animate-spin" style="color: var(--text-quaternary);" />
                      {:else if user.role === 'ADMIN'}
                        <ToggleRight size={16} style="color: #f5b544;" />
                      {:else}
                        <ToggleLeft size={16} style="color: var(--text-quaternary);" />
                      {/if}
                    </button>

                    <!-- Verify Email -->
                    {#if !user.email_verified}
                      <button
                        class="btn-ghost p-2 rounded-lg transition-all duration-200 cursor-pointer"
                        title="توثيق البريد الإلكتروني"
                        onclick={() => verifyEmail(user)}
                        disabled={verifyingUserId === user.id}
                      >
                        {#if verifyingUserId === user.id}
                          <Loader2 size={16} class="animate-spin" style="color: var(--text-quaternary);" />
                        {:else}
                          <MailCheck size={16} style="color: #22d3a4;" />
                        {/if}
                      </button>
                    {:else}
                      <div class="p-2">
                        <MailCheck size={16} style="color: rgba(34,211,164,0.35);" />
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    {#if !loading && users.length === 0}
      <EmptyState
        icon={UserX}
        title="لا يوجد مستخدمون"
        description="لم يتم العثور على مستخدمين مطابقين لمعايير البحث"
      />
    {/if}

    <!-- Pagination -->
    {#if !loading && users.length > 0}
      <div class="px-5 pb-5">
        <Pagination
          bind:page={currentPage}
          totalPages={totalPages}
          totalItems={totalUsers}
          itemLabel="مستخدم"
        />
      </div>
    {/if}
  </div>
</div>
