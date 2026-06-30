<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShieldCheck,
    Search,
    Filter,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    Loader2,
    X,
    Send,
    BellRing,
    Image,
    BadgeCheck
  } from 'lucide-svelte';
  import { authGet, authPut, API, getToken } from '$lib/api/client';
  import type { KYCRequest } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';

  // ─── Types ───
  interface KYCPageResponse {
    success: boolean;
    data: KYCRequest[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  interface KYCStats {
    pending: number;
    approved: number;
    rejected: number;
  }

  // ─── State ───
  let kycRequests = $state<KYCRequest[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let page = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  const limit = 20;

  let searchQuery = $state('');
  let statusFilter = $state<string>('');
  let stats = $state<KYCStats>({ pending: 0, approved: 0, rejected: 0 });

  // ─── Document preview modal ───
  let previewOpen = $state(false);
  let previewUrl = $state('');
  let previewType = $state<'image' | 'pdf'>('image');
  let previewName = $state('');

  // ─── Reject dialog ───
  let rejectDialogOpen = $state(false);
  let rejectTargetId = $state<number | null>(null);
  let rejectReason = $state('');
  let rejectLoading = $state(false);

  // ─── SSE live indicator ───
  let sseConnected = $state(false);
  let newKycCount = $state(0);
  let newKycFlash = $state(false);

  // ─── Action loading per card ───
  let actionLoadingId = $state<number | null>(null);

  // ─── Document type labels (Arabic) ───
  const docTypeLabels: Record<string, string> = {
    PASSPORT: 'جواز سفر',
    NATIONAL_ID: 'بطاقة وطنية',
    DRIVERS_LICENSE: 'رخصة قيادة',
    UTILITY_BILL: 'فاتورة مرافق',
    BANK_STATEMENT: 'كشف حساب بنكي',
    SELFIE: 'صورة شخصية'
  };

  // ─── Status config ───
  const statusConfig: Record<string, { label: string; pillClass: string; icon: typeof Clock; color: string }> = {
    PENDING: { label: 'قيد المراجعة', pillClass: 'pill-gold', icon: Clock, color: '#f5b544' },
    APPROVED: { label: 'مقبول', pillClass: 'pill-mint', icon: CheckCircle2, color: '#22d3a4' },
    REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', icon: XCircle, color: '#f43f7a' }
  };

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

  function getDocTypeLabel(type: string): string {
    return docTypeLabels[type] || type;
  }

  function detectDocType(url: string): 'image' | 'pdf' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('.pdf?')) return 'pdf';
    return 'image';
  }

  function maskDocNumber(num: string): string {
    if (!num || num.length <= 4) return num;
    return num.slice(0, -4).replace(/./g, '•') + num.slice(-4);
  }

  function getStatusConfig(status: string) {
    return statusConfig[status] || statusConfig.PENDING;
  }

  // ─── Fetch KYC requests ───
  async function fetchKYC() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await authGet(`/api/v1/admin/kyc?${params.toString()}`);
      if (!res.ok) throw new Error('فشل تحميل طباتات KYC');
      const json: KYCPageResponse = await res.json();

      if (json.success) {
        kycRequests = json.data;
        totalPages = json.pagination.totalPages;
        totalItems = json.pagination.total;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ─── Fetch stats ───
  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/kyc/stats');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        stats = json.data;
      }
    } catch {
      // non-fatal
    }
  }

  // ─── Approve KYC ───
  async function approveKYC(id: number) {
    actionLoadingId = id;
    try {
      const res = await authPut(`/api/v1/admin/kyc/${id}/review`, { status: 'APPROVED' });
      if (!res.ok) throw new Error('فشل قبول الطلب');
      // Update local state
      kycRequests = kycRequests.map((r) =>
        r.id === id ? { ...r, status: 'APPROVED' } : r
      );
      stats = { ...stats, pending: Math.max(0, stats.pending - 1), approved: stats.approved + 1 };
    } catch (e: any) {
      error = e.message;
    } finally {
      actionLoadingId = null;
    }
  }

  // ─── Open reject dialog ───
  function openRejectDialog(id: number) {
    rejectTargetId = id;
    rejectReason = '';
    rejectDialogOpen = true;
  }

  // ─── Submit rejection ───
  async function submitRejection() {
    if (!rejectTargetId || !rejectReason.trim()) return;
    rejectLoading = true;
    try {
      const res = await authPut(`/api/v1/admin/kyc/${rejectTargetId}/review`, {
        status: 'REJECTED',
        rejection_reason: rejectReason.trim()
      });
      if (!res.ok) throw new Error('فشل رفض الطلب');
      kycRequests = kycRequests.map((r) =>
        r.id === rejectTargetId ? { ...r, status: 'REJECTED', rejection_reason: rejectReason.trim() } : r
      );
      stats = { ...stats, pending: Math.max(0, stats.pending - 1), rejected: stats.rejected + 1 };
      rejectDialogOpen = false;
    } catch (e: any) {
      error = e.message;
    } finally {
      rejectLoading = false;
    }
  }

  // ─── Document preview ───
  function openPreview(kyc: KYCRequest) {
    previewUrl = kyc.document_url;
    previewType = detectDocType(kyc.document_url);
    previewName = `${kyc.full_name} — ${getDocTypeLabel(kyc.document_type)}`;
    previewOpen = true;
  }

  function closePreview() {
    previewOpen = false;
    previewUrl = '';
  }

  // ─── Search debounce ───
  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => {
    searchQuery; // track
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      page = 1;
      fetchKYC();
    }, 400);
  });

  // ─── Status filter change ───
  $effect(() => {
    statusFilter; // track
    page = 1;
    fetchKYC();
  });

  // ─── Page change ───
  $effect(() => {
    page; // track
    fetchKYC();
  });

  // ─── SSE ───
  let eventSource: EventSource | null = null;

  function connectSSE() {
    const es = createAdminStream(['kyc']);
    if (!es) return;

    es.onopen = () => {
      sseConnected = true;
    };

    es.addEventListener('kyc', () => {
      newKycCount++;
      newKycFlash = true;
      setTimeout(() => (newKycFlash = false), 2000);
      // Refresh stats
      fetchStats();
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

  function handleNewKycClick() {
    newKycCount = 0;
    page = 1;
    fetchKYC();
    fetchStats();
  }

  // ─── Lifecycle ───
  onMount(() => {
    (async () => {
      await Promise.all([fetchKYC(), fetchStats()]);
      loading = false;
    })();

    eventSource = connectSSE() ?? null;

    return () => {
      eventSource?.close();
    };
  });

  // ─── Pagination helpers ───
  let pages = $derived.by(() => {
    const arr: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  });

  // ─── Stat cards config ───
  const statCards = $derived([
    {
      label: 'قيد المراجعة',
      count: stats.pending,
      icon: Clock,
      pillClass: 'pill-gold',
      iconBg: 'rgba(245,181,68,0.12)',
      iconColor: '#f5b544'
    },
    {
      label: 'مقبول',
      count: stats.approved,
      icon: CheckCircle2,
      pillClass: 'pill-mint',
      iconBg: 'rgba(34,211,164,0.12)',
      iconColor: '#22d3a4'
    },
    {
      label: 'مرفوض',
      count: stats.rejected,
      icon: XCircle,
      pillClass: 'pill-rose',
      iconBg: 'rgba(244,63,122,0.12)',
      iconColor: '#f43f7a'
    }
  ]);
</script>

<!-- ─── Document Preview Modal ─── -->
{#if previewOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onkeydown={(e) => e.key === 'Escape' && closePreview()}
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-md"
      onclick={closePreview}
      role="presentation"
    ></div>

    <!-- Modal content -->
    <div class="relative z-10 w-full max-w-4xl max-h-[90vh] panel overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-subtle);">
        <div class="flex items-center gap-3">
          <BadgeCheck size={20} style="color: var(--accent-gold);" />
          <div>
            <h3 class="font-bold text-sm">{previewName}</h3>
            <p class="text-xs" style="color: var(--text-tertiary);">معاينة المستند</p>
          </div>
        </div>
        <button
          class="btn-ghost rounded-lg p-2"
          onclick={closePreview}
          aria-label="إغلاق"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
        {#if previewType === 'pdf'}
          <iframe
            src={previewUrl}
            class="w-full h-[70vh] rounded-xl border"
            style="border-color: var(--border-subtle); background: white;"
            title="معاينة PDF"
          ></iframe>
        {:else}
          <img
            src={previewUrl}
            alt={previewName}
            class="max-w-full max-h-[70vh] rounded-xl object-contain"
            style="border: 1px solid var(--border-subtle);"
          />
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ─── Reject Dialog ─── -->
{#if rejectDialogOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onkeydown={(e) => e.key === 'Escape' && (rejectDialogOpen = false)}
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-md"
      onclick={() => (rejectDialogOpen = false)}
      role="presentation"
    ></div>

    <!-- Dialog -->
    <div class="relative z-10 w-full max-w-md panel p-6 space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(244,63,122,0.12);">
            <XCircle size={20} style="color: #f43f7a;" />
          </div>
          <h3 class="font-bold">رفض طلب التحقق</h3>
        </div>
        <button
          class="btn-ghost rounded-lg p-1.5"
          onclick={() => (rejectDialogOpen = false)}
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>
      </div>

      <div>
        <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
          سبب الرفض <span style="color: #f43f7a;">*</span>
        </label>
        <textarea
          class="input-field min-h-[120px] resize-y"
          bind:value={rejectReason}
          placeholder="أدخل سبب رفض الطلب..."
          dir="rtl"
        ></textarea>
      </div>

      <div class="flex items-center gap-3 justify-end">
        <button
          class="btn-secondary"
          onclick={() => (rejectDialogOpen = false)}
          disabled={rejectLoading}
        >
          إلغاء
        </button>
        <button
          class="btn-danger flex items-center gap-2"
          onclick={submitRejection}
          disabled={rejectLoading || !rejectReason.trim()}
        >
          {#if rejectLoading}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            <Send size={16} />
          {/if}
          رفض الطلب
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Main Content ─── -->
<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">التحقق KYC</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">مراجعة طباتات التحقق من الهوية</p>
    </div>

    <div class="flex items-center gap-3">
      <!-- SSE Live indicator -->
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

      <!-- New KYC indicator -->
      {#if newKycCount > 0}
        <button
          class="pill-gold flex items-center gap-2 cursor-pointer animate-pulse-glow transition-all"
          onclick={handleNewKycClick}
        >
          <BellRing size={14} />
          <span>{newKycCount} طلب جديد</span>
          <ChevronLeft size={14} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => (error = null)}>إغلاق</button>
    </div>
  {/if}

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    {#each statCards as card}
      <div class="stat-card group">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">{card.label}</p>
            <p class="text-3xl font-bold font-mono tabular-nums" style="color: {card.iconColor};">
              {card.count.toLocaleString('ar-EG')}
            </p>
          </div>
          <div
            class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
            style="background: {card.iconBg};"
          >
            <card.icon size={22} style="color: {card.iconColor};" />
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Search & Filter Bar -->
  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1">
        <Search
          size={18}
          class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style="color: var(--text-quaternary);"
        />
        <input
          type="text"
          class="input-field pr-10"
          placeholder="بحث باسم المستخدم أو البريد الإلكتروني..."
          bind:value={searchQuery}
          dir="rtl"
        />
      </div>

      <!-- Status Filter -->
      <div class="relative">
        <Filter
          size={16}
          class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style="color: var(--text-quaternary);"
        />
        <select
          class="input-field pr-9 pl-8 appearance-none cursor-pointer min-w-[160px]"
          bind:value={statusFilter}
          dir="rtl"
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
        <ChevronLeft
          size={14}
          class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style="color: var(--text-quaternary);"
        />
      </div>
    </div>
  </div>

  <!-- KYC Cards List -->
  <div class="space-y-4">
    {#if loading}
      <!-- Skeleton -->
      {#each Array(6) as _}
        <div class="panel p-5">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4 flex-1">
              <div class="animate-shimmer h-12 w-12 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
              <div class="space-y-2 flex-1">
                <div class="animate-shimmer h-4 w-40 rounded" style="background: rgba(255,255,255,0.06);"></div>
                <div class="animate-shimmer h-3 w-56 rounded" style="background: rgba(255,255,255,0.04);"></div>
              </div>
            </div>
            <div class="animate-shimmer h-7 w-24 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
          </div>
          <div class="mt-4 flex gap-4">
            <div class="animate-shimmer h-3 w-32 rounded" style="background: rgba(255,255,255,0.04);"></div>
            <div class="animate-shimmer h-3 w-28 rounded" style="background: rgba(255,255,255,0.04);"></div>
            <div class="animate-shimmer h-3 w-36 rounded" style="background: rgba(255,255,255,0.04);"></div>
          </div>
          <div class="mt-4 flex gap-2 justify-end">
            <div class="animate-shimmer h-9 w-24 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
            <div class="animate-shimmer h-9 w-24 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
            <div class="animate-shimmer h-9 w-24 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
          </div>
        </div>
      {/each}
    {:else if kycRequests.length === 0}
      <!-- Empty state -->
      <div class="panel p-16 text-center">
        <ShieldCheck size={48} class="mx-auto mb-4 opacity-20" style="color: var(--text-quaternary);" />
        <p class="text-lg font-bold" style="color: var(--text-secondary);">لا توجد طباتات تحقق</p>
        <p class="text-sm mt-1" style="color: var(--text-quaternary);">
          {statusFilter || searchQuery ? 'جرّب تغيير عوامل التصفية' : 'ستظهر طباتات التحقق هنا عند تقديمها'}
        </p>
      </div>
    {:else}
      {#each kycRequests as kyc (kyc.id)}
        {@const sc = getStatusConfig(kyc.status)}
        {@const isPending = kyc.status === 'PENDING'}
        {@const isActing = actionLoadingId === kyc.id}

        <div class="panel p-5 transition-all duration-300 hover:border-white/[0.12]">
          <!-- Top row: user info + status pill -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-4 min-w-0">
              <!-- Avatar -->
              <div
                class="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 font-bold text-sm"
                style="background: {sc.iconBg}; color: {sc.iconColor};"
              >
                {kyc.full_name?.charAt(0) || kyc.user?.username?.charAt(0) || '?'}
              </div>

              <div class="min-w-0">
                <h3 class="font-bold text-sm truncate">{kyc.full_name || kyc.user?.username || '—'}</h3>
                <p class="text-xs mt-0.5 truncate" style="color: var(--text-tertiary);">
                  {kyc.user?.email || '—'}
                </p>
              </div>
            </div>

            <span class={sc.pillClass}>
              <sc.icon size={12} />
              {sc.label}
            </span>
          </div>

          <!-- Details row -->
          <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs" style="color: var(--text-secondary);">
            <div class="flex items-center gap-1.5">
              <FileText size={13} style="color: var(--text-quaternary);" />
              <span>{getDocTypeLabel(kyc.document_type)}</span>
            </div>
            <div class="flex items-center gap-1.5 font-mono">
              <Image size={13} style="color: var(--text-quaternary);" />
              <span>{maskDocNumber(kyc.document_number)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Clock size={13} style="color: var(--text-quaternary);" />
              <span>{formatDate(kyc.created_at)}</span>
            </div>
          </div>

          <!-- Rejection reason (if rejected) -->
          {#if kyc.status === 'REJECTED' && kyc.rejection_reason}
            <div
              class="mt-3 p-3 rounded-lg text-xs"
              style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.12); color: var(--text-secondary);"
            >
              <span class="font-semibold" style="color: #f43f7a;">سبب الرفض: </span>
              {kyc.rejection_reason}
            </div>
          {/if}

          <!-- Actions row -->
          <div class="mt-4 flex items-center justify-between flex-wrap gap-2">
            <button
              class="btn-ghost flex items-center gap-2 text-xs"
              onclick={() => openPreview(kyc)}
            >
              <Eye size={15} />
              معاينة المستند
            </button>

            {#if isPending}
              <div class="flex items-center gap-2">
                <button
                  class="btn-buy flex items-center gap-1.5 text-xs"
                  onclick={() => approveKYC(kyc.id)}
                  disabled={isActing}
                >
                  {#if isActing}
                    <Loader2 size={14} class="animate-spin" />
                  {:else}
                    <CheckCircle2 size={14} />
                  {/if}
                  قبول
                </button>
                <button
                  class="btn-danger flex items-center gap-1.5 text-xs"
                  onclick={() => openRejectDialog(kyc.id)}
                  disabled={isActing}
                >
                  <XCircle size={14} />
                  رفض
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="panel p-4 flex items-center justify-between flex-wrap gap-3">
      <p class="text-xs" style="color: var(--text-tertiary);">
        إجمالي {totalItems.toLocaleString('ar-EG')} طلب · صفحة {page} من {totalPages}
      </p>

      <div class="flex items-center gap-1">
        <button
          class="btn-ghost p-2 rounded-lg"
          onclick={() => (page = Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronRight size={18} />
        </button>

        {#if pages[0] > 1}
          <button class="btn-ghost px-3 py-1.5 rounded-lg text-xs" onclick={() => (page = 1)}>1</button>
          {#if pages[0] > 2}
            <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
          {/if}
        {/if}

        {#each pages as p}
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            class:btn-primary={p === page}
            class:btn-ghost={p !== page}
            onclick={() => (page = p)}
            disabled={p === page}
          >
            {p}
          </button>
        {/each}

        {#if pages[pages.length - 1] < totalPages}
          {#if pages[pages.length - 1] < totalPages - 1}
            <span class="px-1 text-xs" style="color: var(--text-quaternary);">...</span>
          {/if}
          <button
            class="btn-ghost px-3 py-1.5 rounded-lg text-xs"
            onclick={() => (page = totalPages)}
          >
            {totalPages}
          </button>
        {/if}

        <button
          class="btn-ghost p-2 rounded-lg"
          onclick={() => (page = Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  {/if}
</div>
