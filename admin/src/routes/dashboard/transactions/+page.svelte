<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search, Filter, ArrowLeftRight, CheckCircle2, XCircle, Clock, Copy,
    Check, ChevronLeft, AlertCircle, TrendingUp, TrendingDown, Hash,
    BellRing, RefreshCw, Loader2
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { AdminTransaction } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatDate, formatNumber, copyToClipboard } from '$lib/utils/helpers';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';

  type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED';

  let transactions = $state<AdminTransaction[]>([]);
  let totalPages = $state(1);
  let totalItems = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let statusFilter = $state<StatusFilter>('ALL');
  let currentPage = $state(1);
  const limit = 20;
  let approvingId = $state<number | null>(null);
  let rejectingId = $state<number | null>(null);
  let txIdInputs = $state<Record<number, string>>({});
  let copiedField = $state<string | null>(null);
  let sseConnected = $state(false);
  let eventSource: EventSource | null = null;

  const statusConfig: Record<string, { label: string; pillClass: string; color: string }> = {
    PENDING: { label: 'معلق', pillClass: 'pill-gold', color: '#f5b544' },
    COMPLETED: { label: 'مكتمل', pillClass: 'pill-mint', color: '#22d3a4' },
    REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', color: '#f43f7a' },
  };

  function getStatusConfig(status: string) { return statusConfig[status] || statusConfig.PENDING; }

  const typeLabels: Record<string, string> = { DEPOSIT: 'إيداع', WITHDRAWAL: 'سحب' };
  const typeConfig: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
    DEPOSIT: { label: 'إيداع', icon: TrendingUp, color: '#22d3a4' },
    WITHDRAWAL: { label: 'سحب', icon: TrendingDown, color: '#f43f7a' },
  };

  async function fetchTransactions() {
    loading = true; error = null;
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await authGet(`/api/v1/admin/transactions?${params}`);
      if (!res.ok) throw new Error('فشل تحميل المعاملات');
      const json = await res.json();
      if (json.success) {
        transactions = json.data;
        totalPages = json.meta.totalPages;
        totalItems = json.meta.total;
      }
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  async function approveTransaction(id: number) {
    approvingId = id;
    try {
      const txId = txIdInputs[id]?.trim();
      const payload: any = { status: 'COMPLETED' };
      if (txId) payload.tx_id = txId;
      const res = await authPut(`/api/v1/admin/transactions/${id}/review`, payload);
      if (!res.ok) throw new Error('فشل قبول المعاملة');
      transactions = transactions.map(t => t.id === id ? { ...t, status: 'COMPLETED', tx_id: txId || t.tx_id } : t);
    } catch (e: any) { error = e.message; }
    finally { approvingId = null; }
  }

  async function rejectTransaction(id: number) {
    rejectingId = id;
    try {
      const res = await authPut(`/api/v1/admin/transactions/${id}/review`, { status: 'REJECTED' });
      if (!res.ok) throw new Error('فشل رفض المعاملة');
      transactions = transactions.map(t => t.id === id ? { ...t, status: 'REJECTED' } : t);
    } catch (e: any) { error = e.message; }
    finally { rejectingId = null; }
  }

  async function handleCopy(text: string, field: string) {
    await copyToClipboard(text);
    copiedField = field;
    setTimeout(() => { copiedField = null; }, 2000);
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => { searchQuery; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { currentPage = 1; fetchTransactions(); }, 400); });
  $effect(() => { statusFilter; currentPage = 1; fetchTransactions(); });
  $effect(() => { currentPage; fetchTransactions(); });

  function connectSSE() {
    const es = createAdminStream(['transactions']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('transactions', () => { fetchTransactions(); });
    es.onerror = () => { sseConnected = false; setTimeout(() => { es.close(); connectSSE(); }, 5000); };
    return es;
  }

  onMount(() => {
    fetchTransactions().finally(() => loading = false);
    eventSource = connectSSE() ?? null;
    return () => { eventSource?.close(); };
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">المعاملات</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة الإيداعات والسحوبات</p>
    </div>
    <div class="flex items-center gap-3">
      <LiveIndicator connected={sseConnected} />
      <button class="btn-secondary flex items-center gap-2" onclick={fetchTransactions}>
        <RefreshCw size={16} /><span>تحديث</span>
      </button>
    </div>
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" /><p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input type="text" class="input-field pr-10" placeholder="بحث بالاسم أو العملة..." bind:value={searchQuery} dir="rtl" />
      </div>
      <div class="relative">
        <select class="input-field appearance-none cursor-pointer min-w-[140px]" bind:value={statusFilter} dir="rtl">
          <option value="ALL">كل الحالات</option>
          <option value="PENDING">معلق</option>
          <option value="COMPLETED">مكتمل</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(6) as _}
        <div class="panel p-4 flex items-center gap-4">
          <div class="animate-shimmer h-10 w-10 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
          <div class="flex-1 space-y-2">
            <div class="animate-shimmer h-4 w-1/3 rounded" style="background: rgba(255,255,255,0.06);"></div>
            <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.04);"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if transactions.length === 0}
    <EmptyState icon={ArrowLeftRight} title="لا توجد معاملات" />
  {:else}
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto scrollbar-none">
        <table class="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th class="hidden md:table-cell">العنوان</th>
              <th class="hidden lg:table-cell">TX ID</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each transactions as tx (tx.id)}
              {@const sc = getStatusConfig(tx.status)}
              {@const tc = typeConfig[tx.type] || typeConfig.DEPOSIT}
              <tr>
                <td>
                  <div class="min-w-0">
                    <p class="font-medium truncate">{tx.username || '—'}</p>
                    <p class="text-xs truncate" style="color: var(--text-quaternary);" dir="ltr">{tx.email}</p>
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-1.5">
                    <tc.icon size={14} style="color: {tc.color};" />
                    <span style="color: {tc.color};">{tc.label}</span>
                  </div>
                </td>
                <td>
                  <span class="font-mono font-semibold tabular-nums">{formatNumber(tx.amount)}</span>
                  <span class="text-xs" style="color: var(--text-quaternary);"> {tx.currency}</span>
                </td>
                <td><span class={sc.pillClass}>{sc.label}</span></td>
                <td class="hidden md:table-cell">
                  {#if tx.address}
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-mono truncate max-w-[120px]" style="color: var(--text-quaternary);" dir="ltr">{tx.address}</span>
                      <button class="btn-ghost p-1 rounded" onclick={() => handleCopy(tx.address, `addr-${tx.id}`)}>
                        {#if copiedField === `addr-${tx.id}`}<Check size={12} style="color: #22d3a4;" />{:else}<Copy size={12} />{/if}
                      </button>
                    </div>
                  {:else}<span style="color: var(--text-quaternary);">—</span>{/if}
                </td>
                <td class="hidden lg:table-cell">
                  {#if tx.tx_id}
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-mono truncate max-w-[120px]" style="color: var(--text-quaternary);" dir="ltr">{tx.tx_id}</span>
                      <button class="btn-ghost p-1 rounded" onclick={() => handleCopy(tx.tx_id, `tx-${tx.id}`)}>
                        {#if copiedField === `tx-${tx.id}`}<Check size={12} style="color: #22d3a4;" />{:else}<Copy size={12} />{/if}
                      </button>
                    </div>
                  {:else if tx.status === 'PENDING'}
                    <input type="text" class="input-field text-xs !py-1.5 !px-2 font-mono" style="width: 140px;"
                      placeholder="أدخل TX ID" dir="ltr"
                      value={txIdInputs[tx.id] || ''}
                      oninput={(e) => { txIdInputs = { ...txIdInputs, [tx.id]: (e.target as HTMLInputElement).value }; }}
                    />
                  {:else}<span style="color: var(--text-quaternary);">—</span>{/if}
                </td>
                <td>
                  {#if tx.status === 'PENDING'}
                    <div class="flex items-center gap-1">
                      <button class="btn-buy !px-3 !py-1.5 !text-xs flex items-center gap-1" onclick={() => approveTransaction(tx.id)} disabled={approvingId === tx.id}>
                        {#if approvingId === tx.id}<Loader2 size={12} class="animate-spin" />{:else}<CheckCircle2 size={12} />{/if}قبول
                      </button>
                      <button class="btn-danger !px-3 !py-1.5 !text-xs flex items-center gap-1" onclick={() => rejectTransaction(tx.id)} disabled={rejectingId === tx.id}>
                        {#if rejectingId === tx.id}<Loader2 size={12} class="animate-spin" />{:else}<XCircle size={12} />{/if}رفض
                      </button>
                    </div>
                  {:else}
                    <span class="text-xs" style="color: var(--text-quaternary);">{formatDate(tx.createdAt)}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <Pagination bind:page={currentPage} totalPages={totalPages} totalItems={totalItems} itemLabel="معاملة" />
  {/if}
</div>
