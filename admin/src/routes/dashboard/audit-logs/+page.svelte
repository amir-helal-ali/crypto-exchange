<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search, Clock, Activity, RefreshCw, FileDown,
    AlertCircle, ShieldCheck, ShieldAlert, ArrowLeftRight, Loader2
  } from 'lucide-svelte';
  import { authGet, API, getToken } from '$lib/api/client';
  import type { AuditLog, PaginationMeta } from '$lib/api/types';
  import { getActionLabel, getActionPill, formatDate } from '$lib/utils/helpers';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { toast } from '$lib/stores/toast';

  // ─── State ──────────────────────────────────────────────────
  let logs = $state<AuditLog[]>([]);
  let pagination = $state<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let category = $state('');
  let page = $state(1);
  let refreshing = $state(false);

  let stats = $state({
    authEvents: 0,
    adminActions: 0,
    tradeActions: 0
  });

  // ─── Category Options ───────────────────────────────────────
  const categoryOptions = [
    { value: '', label: 'جميع الفئات' },
    { value: 'auth', label: 'أحداث المصادقة' },
    { value: 'admin', label: 'إجراءات المشرفين' },
    { value: 'trade', label: 'إجراءات التداول' }
  ];

  // ─── Fetch Data ─────────────────────────────────────────────
  async function fetchLogs() {
    try {
      error = '';
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        ...(search && { search }),
        ...(category && { category })
      });
      const res = await authGet(`/api/v1/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error('فشل تحميل سجل المراجعة');
      const json = await res.json();
      if (json.success) {
        logs = json.data;
        pagination = json.pagination;
        if (json.stats) stats = json.stats;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function handleRefresh() {
    refreshing = true;
    await fetchLogs();
    toast.success('تم تحديث السجل');
  }

  function handleExport() {
    const url = `${API}/api/v1/admin/audit-logs/export?token=${getToken()}`;
    window.open(url, '_blank');
    toast.info('جاري تصدير السجل');
  }

  function handleSearch() {
    page = 1;
    loading = true;
    fetchLogs();
  }

  function handleCategoryChange(e: Event) {
    category = (e.target as HTMLSelectElement).value;
    page = 1;
    loading = true;
    fetchLogs();
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  onMount(() => {
    fetchLogs();
  });

  $effect(() => {
    if (page) fetchLogs();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <PageHeader title="سجل المراجعة" subtitle="تتبع جميع الأنشطة والإجراءات">
    <button class="btn-ghost text-sm flex items-center gap-2" onclick={handleRefresh} disabled={refreshing}>
      {#if refreshing}
        <Loader2 size={16} class="animate-spin" />
      {:else}
        <RefreshCw size={16} />
      {/if}
      تحديث
    </button>
    <button class="btn-secondary text-sm flex items-center gap-2" onclick={handleExport}>
      <FileDown size={16} />
      تصدير
    </button>
  </PageHeader>

  <!-- Error -->
  {#if error}
    <ErrorAlert message={error} onclose={() => (error = '')} />
  {/if}

  <!-- Stat Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">أحداث المصادقة</p>
          <p class="text-3xl font-bold font-mono tabular-nums mt-1" style="color: #3b82f6;">
            {stats.authEvents.toLocaleString('ar-EG')}
          </p>
        </div>
        <div class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style="background: rgba(59,130,246,0.12); box-shadow: 0 0 20px rgba(59,130,246,0.12);">
          <ShieldCheck size={20} style="color: #3b82f6;" />
        </div>
      </div>
    </div>

    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">إجراءات المشرفين</p>
          <p class="text-3xl font-bold font-mono tabular-nums mt-1" style="color: #a855f7;">
            {stats.adminActions.toLocaleString('ar-EG')}
          </p>
        </div>
        <div class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style="background: rgba(168,85,247,0.12); box-shadow: 0 0 20px rgba(168,85,247,0.12);">
          <ShieldAlert size={20} style="color: #a855f7;" />
        </div>
      </div>
    </div>

    <div class="stat-card group">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">إجراءات التداول</p>
          <p class="text-3xl font-bold font-mono tabular-nums mt-1" style="color: #f5b544;">
            {stats.tradeActions.toLocaleString('ar-EG')}
          </p>
        </div>
        <div class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style="background: rgba(245,181,68,0.12); box-shadow: 0 0 20px rgba(245,181,68,0.12);">
          <ArrowLeftRight size={20} style="color: #f5b544;" />
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="panel p-4">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field pr-10 w-full"
          placeholder="بحث بالاسم أو الإجراء..."
          bind:value={search}
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
      <select class="input-field min-w-[160px]" onchange={handleCategoryChange}>
        {#each categoryOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <button class="btn-primary text-sm flex items-center gap-2" onclick={handleSearch}>
        <Search size={14} />
        بحث
      </button>
    </div>
  </div>

  <!-- Data Table -->
  <div class="panel overflow-hidden">
    {#if loading}
      <div class="p-6 space-y-4">
        {#each Array(6) as _}
          <div class="flex items-center gap-4">
            <div class="animate-shimmer h-9 w-9 rounded-full" style="background: rgba(255,255,255,0.04);"></div>
            <div class="flex-1 space-y-2">
              <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.04);"></div>
              <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.03);"></div>
            </div>
            <div class="animate-shimmer h-3 w-20 rounded" style="background: rgba(255,255,255,0.03);"></div>
          </div>
        {/each}
      </div>
    {:else if logs.length > 0}
      <div class="overflow-x-auto">
        <table class="data-table w-full">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th>التفاصيل</th>
              <th>عنوان IP</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log (log.id)}
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0" style="background: rgba(59,130,246,0.08); color: #3b82f6;">
                      {log.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span class="font-medium text-sm truncate max-w-[140px]">{log.username || '—'}</span>
                  </div>
                </td>
                <td>
                  <span class={getActionPill(log.action)}>{getActionLabel(log.action)}</span>
                </td>
                <td>
                  <span class="text-sm truncate max-w-[220px] block" style="color: var(--text-tertiary);">{log.details || '—'}</span>
                </td>
                <td>
                  <span class="text-xs font-mono tabular-nums" style="color: var(--text-quaternary);">{log.ipAddress || '—'}</span>
                </td>
                <td>
                  <div class="flex items-center gap-1.5 whitespace-nowrap">
                    <Clock size={12} style="color: var(--text-quaternary);" />
                    <span class="text-xs tabular-nums" style="color: var(--text-quaternary);">{formatDate(log.createdAt)}</span>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="px-5 pb-4">
        <Pagination bind:page={page} totalPages={pagination.totalPages} totalItems={pagination.total} itemLabel="سجل" />
      </div>
    {:else}
      <EmptyState icon={Activity} title="لا توجد سجلات" description="لم يتم العثور على سجلات مراجعة مطابقة لمعايير البحث" />
    {/if}
  </div>
</div>
