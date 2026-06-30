<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search,
    Users,
    ShieldCheck,
    MailCheck,
    Shield,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    Mail,
    ToggleLeft,
    ToggleRight,
    Loader2,
    UserPlus,
    Filter,
    X
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { AdminUser } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';

  // ─── Extended user type (API may include kyc_status) ───
  interface UserRow extends AdminUser {
    kyc_status?: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NONE';
  }

  // ─── State ───
  let users = $state<UserRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Search & filters
  let searchQuery = $state('');
  let searchDebounced = $state('');
  let roleFilter = $state<string>('');
  let kycFilter = $state<string>('');

  // Pagination
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  const pageSize = 20;

  // Stats
  let totalUsers = $state(0);
  let adminCount = $state(0);
  let emailVerifiedCount = $state(0);
  let kycVerifiedCount = $state(0);

  // SSE
  let sseConnected = $state(false);
  let newUserIndicator = $state(false);
  let newUserCount = $state(0);
  let eventSource: EventSource | null = null;

  // Action states per user id
  let togglingRole = $state<Set<number>>(new Set());
  let verifyingEmail = $state<Set<number>>(new Set());

  // Filter panel visibility (mobile)
  let filtersOpen = $state(false);

  // ─── Debounced search ───
  let searchTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchDebounced = searchQuery;
      currentPage = 1;
    }, 350);
  });

  // ─── Re-fetch when filters / page change ───
  $effect(() => {
    // depend on these reactive values
    searchDebounced;
    roleFilter;
    kycFilter;
    currentPage;
    fetchUsers();
  });

  // ─── KYC status label map ───
  const kycLabels: Record<string, string> = {
    VERIFIED: 'موثّق',
    PENDING: 'قيد المراجعة',
    REJECTED: 'مرفوض',
    NONE: 'لا يوجد',
    '': 'لا يوجد'
  };

  const kycPillClass: Record<string, string> = {
    VERIFIED: 'pill-mint',
    PENDING: 'pill-gold',
    REJECTED: 'pill-rose',
    NONE: 'pill-azure',
    '': 'pill-azure'
  };

  const rolePillClass: Record<string, string> = {
    ADMIN: 'pill-gold',
    USER: 'pill-azure'
  };

  const roleLabels: Record<string, string> = {
    ADMIN: 'مدير',
    USER: 'مستخدم'
  };

  // ─── Fetch users ───
  async function fetchUsers() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize)
      });
      if (searchDebounced) params.set('search', searchDebounced);
      if (roleFilter) params.set('role', roleFilter);
      if (kycFilter) params.set('kyc_status', kycFilter);

      const res = await authGet(`/api/v1/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('فشل تحميل بيانات المستخدمين');
      const json = await res.json();

      if (json.success) {
        users = json.data?.items ?? json.data ?? [];
        totalItems = json.data?.total ?? json.pagination?.total ?? 0;
        totalPages = json.data?.totalPages ?? json.pagination?.totalPages ?? (Math.ceil(totalItems / pageSize) || 1);
        currentPage = json.data?.page ?? json.pagination?.page ?? currentPage;

        // Derive stats from the full dataset if provided
        if (json.data?.stats) {
          totalUsers = json.data.stats.totalUsers ?? totalItems;
          adminCount = json.data.stats.adminCount ?? 0;
          emailVerifiedCount = json.data.stats.emailVerifiedCount ?? 0;
          kycVerifiedCount = json.data.stats.kycVerifiedCount ?? 0;
        } else {
          totalUsers = totalItems;
          // Fall back to counting from current page (approximate)
          adminCount = users.filter((u) => u.role === 'ADMIN').length;
          emailVerifiedCount = users.filter((u) => u.email_verified).length;
          kycVerifiedCount = users.filter((u) => u.kyc_status === 'VERIFIED').length;
        }
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ─── Toggle admin role ───
  async function toggleRole(user: UserRow) {
    togglingRole.update((s) => { const ns = new Set(s); ns.add(user.id); return ns; });
    try {
      const res = await authPut(`/api/v1/admin/user/${user.id}/role`);
      if (!res.ok) throw new Error('فشل تحديث الدور');
      // Optimistic update
      users = users.map((u) =>
        u.id === user.id ? { ...u, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' } : u
      );
      // Refresh stats
      fetchUsers();
    } catch (e: any) {
      error = e.message;
    } finally {
      togglingRole.update((s) => { const ns = new Set(s); ns.delete(user.id); return ns; });
    }
  }

  // ─── Manual email verify ───
  async function verifyEmail(user: UserRow) {
    verifyingEmail.update((s) => { const ns = new Set(s); ns.add(user.id); return ns; });
    try {
      const res = await authPut(`/api/v1/admin/user/${user.id}/verify-email`);
      if (!res.ok) throw new Error('فشل توثيق البريد');
      users = users.map((u) =>
        u.id === user.id ? { ...u, email_verified: true } : u
      );
    } catch (e: any) {
      error = e.message;
    } finally {
      verifyingEmail.update((s) => { const ns = new Set(s); ns.delete(user.id); return ns; });
    }
  }

  // ─── SSE ───
  function connectSSE() {
    const es = createAdminStream(['users']);
    if (!es) return;

    es.onopen = () => {
      sseConnected = true;
    };

    es.addEventListener('users', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data) {
          newUserIndicator = true;
          newUserCount++;
          // Auto-hide indicator after 10 seconds
          setTimeout(() => {
            newUserIndicator = false;
            newUserCount = 0;
          }, 10000);
        }
      } catch {}
    });

    es.onerror = () => {
      sseConnected = false;
      setTimeout(() => {
        es.close();
        connectSSE();
      }, 5000);
    };

    return es;
  }

  // ─── Refresh after SSE notification ───
  function handleNewUserRefresh() {
    newUserIndicator = false;
    newUserCount = 0;
    fetchUsers();
  }

  // ─── Pagination helpers ───
  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  let pageNumbers = $derived.by(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  // ─── Clear all filters ───
  function clearFilters() {
    searchQuery = '';
    searchDebounced = '';
    roleFilter = '';
    kycFilter = '';
    currentPage = 1;
  }

  let hasActiveFilters = $derived(searchQuery !== '' || roleFilter !== '' || kycFilter !== '');

  // ─── Format date ───
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatNum(n: number): string {
    return n.toLocaleString('ar-EG');
  }

  // ─── Lifecycle ───
  onMount(() => {
    eventSource = connectSSE() ?? null;
    return () => {
      eventSource?.close();
    };
  });
</script>

<!-- ─── Page Content ─── -->
<div class="relative z-10 space-y-6">

  <!-- ─── Header Row ─── -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">إدارة المستخدمين</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">عرض وإدارة حسابات المستخدمين</p>
    </div>

    <div class="flex items-center gap-3">
      <!-- SSE Live Indicator -->
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

      <!-- New User SSE Indicator -->
      {#if newUserIndicator}
        <button
          class="pill-gold animate-pulse-glow cursor-pointer"
          onclick={handleNewUserRefresh}
        >
          <UserPlus size={14} />
          {newUserCount} مستخدم جديد — اضغط للتحديث
        </button>
      {/if}
    </div>
  </div>

  <!-- ─── Stats Row ─── -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Total Users -->
    <div class="stat-card">
      {#if loading}
        <div class="space-y-2">
          <div class="animate-shimmer h-3 w-20 rounded" style="background: rgba(255,255,255,0.06);"></div>
          <div class="animate-shimmer h-7 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
        </div>
      {:else}
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(59,130,246,0.12);">
            <Users size={20} style="color: #3b82f6;" />
          </div>
          <div>
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">إجمالي المستخدمين</p>
            <p class="text-2xl font-bold font-mono tabular-nums" style="color: #3b82f6;">{formatNum(totalUsers)}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Admin Count -->
    <div class="stat-card">
      {#if loading}
        <div class="space-y-2">
          <div class="animate-shimmer h-3 w-16 rounded" style="background: rgba(255,255,255,0.06);"></div>
          <div class="animate-shimmer h-7 w-20 rounded" style="background: rgba(255,255,255,0.06);"></div>
        </div>
      {:else}
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(245,181,68,0.12);">
            <Shield size={20} style="color: #f5b544;" />
          </div>
          <div>
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">المديرون</p>
            <p class="text-2xl font-bold font-mono tabular-nums" style="color: #f5b544;">{formatNum(adminCount)}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Email Verified -->
    <div class="stat-card">
      {#if loading}
        <div class="space-y-2">
          <div class="animate-shimmer h-3 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
          <div class="animate-shimmer h-7 w-20 rounded" style="background: rgba(255,255,255,0.06);"></div>
        </div>
      {:else}
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(34,211,164,0.12);">
            <MailCheck size={20} style="color: #22d3a4;" />
          </div>
          <div>
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">بريد موثّق</p>
            <p class="text-2xl font-bold font-mono tabular-nums" style="color: #22d3a4;">{formatNum(emailVerifiedCount)}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- KYC Verified -->
    <div class="stat-card">
      {#if loading}
        <div class="space-y-2">
          <div class="animate-shimmer h-3 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
          <div class="animate-shimmer h-7 w-20 rounded" style="background: rgba(255,255,255,0.06);"></div>
        </div>
      {:else}
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.12);">
            <ShieldCheck size={20} style="color: #a855f7;" />
          </div>
          <div>
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">KYC موثّق</p>
            <p class="text-2xl font-bold font-mono tabular-nums" style="color: #a855f7;">{formatNum(kycVerifiedCount)}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ─── Search & Filters ─── -->
  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <!-- Search Input -->
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field pr-10"
          placeholder="ابحث بالاسم أو البريد الإلكتروني..."
          bind:value={searchQuery}
        />
      </div>

      <!-- Filter Toggle (mobile) -->
      <button
        class="btn-secondary flex items-center gap-2 sm:hidden"
        onclick={() => (filtersOpen = !filtersOpen)}
      >
        <Filter size={16} />
        الفلاتر
        {#if hasActiveFilters}
          <span class="w-2 h-2 rounded-full" style="background: #f5b544;"></span>
        {/if}
      </button>

      <!-- Role Filter -->
      <div class="flex-1 items-center gap-2 {filtersOpen ? 'flex' : 'hidden sm:flex'}">
        <select
          class="input-field w-auto min-w-[130px]"
          bind:value={roleFilter}
        >
          <option value="">كل الأدوار</option>
          <option value="ADMIN">مدير</option>
          <option value="USER">مستخدم</option>
        </select>
      </div>

      <!-- KYC Filter -->
      <div class="flex-1 items-center gap-2 {filtersOpen ? 'flex' : 'hidden sm:flex'}">
        <select
          class="input-field w-auto min-w-[150px]"
          bind:value={kycFilter}
        >
          <option value="">كل حالات KYC</option>
          <option value="VERIFIED">موثّق</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="NONE">لا يوجد</option>
        </select>
      </div>

      <!-- Clear Filters -->
      {#if hasActiveFilters}
        <button
          class="btn-ghost flex items-center gap-1.5 whitespace-nowrap"
          onclick={clearFilters}
        >
          <X size={14} />
          مسح الفلاتر
        </button>
      {/if}
    </div>
  </div>

  <!-- ─── Error Banner ─── -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm flex-1" style="color: #f43f7a;">{error}</p>
      <button class="btn-ghost text-xs" onclick={() => (error = null)}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- ─── Data Table ─── -->
  <div class="panel overflow-hidden">
    <div class="overflow-x-auto scrollbar-none">
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b"
            style="border-color: var(--border-subtle); color: var(--text-tertiary);"
          >
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">المستخدم</th>
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">البريد</th>
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">الدور</th>
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">توثيق البريد</th>
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">KYC</th>
            <th class="text-right py-4 px-4 font-medium whitespace-nowrap">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <!-- Loading Skeletons -->
            {#each Array(8) as _, i}
              <tr class="border-t" style="border-color: var(--border-subtle);">
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <div class="animate-shimmer h-9 w-9 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
                    <div class="space-y-2">
                      <div class="animate-shimmer h-3.5 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
                      <div class="animate-shimmer h-3 w-16 rounded" style="background: rgba(255,255,255,0.04);"></div>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4">
                  <div class="animate-shimmer h-3.5 w-36 rounded" style="background: rgba(255,255,255,0.06);"></div>
                </td>
                <td class="py-4 px-4">
                  <div class="animate-shimmer h-6 w-16 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
                </td>
                <td class="py-4 px-4">
                  <div class="animate-shimmer h-6 w-14 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
                </td>
                <td class="py-4 px-4">
                  <div class="animate-shimmer h-6 w-20 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
                </td>
                <td class="py-4 px-4">
                  <div class="flex gap-2">
                    <div class="animate-shimmer h-8 w-20 rounded-lg" style="background: rgba(255,255,255,0.06);"></div>
                    <div class="animate-shimmer h-8 w-20 rounded-lg" style="background: rgba(255,255,255,0.04);"></div>
                  </div>
                </td>
              </tr>
            {/each}
          {:else if users.length === 0}
            <!-- Empty State -->
            <tr>
              <td colspan="6" class="py-16 text-center">
                <Users size={48} class="mx-auto mb-4 opacity-20" style="color: var(--text-quaternary);" />
                <p class="text-base font-medium" style="color: var(--text-tertiary);">لا يوجد مستخدمون</p>
                <p class="text-sm mt-1" style="color: var(--text-quaternary);">
                  {#if hasActiveFilters}
                    لا توجد نتائج مطابقة للفلاتر المحددة
                  {:else}
                    لم يتم تسجيل أي مستخدم بعد
                  {/if}
                </p>
                {#if hasActiveFilters}
                  <button class="btn-secondary mt-4" onclick={clearFilters}>
                    مسح الفلاتر
                  </button>
                {/if}
              </td>
            </tr>
          {:else}
            {#each users as user (user.id)}
              {@const isTogglingRole = togglingRole.has(user.id)}
              {@const isVerifyingEmail = verifyingEmail.has(user.id)}
              {@const kyc = user.kyc_status || 'NONE'}
              <tr
                class="border-t transition-colors hover:bg-white/[0.02]"
                style="border-color: var(--border-subtle);"
              >
                <!-- المستخدم -->
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0"
                      style="background: {user.role === 'ADMIN' ? 'rgba(245,181,68,0.12)' : 'rgba(59,130,246,0.12)'}; color: {user.role === 'ADMIN' ? '#f5b544' : '#3b82f6'};"
                    >
                      {user.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium truncate max-w-[140px]">{user.username || '—'}</p>
                      <p class="text-xs whitespace-nowrap" style="color: var(--text-quaternary);">{formatDate(user.created_at)}</p>
                    </div>
                  </div>
                </td>

                <!-- البريد -->
                <td class="py-4 px-4">
                  <div class="flex items-center gap-2 min-w-0">
                    <Mail size={14} class="shrink-0" style="color: var(--text-quaternary);" />
                    <span class="truncate max-w-[200px] font-mono text-xs" style="color: var(--text-secondary);">
                      {user.email || '—'}
                    </span>
                  </div>
                </td>

                <!-- الدور -->
                <td class="py-4 px-4">
                  <span class={rolePillClass[user.role] || 'pill-azure'}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>

                <!-- توثيق البريد -->
                <td class="py-4 px-4">
                  {#if user.email_verified}
                    <span class="pill-mint">
                      <MailCheck size={12} />
                      موثّق
                    </span>
                  {:else}
                    <span class="pill-rose">
                      <X size={12} />
                      غير موثّق
                    </span>
                  {/if}
                </td>

                <!-- KYC -->
                <td class="py-4 px-4">
                  <span class={kycPillClass[kyc] || 'pill-azure'}>
                    <ShieldCheck size={12} />
                    {kycLabels[kyc] || kyc}
                  </span>
                </td>

                <!-- الإجراءات -->
                <td class="py-4 px-4">
                  <div class="flex items-center gap-2">
                    <!-- Toggle Role -->
                    <button
                      class="btn-ghost flex items-center gap-1.5 text-xs whitespace-nowrap"
                      onclick={() => toggleRole(user)}
                      disabled={isTogglingRole}
                      title={user.role === 'ADMIN' ? 'إزالة صلاحية المدير' : 'ترقية إلى مدير'}
                    >
                      {#if isTogglingRole}
                        <Loader2 size={14} class="animate-spin" />
                      {:else if user.role === 'ADMIN'}
                        <ToggleRight size={14} style="color: #f5b544;" />
                      {:else}
                        <ToggleLeft size={14} />
                      {/if}
                      {user.role === 'ADMIN' ? 'إزالة' : 'ترقية'}
                    </button>

                    <!-- Verify Email (only for unverified) -->
                    {#if !user.email_verified}
                      <button
                        class="btn-ghost flex items-center gap-1.5 text-xs whitespace-nowrap"
                        onclick={() => verifyEmail(user)}
                        disabled={isVerifyingEmail}
                        title="توثيق البريد يدوياً"
                      >
                        {#if isVerifyingEmail}
                          <Loader2 size={14} class="animate-spin" />
                        {:else}
                          <MailCheck size={14} style="color: #22d3a4;" />
                        {/if}
                        توثيق البريد
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- ─── Pagination ─── -->
    {#if !loading && users.length > 0}
      <div
        class="flex items-center justify-between px-4 py-3 border-t"
        style="border-color: var(--border-subtle);"
      >
        <p class="text-xs" style="color: var(--text-quaternary);">
          عرض {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} من {formatNum(totalItems)}
        </p>

        <div class="flex items-center gap-1">
          <!-- Previous -->
          <button
            class="btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronRight size={16} />
          </button>

          <!-- First page -->
          {#if currentPage > 3}
            <button
              class="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono"
              onclick={() => goToPage(1)}
            >
              1
            </button>
            <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
          {/if}

          <!-- Page numbers -->
          {#each pageNumbers as page}
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all {page === currentPage
                ? 'btn-primary !py-1.5 !px-3 !text-xs'
                : 'btn-ghost'}"
              onclick={() => goToPage(page)}
              disabled={page === currentPage}
            >
              {page}
            </button>
          {/each}

          <!-- Last page -->
          {#if currentPage < totalPages - 2}
            <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
            <button
              class="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono"
              onclick={() => goToPage(totalPages)}
            >
              {totalPages}
            </button>
          {/if}

          <!-- Next -->
          <button
            class="btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
