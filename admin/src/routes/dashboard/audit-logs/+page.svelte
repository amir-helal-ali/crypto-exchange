<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search, Filter, Clock, Activity, ChevronLeft, ChevronRight,
    RefreshCw, FileDown, AlertCircle, ShieldCheck, ShieldAlert,
    ArrowLeftRight, LogIn, LogOut, UserPlus, KeyRound, Settings
  } from 'lucide-svelte';
  import { authGet, API, getToken } from '$lib/api/client';
  import { formatDate, getActionLabel, getActionPill } from '$lib/utils/helpers';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  interface AuditLogEntry {
    id: string; userId: string; username: string; action: string;
    details: string; ipAddress: string; createdAt: string;
  }

  let logs = $state<AuditLogEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let categoryFilter = $state('');
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  const limit = 25;
  let authEvents = $state(0);
  let adminActions = $state(0);
  let tradeActions = $state(0);

  const AUTH_ACTIONS = new Set(['REGISTER','LOGIN','LOGIN_2FA','LOGOUT','EMAIL_VERIFIED','PASSWORD_CHANGED','TWO_FA_ENABLED','TWO_FA_DISABLED']);
  const ADMIN_ACTIONS = new Set(['UPDATE_USER_ROLE','REVIEW_KYC','KYC_APPROVED','KYC_REJECTED','REVIEW_TRANSACTION','SETTINGS_UPDATE']);
  const TRADE_ACTIONS = new Set(['ORDER_PLACED','ORDER_CANCELLED','DEPOSIT_APPROVED','DEPOSIT_REJECTED','WITHDRAWAL_APPROVED','WITHDRAWAL_REJECTED']);

  const categoryIcons: Record<string, typeof ShieldCheck> = {
    auth: ShieldCheck, admin: ShieldAlert, trade: ArrowLeftRight
  };

  async function fetchLogs() {
    loading = true; error = null;
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await authGet(`/api/v1/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error('فشل تحميل سجل المراجعة');
      const json = await res.json();
      if (json.success) {
        logs = json.data;
        totalPages = json.pagination.totalPages;
        totalItems = json.pagination.total;
        if (json.stats) { authEvents = json.stats.authEvents || 0; adminActions = json.stats.adminActions || 0; tradeActions = json.stats.tradeActions || 0; }
      }
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  function exportLogs() {
    const token = getToken();
    window.open(`${API}/api/v1/admin/audit-logs/export?token=${encodeURIComponent(token)}`, '_blank');
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => { searchQuery; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { currentPage = 1; fetchLogs(); }, 400); });
  $effect(() => { categoryFilter; currentPage = 1; fetchLogs(); });
  $effect(() => { currentPage; fetchLogs(); });

  onMount(() => { fetchLogs().finally(() => loading = false); });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">سجل المراجعة</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">تتبع جميع الأنشطة والإجراءات</p>
    </div>
    <div class="flex items-center gap-3">
      <button class="btn-secondary flex items-center gap-2" onclick={fetchLogs}><RefreshCw size={16} /><span>تحديث</span></button>
      <button class="btn-primary flex items-center gap-2" onclick={exportLogs}><FileDown size={16} /><span>تصدير</span></button>
    </div>
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" /><p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <div class="stat-card group">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(59,130,246,0.12);"><ShieldCheck size={20} style="color: #3b82f6;" /></div>
        <div><p class="text-xs" style="color: var(--text-tertiary);">أحداث المصادقة</p><p class="text-2xl font-bold tabular-nums" style="color: #3b82f6;">{authEvents.toLocaleString('ar-EG')}</p></div>
      </div>
    </div>
    <div class="stat-card group">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.12);"><ShieldAlert size={20} style="color: #a855f7;" /></div>
        <div><p class="text-xs" style="color: var(--text-tertiary);">إجراءات الإدارة</p><p class="text-2xl font-bold tabular-nums" style="color: #a855f7;">{adminActions.toLocaleString('ar-EG')}</p></div>
      </div>
    </div>
    <div class="stat-card group">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(34,211,164,0.12);"><ArrowLeftRight size={20} style="color: #22d3a4;" /></div>
        <div><p class="text-xs" style="color: var(--text-tertiary);">إجراءات التداول</p><p class="text-2xl font-bold tabular-nums" style="color: #22d3a4;">{tradeActions.toLocaleString('ar-EG')}</p></div>
      </div>
    </div>
  </div>

  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input type="text" class="input-field pr-10" placeholder="بحث بالإجراء أو المستخدم..." bind:value={searchQuery} dir="rtl" />
      </div>
      <div class="relative">
        <select class="input-field appearance-none cursor-pointer min-w-[160px]" bind:value={categoryFilter} dir="rtl">
          <option value="">كل الفئات</option>
          <option value="auth">المصادقة</option>
          <option value="admin">الإدارة</option>
          <option value="trade">التداول</option>
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="panel p-8 flex flex-col items-center gap-4">
      <Loader2 size={32} class="animate-spin" style="color: var(--accent-gold);" />
      <p class="text-sm" style="color: var(--text-secondary);">جارٍ تحميل السجلات...</p>
    </div>
  {:else if logs.length === 0}
    <EmptyState icon={Activity} title="لا توجد سجلات" description="ستظهر سجلات المراجعة هنا عند تسجيل أي نشاط" />
  {:else}
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto scrollbar-none">
        <table class="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th class="hidden md:table-cell">التفاصيل</th>
              <th class="hidden lg:table-cell">IP</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log (log.id)}
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
                    <Clock size={12} /><span class="text-xs whitespace-nowrap">{formatDate(log.createdAt)}</span>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <Pagination bind:page={currentPage} totalPages={totalPages} totalItems={totalItems} itemLabel="سجل" />
  {/if}
</div>
