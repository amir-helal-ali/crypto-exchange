<script lang="ts">
  import {
    Search,
    Filter,
    Clock,
    ShieldCheck,
    ShieldAlert,
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    FileDown,
    X,
    Activity,
    AlertCircle,
    LogIn,
    LogOut,
    UserPlus,
    KeyRound,
    MailCheck,
    Lock,
    Settings,
    FileCheck,
    ShoppingCart,
    Ban,
    CheckCircle2,
    XCircle,
    UserCog,
    Fingerprint,
    BadgeCheck,
    Server,
    Receipt,
  } from 'lucide-svelte';
  import { authGet, API, getToken } from '$lib/api/client';

  // ─── Types ───
  interface AuditLog {
    id: string;
    userId: string;
    username: string;
    action: string;
    details: string;
    ipAddress: string;
    createdAt: string;
  }

  interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  interface AuditLogsResponse {
    success: boolean;
    data: AuditLog[];
    pagination: PaginationMeta;
    stats: {
      authEvents: number;
      adminActions: number;
      tradeActions: number;
    };
  }

  // ─── Action categories ───
  const AUTH_ACTIONS = new Set([
    'REGISTER', 'LOGIN', 'LOGIN_2FA', 'LOGOUT', 'EMAIL_VERIFIED',
    'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
    'TWO_FA_ENABLED', 'TWO_FA_DISABLED', 'PASSWORD_CHANGED', 'PROFILE_UPDATED'
  ]);

  const ADMIN_ACTIONS = new Set([
    'UPDATE_USER_ROLE', 'REVIEW_KYC', 'REVIEW_TRANSACTION',
    'ADMIN_VERIFY_EMAIL', 'SETTINGS_UPDATE', 'UPDATE_FEE_SCHEDULE',
    'SSL_CERT_GENERATED', 'SSL_CERT_RENEWED', 'SSL_CERT_INSTALLED'
  ]);

  const TRADE_ACTIONS = new Set([
    'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'WITHDRAWAL_APPROVED',
    'WITHDRAWAL_REJECTED', 'ORDER_PLACED', 'ORDER_CANCELLED',
    'ORDER_FILLED', 'ORDER_TRIGGERED', 'KYC_SUBMITTED', 'KYC_APPROVED',
    'KYC_REJECTED'
  ]);

  // ─── Arabic action labels ───
  const actionLabels: Record<string, string> = {
    REGISTER: 'تسجيل حساب',
    LOGIN: 'تسجيل دخول',
    LOGIN_2FA: 'تسجيل دخول 2FA',
    LOGOUT: 'تسجيل خروج',
    EMAIL_VERIFIED: 'تأكيد البريد',
    PASSWORD_RESET_REQUESTED: 'طلب إعادة تعيين كلمة المرور',
    PASSWORD_RESET_COMPLETED: 'إعادة تعيين كلمة المرور',
    UPDATE_USER_ROLE: 'تحديث دور المستخدم',
    KYC_SUBMITTED: 'تقديم KYC',
    KYC_APPROVED: 'قبول KYC',
    KYC_REJECTED: 'رفض KYC',
    DEPOSIT_APPROVED: 'قبول إيداع',
    DEPOSIT_REJECTED: 'رفض إيداع',
    WITHDRAWAL_APPROVED: 'قبول سحب',
    WITHDRAWAL_REJECTED: 'رفض سحب',
    ORDER_PLACED: 'طلب جديد',
    ORDER_CANCELLED: 'إلغاء طلب',
    ORDER_FILLED: 'تنفيذ طلب',
    ORDER_TRIGGERED: 'تفعيل طلب',
    TWO_FA_ENABLED: 'تفعيل 2FA',
    TWO_FA_DISABLED: 'تعطيل 2FA',
    PROFILE_UPDATED: 'تحديث الملف',
    PASSWORD_CHANGED: 'تغيير كلمة المرور',
    SETTINGS_UPDATE: 'تحديث الإعدادات',
    REVIEW_KYC: 'مراجعة KYC',
    REVIEW_TRANSACTION: 'مراجعة معاملة',
    ADMIN_VERIFY_EMAIL: 'تأكيد بريد (مدير)',
    SSL_CERT_GENERATED: 'إنشاء شهادة SSL',
    SSL_CERT_RENEWED: 'تجديد شهادة SSL',
    SSL_CERT_INSTALLED: 'تثبيت شهادة SSL',
    UPDATE_FEE_SCHEDULE: 'تحديث جدول الرسوم'
  };

  // ─── Action pill color mapping ───
  const actionPillClass: Record<string, string> = {
    REGISTER: 'pill-azure',
    LOGIN: 'pill-azure',
    LOGIN_2FA: 'pill-violet',
    LOGOUT: 'pill-rose',
    EMAIL_VERIFIED: 'pill-mint',
    PASSWORD_RESET_REQUESTED: 'pill-gold',
    PASSWORD_RESET_COMPLETED: 'pill-mint',
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
    ORDER_FILLED: 'pill-mint',
    ORDER_TRIGGERED: 'pill-gold',
    TWO_FA_ENABLED: 'pill-mint',
    TWO_FA_DISABLED: 'pill-rose',
    PROFILE_UPDATED: 'pill-azure',
    PASSWORD_CHANGED: 'pill-violet',
    SETTINGS_UPDATE: 'pill-violet',
    REVIEW_KYC: 'pill-violet',
    REVIEW_TRANSACTION: 'pill-violet',
    ADMIN_VERIFY_EMAIL: 'pill-violet',
    SSL_CERT_GENERATED: 'pill-azure',
    SSL_CERT_RENEWED: 'pill-azure',
    SSL_CERT_INSTALLED: 'pill-azure',
    UPDATE_FEE_SCHEDULE: 'pill-violet'
  };

  // ─── Action icons ───
  const actionIcons: Record<string, typeof LogIn> = {
    REGISTER: UserPlus,
    LOGIN: LogIn,
    LOGIN_2FA: Fingerprint,
    LOGOUT: LogOut,
    EMAIL_VERIFIED: MailCheck,
    PASSWORD_RESET_REQUESTED: KeyRound,
    PASSWORD_RESET_COMPLETED: Lock,
    UPDATE_USER_ROLE: UserCog,
    KYC_SUBMITTED: BadgeCheck,
    KYC_APPROVED: CheckCircle2,
    KYC_REJECTED: XCircle,
    DEPOSIT_APPROVED: CheckCircle2,
    DEPOSIT_REJECTED: XCircle,
    WITHDRAWAL_APPROVED: CheckCircle2,
    WITHDRAWAL_REJECTED: XCircle,
    ORDER_PLACED: ShoppingCart,
    ORDER_CANCELLED: Ban,
    ORDER_FILLED: FileCheck,
    ORDER_TRIGGERED: FileCheck,
    TWO_FA_ENABLED: ShieldCheck,
    TWO_FA_DISABLED: ShieldAlert,
    PROFILE_UPDATED: UserCog,
    PASSWORD_CHANGED: Lock,
    SETTINGS_UPDATE: Settings,
    REVIEW_KYC: ShieldCheck,
    REVIEW_TRANSACTION: FileCheck,
    ADMIN_VERIFY_EMAIL: MailCheck,
    SSL_CERT_GENERATED: Server,
    SSL_CERT_RENEWED: Server,
    SSL_CERT_INSTALLED: Server,
    UPDATE_FEE_SCHEDULE: Receipt
  };

  // ─── All action types for dropdown ───
  const ALL_ACTION_TYPES = [
    'REGISTER', 'LOGIN', 'LOGIN_2FA', 'LOGOUT', 'EMAIL_VERIFIED',
    'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
    'UPDATE_USER_ROLE', 'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED',
    'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED',
    'ORDER_PLACED', 'ORDER_CANCELLED', 'ORDER_FILLED', 'ORDER_TRIGGERED',
    'TWO_FA_ENABLED', 'TWO_FA_DISABLED', 'PROFILE_UPDATED', 'PASSWORD_CHANGED',
    'SETTINGS_UPDATE', 'REVIEW_KYC', 'REVIEW_TRANSACTION', 'ADMIN_VERIFY_EMAIL',
    'SSL_CERT_GENERATED', 'SSL_CERT_RENEWED', 'SSL_CERT_INSTALLED', 'UPDATE_FEE_SCHEDULE'
  ];

  // ─── State ───
  let logs = $state<AuditLog[]>([]);
  let pagination = $state<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  let stats = $state<{ authEvents: number; adminActions: number; tradeActions: number }>({
    authEvents: 0,
    adminActions: 0,
    tradeActions: 0
  });
  let loading = $state(true);
  let error = $state<string | null>(null);
  let exporting = $state(false);

  // ─── Filters ───
  let searchQuery = $state('');
  let actionFilter = $state('');
  let dateFrom = $state('');
  let dateTo = $state('');
  let filtersVisible = $state(true);

  // ─── Debounce ───
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // ─── Helpers ───
  function getActionLabel(action: string): string {
    return actionLabels[action] || action;
  }

  function getActionPill(action: string): string {
    return actionPillClass[action] || 'pill-azure';
  }

  function getActionIcon(action: string): typeof LogIn {
    return actionIcons[action] || Activity;
  }

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

  function formatNumber(n: number): string {
    return n.toLocaleString('ar-EG');
  }

  // ─── Build query string ───
  function buildQueryString(page: number = 1): string {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pagination.limit));
    if (actionFilter) params.set('action', actionFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    return `/api/v1/admin/audit-logs?${params.toString()}`;
  }

  // ─── Fetch logs ───
  async function fetchLogs(page: number = 1) {
    loading = true;
    error = null;
    try {
      const res = await authGet(buildQueryString(page));
      if (!res.ok) throw new Error('فشل تحميل سجلات المراجعة');
      const json: AuditLogsResponse = await res.json();
      if (json.success) {
        logs = json.data;
        pagination = json.pagination;
        if (json.stats) {
          stats = json.stats;
        }
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ غير متوقع';
    } finally {
      loading = false;
    }
  }

  // ─── Debounced search ───
  function handleSearchInput() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchLogs(1);
    }, 400);
  }

  // ─── Apply filters ───
  function applyFilters() {
    fetchLogs(1);
  }

  // ─── Reset filters ───
  function resetFilters() {
    searchQuery = '';
    actionFilter = '';
    dateFrom = '';
    dateTo = '';
    fetchLogs(1);
  }

  // ─── Pagination ───
  let hasPrev = $derived(pagination.page > 1);
  let hasNext = $derived(pagination.page < pagination.totalPages);
  let pageNumbers = $derived.by(() => {
    const current = pagination.page;
    const total = pagination.totalPages;
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  function goToPage(page: number | string) {
    if (typeof page === 'string') return;
    if (page < 1 || page > pagination.totalPages) return;
    fetchLogs(page);
  }

  // ─── CSV Export ───
  async function exportCSV() {
    exporting = true;
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const url = `${API}/api/v1/admin/audit-logs/export?${params.toString()}`;
      const token = getToken();

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('فشل تصدير البيانات');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      error = e.message || 'فشل تصدير البيانات';
    } finally {
      exporting = false;
    }
  }

  // ─── Check if any filter is active ───
  let hasActiveFilters = $derived(
    searchQuery.trim() !== '' || actionFilter !== '' || dateFrom !== '' || dateTo !== ''
  );

  // ─── Lifecycle ───
  $effect(() => {
    fetchLogs(1);
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
</div>

<div class="relative z-10 space-y-6">
  <!-- ─── Page Header ─── -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">سجل المراجعة</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">تتبع جميع العمليات والأحداث في النظام</p>
    </div>
    <div class="flex items-center gap-3">
      <button
        class="btn-secondary flex items-center gap-2"
        onclick={() => fetchLogs(pagination.page)}
        disabled={loading}
      >
        <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        <span>تحديث</span>
      </button>
      <button
        class="btn-primary flex items-center gap-2"
        onclick={exportCSV}
        disabled={exporting}
      >
        <FileDown size={16} class={exporting ? 'animate-bounce' : ''} />
        <span>{exporting ? 'جاري التصدير...' : 'تصدير CSV'}</span>
      </button>
    </div>
  </div>

  <!-- ─── Error Banner ─── -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost" onclick={() => (error = null)}>
        <X size={16} />
      </button>
    </div>
  {/if}

  <!-- ─── Stats Row ─── -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <!-- Auth Events -->
    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="space-y-1 flex-1">
          <p class="text-xs font-medium" style="color: var(--text-tertiary);">أحداث المصادقة</p>
          <p class="text-3xl font-bold font-mono tabular-nums" style="color: #3b82f6;">
            {formatNumber(stats.authEvents)}
          </p>
        </div>
        <div
          class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
          style="background: rgba(59,130,246,0.12);"
        >
          <ShieldCheck size={22} style="color: #3b82f6;" />
        </div>
      </div>
    </div>

    <!-- Admin Actions -->
    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="space-y-1 flex-1">
          <p class="text-xs font-medium" style="color: var(--text-tertiary);">إجراءات المديرين</p>
          <p class="text-3xl font-bold font-mono tabular-nums" style="color: #a855f7;">
            {formatNumber(stats.adminActions)}
          </p>
        </div>
        <div
          class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
          style="background: rgba(168,85,247,0.12);"
        >
          <UserCog size={22} style="color: #a855f7;" />
        </div>
      </div>
    </div>

    <!-- Trade Actions -->
    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="space-y-1 flex-1">
          <p class="text-xs font-medium" style="color: var(--text-tertiary);">إجراءات التداول</p>
          <p class="text-3xl font-bold font-mono tabular-nums" style="color: #f5b544;">
            {formatNumber(stats.tradeActions)}
          </p>
        </div>
        <div
          class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
          style="background: rgba(245,181,68,0.12);"
        >
          <ArrowLeftRight size={22} style="color: #f5b544;" />
        </div>
      </div>
    </div>
  </div>

  <!-- ─── Filters Panel ─── -->
  <div class="panel p-5">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <Filter size={18} style="color: var(--accent-gold);" />
        <h2 class="text-sm font-bold">تصفية متقدمة</h2>
      </div>
      <div class="flex items-center gap-2">
        {#if hasActiveFilters}
          <button class="btn-ghost text-xs" onclick={resetFilters}>
            <X size={14} />
            مسح الفلاتر
          </button>
        {/if}
        <button
          class="btn-ghost text-xs"
          onclick={() => (filtersVisible = !filtersVisible)}
        >
          {filtersVisible ? 'إخفاء' : 'إظهار'}
        </button>
      </div>
    </div>

    {#if filtersVisible}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Search -->
        <div class="relative">
          <Search
            size={16}
            class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style="color: var(--text-quaternary);"
          />
          <input
            type="text"
            class="input-field pr-10"
            placeholder="بحث بالمستخدم أو التفاصيل..."
            bind:value={searchQuery}
            oninput={handleSearchInput}
          />
        </div>

        <!-- Action Type -->
        <div class="relative">
          <select
            class="input-field appearance-none pr-4 pl-10 cursor-pointer"
            bind:value={actionFilter}
            onchange={applyFilters}
          >
            <option value="">جميع الإجراءات</option>
            <optgroup label="المصادقة">
              {#each ALL_ACTION_TYPES.filter(a => AUTH_ACTIONS.has(a)) as actionType}
                <option value={actionType}>{getActionLabel(actionType)}</option>
              {/each}
            </optgroup>
            <optgroup label="إدارية">
              {#each ALL_ACTION_TYPES.filter(a => ADMIN_ACTIONS.has(a)) as actionType}
                <option value={actionType}>{getActionLabel(actionType)}</option>
              {/each}
            </optgroup>
            <optgroup label="التداول والمعاملات">
              {#each ALL_ACTION_TYPES.filter(a => TRADE_ACTIONS.has(a)) as actionType}
                <option value={actionType}>{getActionLabel(actionType)}</option>
              {/each}
            </optgroup>
          </select>
          <Filter
            size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style="color: var(--text-quaternary);"
          />
        </div>

        <!-- Date From -->
        <div>
          <input
            type="date"
            class="input-field"
            bind:value={dateFrom}
            onchange={applyFilters}
          />
        </div>

        <!-- Date To -->
        <div>
          <input
            type="date"
            class="input-field"
            bind:value={dateTo}
            onchange={applyFilters}
          />
        </div>
      </div>

      <!-- Active filter badges -->
      {#if hasActiveFilters}
        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <span class="text-xs" style="color: var(--text-quaternary);">الفلاتر النشطة:</span>
          {#if searchQuery.trim()}
            <span class="pill-gold text-[10px]">
              بحث: {searchQuery}
              <button onclick={() => { searchQuery = ''; fetchLogs(1); }} class="mr-1 hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          {/if}
          {#if actionFilter}
            <span class="pill-violet text-[10px]">
              {getActionLabel(actionFilter)}
              <button onclick={() => { actionFilter = ''; fetchLogs(1); }} class="mr-1 hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          {/if}
          {#if dateFrom}
            <span class="pill-azure text-[10px]">
              من: {dateFrom}
              <button onclick={() => { dateFrom = ''; fetchLogs(1); }} class="mr-1 hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          {/if}
          {#if dateTo}
            <span class="pill-azure text-[10px]">
              إلى: {dateTo}
              <button onclick={() => { dateTo = ''; fetchLogs(1); }} class="mr-1 hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- ─── Data Table ─── -->
  <div class="panel overflow-hidden">
    <!-- Table header info -->
    <div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-subtle);">
      <div class="flex items-center gap-2">
        <Activity size={18} style="color: var(--accent-violet);" />
        <h2 class="text-sm font-bold">سجلات المراجعة</h2>
        <span class="pill-azure text-[10px]">
          {formatNumber(pagination.total)} سجل
        </span>
      </div>
    </div>

    {#if loading && logs.length === 0}
      <!-- Loading Skeleton -->
      <div class="p-6 space-y-4">
        {#each Array(8) as _}
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
    {:else if logs.length > 0}
      <!-- Table -->
      <div class="overflow-x-auto scrollbar-none">
        <table class="w-full text-sm">
          <thead>
            <tr style="color: var(--text-tertiary);" class="text-xs">
              <th class="text-right py-3.5 px-5 font-medium">المستخدم</th>
              <th class="text-right py-3.5 px-5 font-medium">الإجراء</th>
              <th class="text-right py-3.5 px-5 font-medium hidden md:table-cell">التفاصيل</th>
              <th class="text-right py-3.5 px-5 font-medium hidden lg:table-cell">عنوان IP</th>
              <th class="text-right py-3.5 px-5 font-medium">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log (log.id)}
              {@const Icon = getActionIcon(log.action)}
              {@const pillCls = getActionPill(log.action)}
              {@const label = getActionLabel(log.action)}
              <tr
                class="border-t transition-colors hover:bg-white/[0.02]"
                style="border-color: var(--border-subtle);"
              >
                <!-- User -->
                <td class="py-3.5 px-5">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                      style="background: rgba(59,130,246,0.12); color: #3b82f6;"
                    >
                      {log.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium truncate max-w-[140px]">{log.username || '—'}</p>
                      <p class="text-[10px] truncate max-w-[140px]" style="color: var(--text-quaternary);">
                        {log.userId?.slice(0, 8) || ''}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Action with pill -->
                <td class="py-3.5 px-5">
                  <span class={pillCls}>
                    <Icon size={12} />
                    {label}
                  </span>
                </td>

                <!-- Details -->
                <td class="py-3.5 px-5 hidden md:table-cell">
                  <span class="truncate block max-w-[240px]" style="color: var(--text-secondary);">
                    {log.details || '—'}
                  </span>
                </td>

                <!-- IP Address -->
                <td class="py-3.5 px-5 hidden lg:table-cell">
                  <span class="font-mono text-xs px-2 py-1 rounded-md" style="color: var(--text-quaternary); background: rgba(255,255,255,0.03);">
                    {log.ipAddress || '—'}
                  </span>
                </td>

                <!-- Time -->
                <td class="py-3.5 px-5">
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

      <!-- ─── Pagination ─── -->
      {#if pagination.totalPages > 1}
        <div
          class="flex items-center justify-between px-5 py-4 border-t"
          style="border-color: var(--border-subtle);"
        >
          <!-- Info -->
          <p class="text-xs" style="color: var(--text-quaternary);">
            صفحة {formatNumber(pagination.page)} من {formatNumber(pagination.totalPages)}
            &middot;
            {formatNumber(pagination.total)} سجل
          </p>

          <!-- Controls -->
          <div class="flex items-center gap-1">
            <button
              class="btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              onclick={() => goToPage(pagination.page - 1)}
              disabled={!hasPrev}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight size={16} />
            </button>

            {#each pageNumbers as pn}
              {#if pn === '...'}
                <span class="px-2 text-xs" style="color: var(--text-quaternary);">...</span>
              {:else}
                <button
                  class="min-w-[32px] h-8 rounded-lg text-xs font-medium transition-all cursor-pointer {pn === pagination.page
                    ? 'bg-[rgba(245,181,68,0.15)] text-[#f5b544] border border-[rgba(245,181,68,0.3)]'
                    : 'hover:bg-white/5'}"
                  style={pn !== pagination.page ? 'color: var(--text-secondary);' : ''}
                  onclick={() => goToPage(pn)}
                  disabled={loading}
                >
                  {formatNumber(pn as number)}
                </button>
              {/if}
            {/each}

            <button
              class="btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              onclick={() => goToPage(pagination.page + 1)}
              disabled={!hasNext}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      {/if}
    {:else}
      <!-- Empty State -->
      <div class="text-center py-16" style="color: var(--text-quaternary);">
        <Activity size={48} class="mx-auto mb-4 opacity-20" />
        <p class="text-sm font-medium mb-1">لا توجد سجلات مراجعة</p>
        <p class="text-xs">لم يتم العثور على سجلات تطابق معايير البحث</p>
        {#if hasActiveFilters}
          <button class="btn-secondary mt-4 text-xs" onclick={resetFilters}>
            مسح الفلاتر
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
