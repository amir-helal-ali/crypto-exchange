<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search,
    Filter,
    ArrowLeftRight,
    CheckCircle2,
    XCircle,
    Clock,
    Copy,
    Check,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Hash,
    BellRing,
    RefreshCw,
    Loader2
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { AdminTransaction } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';

  // ─── Types ───
  type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED';

  interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }

  interface TransactionsResponse {
    success: boolean;
    data: AdminTransaction[];
    meta: PaginationMeta;
  }

  // ─── State ───
  let transactions = $state<AdminTransaction[]>([]);
  let meta = $state<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let searchQuery = $state('');
  let statusFilter = $state<StatusFilter>('ALL');
  let currentPage = $state(1);
  const limit = 20;

  // Action state
  let approvingId = $state<number | null>(null);
  let rejectingId = $state<number | null>(null);
  let txIdInputs = $state<Record<number, string>>({});
  let actionError = $state<Record<number, string>>({});

  // Copy feedback
  let copiedField = $state<string | null>(null);

  // SSE live indicator
  let sseConnected = $state(false);
  let newTransactionCount = $state(0);

  // Debounce timer
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let debouncedSearch = $state('');

  // ─── Status config ───
  const statusConfig: Record<string, { label: string; pillClass: string; icon: typeof Clock }> = {
    PENDING: { label: 'معلق', pillClass: 'pill-gold', icon: Clock },
    COMPLETED: { label: 'مكتمل', pillClass: 'pill-mint', icon: CheckCircle2 },
    REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', icon: XCircle }
  };

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'الكل' },
    { value: 'PENDING', label: 'معلق' },
    { value: 'COMPLETED', label: 'مكتمل' },
    { value: 'REJECTED', label: 'مرفوض' }
  ];

  // ─── Derived ───
  let stats = $derived({
    pending: transactions.filter((t) => t.status === 'PENDING').length,
    completed: transactions.filter((t) => t.status === 'COMPLETED').length,
    rejected: transactions.filter((t) => t.status === 'REJECTED').length
  });

  let pages = $derived.by(() => {
    const arr: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(meta.totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  });

  // ─── Helpers ───
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

  function formatAmount(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  }

  function truncateMiddle(str: string, maxLen: number = 16): string {
    if (!str || str.length <= maxLen) return str || '—';
    const half = Math.floor(maxLen / 2);
    return str.slice(0, half) + '...' + str.slice(-half);
  }

  async function copyToClipboard(text: string, fieldId: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copiedField = fieldId;
      setTimeout(() => {
        copiedField = null;
      }, 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copiedField = fieldId;
      setTimeout(() => {
        copiedField = null;
      }, 2000);
    }
  }

  // ─── Fetch ───
  async function fetchTransactions() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit)
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await authGet(`/api/v1/admin/transactions?${params}`);
      if (!res.ok) throw new Error('فشل تحميل المعاملات');
      const json: TransactionsResponse = await res.json();
      if (json.success) {
        transactions = json.data;
        meta = json.meta;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ─── Actions ───
  async function approveTransaction(id: number) {
    const txId = txIdInputs[id]?.trim();
    if (!txId) {
      actionError[id] = 'يرجى إدخال معرف المعاملة (TxID)';
      return;
    }
    approvingId = id;
    actionError[id] = '';
    try {
      const res = await authPut(`/api/v1/admin/transactions/${id}/review`, {
        action: 'approve',
        tx_id: txId
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'فشل قبول المعاملة');
      }
      // Update local state optimistically
      transactions = transactions.map((t) =>
        t.id === id ? { ...t, status: 'COMPLETED', tx_id: txId } : t
      );
      delete txIdInputs[id];
    } catch (e: any) {
      actionError[id] = e.message;
    } finally {
      approvingId = null;
    }
  }

  async function rejectTransaction(id: number) {
    rejectingId = id;
    actionError[id] = '';
    try {
      const res = await authPut(`/api/v1/admin/transactions/${id}/review`, {
        action: 'reject'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'فشل رفض المعاملة');
      }
      transactions = transactions.map((t) =>
        t.id === id ? { ...t, status: 'REJECTED' } : t
      );
    } catch (e: any) {
      actionError[id] = e.message;
    } finally {
      rejectingId = null;
    }
  }

  // ─── Filter handlers ───
  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch = searchQuery;
      currentPage = 1;
      fetchTransactions();
    }, 400);
  }

  function handleStatusChange(status: StatusFilter) {
    statusFilter = status;
    currentPage = 1;
    fetchTransactions();
  }

  function goToPage(page: number) {
    if (page < 1 || page > meta.totalPages || page === currentPage) return;
    currentPage = page;
    fetchTransactions();
  }

  // ─── SSE ───
  function connectSSE() {
    const es = createAdminStream(['transaction']);
    if (!es) return null;

    es.onopen = () => {
      sseConnected = true;
    };

    es.addEventListener('transaction', () => {
      newTransactionCount++;
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

  function refreshWithNew() {
    newTransactionCount = 0;
    fetchTransactions();
  }

  // ─── Lifecycle ───
  let eventSource: EventSource | null = $state(null);

  onMount(() => {
    fetchTransactions();
    eventSource = connectSSE();

    return () => {
      eventSource?.close();
    };
  });
</script>

<!-- ─── Page Content ─── -->
<div class="relative z-10 space-y-6">

  <!-- ─── Header ─── -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">المعاملات</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة الإيداعات والسحوبات</p>
    </div>

    <div class="flex items-center gap-3">
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

      {#if newTransactionCount > 0}
        <button
          class="pill-gold flex items-center gap-2 cursor-pointer animate-pulse-glow"
          onclick={refreshWithNew}
        >
          <BellRing size={14} />
          <span>{newTransactionCount} معاملة جديدة</span>
          <RefreshCw size={12} />
        </button>
      {/if}
    </div>
  </div>

  <!-- ─── Error Banner ─── -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="btn-ghost mr-auto" onclick={() => fetchTransactions()}>
        <RefreshCw size={14} />
      </button>
    </div>
  {/if}

  <!-- ─── Stats Row ─── -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="stat-card flex items-center gap-4">
      <div class="flex items-center justify-center w-11 h-11 rounded-xl" style="background: rgba(245,181,68,0.12);">
        <Clock size={20} style="color: #f5b544;" />
      </div>
      <div>
        <p class="text-xs font-medium" style="color: var(--text-tertiary);">معلق</p>
        <p class="text-2xl font-bold font-mono" style="color: #f5b544;">{stats.pending}</p>
      </div>
    </div>

    <div class="stat-card flex items-center gap-4">
      <div class="flex items-center justify-center w-11 h-11 rounded-xl" style="background: rgba(34,211,164,0.12);">
        <CheckCircle2 size={20} style="color: #22d3a4;" />
      </div>
      <div>
        <p class="text-xs font-medium" style="color: var(--text-tertiary);">مكتمل</p>
        <p class="text-2xl font-bold font-mono" style="color: #22d3a4;">{stats.completed}</p>
      </div>
    </div>

    <div class="stat-card flex items-center gap-4">
      <div class="flex items-center justify-center w-11 h-11 rounded-xl" style="background: rgba(244,63,122,0.12);">
        <XCircle size={20} style="color: #f43f7a;" />
      </div>
      <div>
        <p class="text-xs font-medium" style="color: var(--text-tertiary);">مرفوض</p>
        <p class="text-2xl font-bold font-mono" style="color: #f43f7a;">{stats.rejected}</p>
      </div>
    </div>
  </div>

  <!-- ─── Filters ─── -->
  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row gap-3">
      <!-- Search -->
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field pr-10"
          placeholder="بحث باسم المستخدم، البريد، أو العملة..."
          bind:value={searchQuery}
          oninput={handleSearchInput}
        />
      </div>

      <!-- Status Filter -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <Filter size={16} style="color: var(--text-quaternary);" class="shrink-0" />
        {#each filterOptions as opt}
          <button
            class="px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            class:ring-1={statusFilter === opt.value}
            style={statusFilter === opt.value
              ? 'background: rgba(245,181,68,0.12); color: #f5b544; ring-color: rgba(245,181,68,0.3);'
              : 'background: rgba(255,255,255,0.04); color: var(--text-secondary);'}
            onclick={() => handleStatusChange(opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ─── Data Table ─── -->
  <div class="panel overflow-hidden">
    <div class="overflow-x-auto scrollbar-none">
      <table class="w-full text-sm">
        <thead>
          <tr style="color: var(--text-tertiary); background: rgba(255,255,255,0.02);" class="text-xs">
            <th class="text-right py-3.5 px-4 font-medium">المستخدم</th>
            <th class="text-right py-3.5 px-4 font-medium">النوع</th>
            <th class="text-right py-3.5 px-4 font-medium">العملة</th>
            <th class="text-right py-3.5 px-4 font-medium">المبلغ</th>
            <th class="text-right py-3.5 px-4 font-medium">الحالة</th>
            <th class="text-right py-3.5 px-4 font-medium hidden lg:table-cell">العنوان</th>
            <th class="text-right py-3.5 px-4 font-medium hidden xl:table-cell">TxID</th>
            <th class="text-right py-3.5 px-4 font-medium">الإجراءات</th>
          </tr>
        </thead>

        <tbody>
          {#if loading}
            <!-- Skeleton rows -->
            {#each Array(8) as _, i}
              <tr class="border-t" style="border-color: var(--border-subtle);">
                <td class="py-3.5 px-4" colspan="8">
                  <div class="flex items-center gap-4">
                    <div class="animate-shimmer h-8 w-8 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
                    <div class="flex-1 space-y-2">
                      <div class="animate-shimmer h-3 w-1/4 rounded" style="background: rgba(255,255,255,0.06);"></div>
                      <div class="animate-shimmer h-3 w-1/6 rounded" style="background: rgba(255,255,255,0.04);"></div>
                    </div>
                  </div>
                </td>
              </tr>
            {/each}
          {:else if transactions.length === 0}
            <tr>
              <td colspan="8" class="py-16 text-center">
                <ArrowLeftRight size={48} class="mx-auto mb-4 opacity-20" style="color: var(--text-quaternary);" />
                <p class="text-sm font-medium" style="color: var(--text-quaternary);">لا توجد معاملات</p>
                <p class="text-xs mt-1" style="color: var(--text-quaternary);">قم بتغيير عوامل التصفية أو انتظر معاملات جديدة</p>
              </td>
            </tr>
          {:else}
            {#each transactions as tx (tx.id)}
              {@const cfg = statusConfig[tx.status] ?? statusConfig.PENDING}
              {@const isPending = tx.status === 'PENDING'}
              {@const isActing = approvingId === tx.id || rejectingId === tx.id}
              <tr
                class="border-t transition-colors hover:bg-white/[0.02]"
                style="border-color: var(--border-subtle);"
              >
                <!-- المستخدم -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                      style="background: rgba(168,85,247,0.12); color: #a855f7;"
                    >
                      {tx.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium truncate max-w-[130px]">{tx.username || '—'}</p>
                      <p class="text-xs truncate max-w-[130px]" style="color: var(--text-quaternary);">{tx.email || '—'}</p>
                    </div>
                  </div>
                </td>

                <!-- النوع -->
                <td class="py-3.5 px-4">
                  {#if tx.type === 'deposit'}
                    <span class="pill-mint">
                      <TrendingUp size={12} />
                      إيداع
                    </span>
                  {:else}
                    <span class="pill-rose">
                      <TrendingDown size={12} />
                      سحب
                    </span>
                  {/if}
                </td>

                <!-- العملة -->
                <td class="py-3.5 px-4">
                  <span class="font-mono font-semibold text-xs" style="color: var(--accent-cyan);">
                    {tx.currency?.toUpperCase() || '—'}
                  </span>
                </td>

                <!-- المبلغ -->
                <td class="py-3.5 px-4">
                  <span class="font-mono font-semibold tabular-nums">
                    {formatAmount(tx.amount)}
                  </span>
                </td>

                <!-- الحالة -->
                <td class="py-3.5 px-4">
                  <span class={cfg.pillClass}>
                    <cfg.icon size={12} />
                    {cfg.label}
                  </span>
                </td>

                <!-- العنوان -->
                <td class="py-3.5 px-4 hidden lg:table-cell">
                  {#if tx.address}
                    <div class="flex items-center gap-1.5">
                      <span
                        class="font-mono text-xs truncate max-w-[140px] cursor-pointer hover:underline"
                        style="color: var(--text-secondary);"
                        title={tx.address}
                        onclick={() => copyToClipboard(tx.address, `addr-${tx.id}`)}
                      >
                        {truncateMiddle(tx.address)}
                      </span>
                      <button
                        class="shrink-0 p-1 rounded transition-colors hover:bg-white/5 cursor-pointer"
                        onclick={() => copyToClipboard(tx.address, `addr-${tx.id}`)}
                        title="نسخ العنوان"
                      >
                        {#if copiedField === `addr-${tx.id}`}
                          <Check size={12} style="color: #22d3a4;" />
                        {:else}
                          <Copy size={12} style="color: var(--text-quaternary);" />
                        {/if}
                      </button>
                    </div>
                  {:else}
                    <span style="color: var(--text-quaternary);">—</span>
                  {/if}
                </td>

                <!-- TxID -->
                <td class="py-3.5 px-4 hidden xl:table-cell">
                  {#if tx.tx_id}
                    <div class="flex items-center gap-1.5">
                      <span
                        class="font-mono text-xs truncate max-w-[140px] cursor-pointer hover:underline"
                        style="color: var(--text-secondary);"
                        title={tx.tx_id}
                        onclick={() => copyToClipboard(tx.tx_id, `txid-${tx.id}`)}
                      >
                        {truncateMiddle(tx.tx_id)}
                      </span>
                      <button
                        class="shrink-0 p-1 rounded transition-colors hover:bg-white/5 cursor-pointer"
                        onclick={() => copyToClipboard(tx.tx_id, `txid-${tx.id}`)}
                        title="نسخ TxID"
                      >
                        {#if copiedField === `txid-${tx.id}`}
                          <Check size={12} style="color: #22d3a4;" />
                        {:else}
                          <Copy size={12} style="color: var(--text-quaternary);" />
                        {/if}
                      </button>
                    </div>
                  {:else}
                    <span style="color: var(--text-quaternary);">—</span>
                  {/if}
                </td>

                <!-- الإجراءات -->
                <td class="py-3.5 px-4">
                  {#if isPending}
                    <div class="space-y-2 min-w-[200px]">
                      <!-- Inline TxID input for approve -->
                      <div class="flex items-center gap-2">
                        <div class="relative flex-1">
                          <Hash size={12} class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
                          <input
                            type="text"
                            class="w-full px-3 py-1.5 pr-8 rounded-lg text-xs font-mono outline-none transition-all"
                            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary);"
                            placeholder="أدخل TxID..."
                            bind:value={txIdInputs[tx.id]}
                            onfocus={(e) => {
                              (e.target as HTMLInputElement).style.borderColor = 'rgba(245,181,68,0.5)';
                              (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(245,181,68,0.1)';
                            }}
                            onblur={(e) => {
                              (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
                              (e.target as HTMLInputElement).style.boxShadow = 'none';
                            }}
                          />
                        </div>
                        <button
                          class="btn-buy px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                          onclick={() => approveTransaction(tx.id)}
                          disabled={isActing}
                        >
                          {#if approvingId === tx.id}
                            <Loader2 size={12} class="animate-spin" />
                          {:else}
                            <CheckCircle2 size={12} />
                          {/if}
                          قبول
                        </button>
                      </div>

                      <!-- Reject button -->
                      <div class="flex items-center gap-2">
                        <button
                          class="btn-danger px-3 py-1.5 text-xs flex items-center gap-1"
                          onclick={() => rejectTransaction(tx.id)}
                          disabled={isActing}
                        >
                          {#if rejectingId === tx.id}
                            <Loader2 size={12} class="animate-spin" />
                          {:else}
                            <XCircle size={12} />
                          {/if}
                          رفض
                        </button>

                        {#if actionError[tx.id]}
                          <span class="text-xs" style="color: #f43f7a;">{actionError[tx.id]}</span>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <span class="text-xs" style="color: var(--text-quaternary);">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- ─── Pagination ─── -->
    {#if !loading && meta.totalPages > 1}
      <div class="glass-divider"></div>
      <div class="flex items-center justify-between px-4 py-3">
        <p class="text-xs" style="color: var(--text-quaternary);">
          عرض {((currentPage - 1) * limit) + 1}–{Math.min(currentPage * limit, meta.total)} من {meta.total}
        </p>

        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronRight size={16} style="color: var(--text-secondary);" />
          </button>

          {#if pages[0] > 1}
            <button
              class="w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:bg-white/5"
              style="color: var(--text-secondary);"
              onclick={() => goToPage(1)}
            >
              1
            </button>
            {#if pages[0] > 2}
              <span class="w-8 text-center text-xs" style="color: var(--text-quaternary);">...</span>
            {/if}
          {/if}

          {#each pages as p}
            <button
              class="w-8 h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer {p !== currentPage ? 'hover:bg-white/5' : ''}"
              style={p === currentPage
                ? 'background: rgba(245,181,68,0.15); color: #f5b544;'
                : 'color: var(--text-secondary);'}
              onclick={() => goToPage(p)}
            >
              {p}
            </button>
          {/each}

          {#if pages[pages.length - 1] < meta.totalPages}
            {#if pages[pages.length - 1] < meta.totalPages - 1}
              <span class="w-8 text-center text-xs" style="color: var(--text-quaternary);">...</span>
            {/if}
            <button
              class="w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:bg-white/5"
              style="color: var(--text-secondary);"
              onclick={() => goToPage(meta.totalPages)}
            >
              {meta.totalPages}
            </button>
          {/if}

          <button
            class="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= meta.totalPages}
          >
            <ChevronLeft size={16} style="color: var(--text-secondary);" />
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
