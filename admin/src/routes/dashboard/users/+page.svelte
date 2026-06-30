<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search, Users, MailCheck, Shield, ChevronLeft, AlertCircle,
    Mail, ToggleLeft, ToggleRight, Loader2, Filter, X
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { AdminUser } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatDate, getStatusConfig } from '$lib/utils/helpers';
  import StatCard from '$lib/components/StatCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';

  interface UserRow extends AdminUser {
    kyc_status?: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NONE';
  }

  let users = $state<UserRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let roleFilter = $state('');
  let kycFilter = $state('');
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  const pageSize = 20;
  let totalUsers = $state(0);
  let adminCount = $state(0);
  let emailVerifiedCount = $state(0);
  let kycVerifiedCount = $state(0);
  let sseConnected = $state(false);
  let togglingRole = $state<Set<number>>(new Set());
  let verifyingEmail = $state<Set<number>>(new Set());
  let eventSource: EventSource | null = null;

  async function fetchUsers() {
    loading = true; error = null;
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize) });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (kycFilter) params.set('kyc_status', kycFilter);
      const res = await authGet(`/api/v1/admin/users?${params}`);
      if (!res.ok) throw new Error('فشل تحميل المستخدمين');
      const json = await res.json();
      if (json.success) {
        users = json.data;
        totalPages = json.pagination.totalPages;
        totalItems = json.pagination.total;
      }
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/users/stats');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        totalUsers = json.data.total || 0;
        adminCount = json.data.admins || 0;
        emailVerifiedCount = json.data.emailVerified || 0;
        kycVerifiedCount = json.data.kycVerified || 0;
      }
    } catch {}
  }

  async function toggleRole(userId: number, currentRole: string) {
    togglingRole = new Set([...togglingRole, userId]);
    try {
      const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
      const res = await authPut(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      if (!res.ok) throw new Error('فشل تحديث الدور');
      users = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    } catch (e: any) { error = e.message; }
    finally { togglingRole = new Set([...togglingRole].filter(id => id !== userId)); }
  }

  async function verifyEmail(userId: number) {
    verifyingEmail = new Set([...verifyingEmail, userId]);
    try {
      const res = await authPut(`/api/v1/admin/users/${userId}/verify-email`);
      if (!res.ok) throw new Error('فشل توثيق البريد');
      users = users.map(u => u.id === userId ? { ...u, email_verified: true } : u);
    } catch (e: any) { error = e.message; }
    finally { verifyingEmail = new Set([...verifyingEmail].filter(id => id !== userId)); }
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => {
    searchQuery;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { currentPage = 1; fetchUsers(); }, 400);
  });

  $effect(() => { roleFilter; kycFilter; currentPage = 1; fetchUsers(); });
  $effect(() => { currentPage; fetchUsers(); });

  function connectSSE() {
    const es = createAdminStream(['users']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('users', () => { fetchStats(); });
    es.onerror = () => { sseConnected = false; setTimeout(() => { es.close(); connectSSE(); }, 5000); };
    return es;
  }

  onMount(() => {
    (async () => { await Promise.all([fetchUsers(), fetchStats()]); loading = false; })();
    eventSource = connectSSE() ?? null;
    return () => { eventSource?.close(); };
  });

  const roleLabels: Record<string, string> = { ADMIN: 'مدير', USER: 'مستخدم' };
  const rolePillClass: Record<string, string> = { ADMIN: 'pill-gold', USER: 'pill-azure' };
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">المستخدمين</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة حسابات المستخدمين</p>
    </div>
    <LiveIndicator connected={sseConnected} />
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard label="إجمالي المستخدمين" value={totalUsers} icon={Users} iconColor="#f5b544" iconBg="rgba(245,181,68,0.12)" sparkColor="#f5b544" sparkSeed={0} loading={loading} />
    <StatCard label="المدراء" value={adminCount} icon={Shield} iconColor="#a855f7" iconBg="rgba(168,85,247,0.12)" sparkColor="#a855f7" sparkSeed={1} loading={loading} />
    <StatCard label="بريد موثّق" value={emailVerifiedCount} icon={MailCheck} iconColor="#22d3a4" iconBg="rgba(34,211,164,0.12)" sparkColor="#22d3a4" sparkSeed={2} loading={loading} />
    <StatCard label="KYC موثّق" value={kycVerifiedCount} icon={Shield} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" sparkColor="#3b82f6" sparkSeed={3} loading={loading} />
  </div>

  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input type="text" class="input-field pr-10" placeholder="بحث بالاسم أو البريد..." bind:value={searchQuery} dir="rtl" />
      </div>
      <div class="relative">
        <Filter size={16} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <select class="input-field pr-9 pl-8 appearance-none cursor-pointer min-w-[140px]" bind:value={roleFilter} dir="rtl">
          <option value="">كل الأدوار</option>
          <option value="ADMIN">مدير</option>
          <option value="USER">مستخدم</option>
        </select>
      </div>
      <div class="relative">
        <select class="input-field pr-9 pl-8 appearance-none cursor-pointer min-w-[140px]" bind:value={kycFilter} dir="rtl">
          <option value="">كل حالات KYC</option>
          <option value="VERIFIED">موثّق</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="NONE">لا يوجد</option>
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(8) as _}
        <div class="panel p-4 flex items-center gap-4">
          <div class="animate-shimmer h-10 w-10 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
          <div class="flex-1 space-y-2">
            <div class="animate-shimmer h-4 w-1/4 rounded" style="background: rgba(255,255,255,0.06);"></div>
            <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.04);"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if users.length === 0}
    <EmptyState icon={Users} title="لا يوجد مستخدمون" description="سيظهر المستخدمون هنا عند تسجيلهم" />
  {:else}
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto scrollbar-none">
        <table class="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الدور</th>
              <th>البريد</th>
              <th class="hidden md:table-cell">KYC</th>
              <th class="hidden lg:table-cell">التسجيل</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user (user.id)}
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0" style="background: rgba(59,130,246,0.12); color: #3b82f6;">
                      {user.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium truncate">{user.username}</p>
                      <p class="text-xs truncate" style="color: var(--text-quaternary);">#{user.id}</p>
                    </div>
                  </div>
                </td>
                <td><span class={rolePillClass[user.role] || 'pill-azure'}>{roleLabels[user.role] || user.role}</span></td>
                <td>
                  <div class="flex items-center gap-1.5">
                    {#if user.email_verified}
                      <MailCheck size={13} style="color: #22d3a4;" />
                    {:else}
                      <Mail size={13} style="color: var(--text-quaternary);" />
                    {/if}
                    <span class="text-xs truncate max-w-[150px]" dir="ltr">{user.email}</span>
                  </div>
                </td>
                <td class="hidden md:table-cell">
                  <span class={getStatusConfig(user.kyc_status || 'NONE').pillClass}>{getStatusConfig(user.kyc_status || 'NONE').label}</span>
                </td>
                <td class="hidden lg:table-cell"><span class="text-xs" style="color: var(--text-tertiary);">{formatDate(user.created_at)}</span></td>
                <td>
                  <div class="flex items-center gap-1">
                    <button class="btn-ghost p-2 rounded-lg" onclick={() => toggleRole(user.id, user.role)} disabled={togglingRole.has(user.id)} title="تبديل الدور">
                      {#if togglingRole.has(user.id)}<Loader2 size={14} class="animate-spin" />{:else if user.role === 'ADMIN'}<ToggleRight size={16} style="color: #f5b544;" />{:else}<ToggleLeft size={16} />{/if}
                    </button>
                    {#if !user.email_verified}
                      <button class="btn-ghost p-2 rounded-lg" onclick={() => verifyEmail(user.id)} disabled={verifyingEmail.has(user.id)} title="توثيق البريد">
                        {#if verifyingEmail.has(user.id)}<Loader2 size={14} class="animate-spin" />{:else}<MailCheck size={14} style="color: #22d3a4;" />{/if}
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <Pagination bind:page={currentPage} totalPages={totalPages} totalItems={totalItems} itemLabel="مستخدم" />
  {/if}
</div>
