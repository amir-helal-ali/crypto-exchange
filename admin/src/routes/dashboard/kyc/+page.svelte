<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShieldCheck, Search, Eye, CheckCircle2, XCircle, Clock,
    FileText, AlertCircle, Loader2, X, Send, BellRing, Image,
    BadgeCheck, Filter
  } from 'lucide-svelte';
  import { authGet, authPut, API, getToken } from '$lib/api/client';
  import type { KYCRequest } from '$lib/api/types';
  import type { KYCStats } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatDate, getDocTypeLabel, maskString } from '$lib/utils/helpers';
  import StatCard from '$lib/components/StatCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import Modal from '$lib/components/Modal.svelte';

  // ─── Status Configuration ─────────────────────────────────
  const statusConfig: Record<string, { label: string; pillClass: string; color: string; bg: string }> = {
    PENDING: { label: 'قيد المراجعة', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
    APPROVED: { label: 'مقبول', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
    REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', color: '#f43f7a', bg: 'rgba(244,63,122,0.12)' }
  };

  function getStatusConf(status: string) {
    return statusConfig[status] || statusConfig.PENDING;
  }

  // ─── State ────────────────────────────────────────────────
  let requests = $state<KYCRequest[]>([]);
  let stats = $state<KYCStats | null>(null);
  let loading = $state(true);
  let statsLoading = $state(true);
  let error = $state('');
  let page = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  let search = $state('');
  let statusFilter = $state('');
  let sseConnected = $state(false);
  let newKYCCount = $state(0);

  // Document preview modal
  let previewOpen = $state(false);
  let previewUrl = $state('');
  let previewType = $state<'image' | 'pdf'>('image');
  let previewTitle = $state('');

  // Reject modal
  let rejectOpen = $state(false);
  let rejectTarget = $state<KYCRequest | null>(null);
  let rejectReason = $state('');
  let rejectLoading = $state(false);
  let rejectError = $state('');

  // Approve loading per card
  let approvingId = $state<number | null>(null);

  const LIMIT = 12;

  // ─── Fetch Stats ──────────────────────────────────────────
  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/kyc/stats');
      if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
      const json = await res.json();
      if (json.success) stats = json.data;
    } catch (e: any) {
      /* non-fatal */
    } finally {
      statsLoading = false;
    }
  }

  // ─── Fetch KYC Requests ──────────────────────────────────
  async function fetchRequests() {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT)
      });
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await authGet(`/api/v1/admin/kyc?${params}`);
      if (!res.ok) throw new Error('فشل تحميل طبات التحقق');
      const json = await res.json();
      if (json.success) {
        requests = json.data;
        totalPages = json.pagination.totalPages;
        totalItems = json.pagination.total;
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ غير متوقع';
    } finally {
      loading = false;
    }
  }

  // ─── Approve ─────────────────────────────────────────────
  async function approveKYC(req: KYCRequest) {
    approvingId = req.id;
    try {
      const res = await authPut(`/api/v1/admin/kyc/${req.id}/review`, {
        status: 'APPROVED'
      });
      if (!res.ok) throw new Error('فشل قبول الطلب');
      await Promise.all([fetchRequests(), fetchStats()]);
    } catch (e: any) {
      error = e.message || 'فشل قبول الطلب';
    } finally {
      approvingId = null;
    }
  }

  // ─── Reject ──────────────────────────────────────────────
  function openRejectModal(req: KYCRequest) {
    rejectTarget = req;
    rejectReason = '';
    rejectError = '';
    rejectOpen = true;
  }

  async function submitReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      rejectError = 'يرجى إدخال سبب الرفض';
      return;
    }
    rejectLoading = true;
    rejectError = '';
    try {
      const res = await authPut(`/api/v1/admin/kyc/${rejectTarget.id}/review`, {
        status: 'REJECTED',
        rejection_reason: rejectReason.trim()
      });
      if (!res.ok) throw new Error('فشل رفض الطلب');
      rejectOpen = false;
      rejectTarget = null;
      rejectReason = '';
      await Promise.all([fetchRequests(), fetchStats()]);
    } catch (e: any) {
      rejectError = e.message || 'فشل رفض الطلب';
    } finally {
      rejectLoading = false;
    }
  }

  // ─── Document Preview ────────────────────────────────────
  function openPreview(url: string, docType: string, label: string) {
    previewUrl = url;
    previewTitle = `${label} — ${docType}`;
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) {
      previewType = 'pdf';
    } else {
      previewType = 'image';
    }
    previewOpen = true;
  }

  // ─── SSE Real-time ───────────────────────────────────────
  let eventSource: EventSource | null = $state(null);

  function connectSSE() {
    const es = createAdminStream(['kyc']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('kyc', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type === 'NEW_KYC') {
          newKYCCount++;
        } else if (data?.type === 'KYC_REVIEWED') {
          fetchRequests();
          fetchStats();
        }
      } catch { /* ignore parse errors */ }
    });
    es.onerror = () => {
      sseConnected = false;
      setTimeout(() => { es.close(); connectSSE(); }, 5000);
    };
    return es;
  }

  function refreshWithNew() {
    newKYCCount = 0;
    fetchRequests();
    fetchStats();
  }

  // ─── Effects ─────────────────────────────────────────────
  let initialLoad = $state(true);

  $effect(() => {
    // Track page changes for pagination
    void page;
    if (!initialLoad) {
      fetchRequests();
    }
  });

  onMount(() => {
    fetchStats();
    fetchRequests();
    initialLoad = false;
    eventSource = connectSSE() ?? null;
    return () => { eventSource?.close(); };
  });
</script>

<!-- Aurora Background -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
  <div class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px]" style="background: var(--accent-gold);"></div>
  <div class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]" style="background: var(--accent-violet);"></div>
  <div class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.04] blur-[100px]" style="background: var(--accent-mint);"></div>
</div>

<div class="relative z-10 space-y-8">
  <!-- Page Header -->
  <PageHeader title="التحقق من الهوية" subtitle="إدارة طبات التحقق من هوية المستخدمين">
    <div class="flex items-center gap-3">
      {#if newKYCCount > 0}
        <button class="btn-secondary flex items-center gap-2 animate-shimmer" onclick={refreshWithNew}>
          <BellRing size={15} />
          <span>{newKYCCount} طلب جديد</span>
        </button>
      {/if}
      <LiveIndicator connected={sseConnected} />
    </div>
  </PageHeader>

  <!-- Error -->
  {#if error}
    <ErrorAlert message={error} onclose={() => { error = ''; }} />
  {/if}

  <!-- Stat Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <StatCard
      label="قيد المراجعة"
      value={stats?.pending ?? 0}
      icon={Clock}
      iconColor="#f5b544"
      iconBg="rgba(245,181,68,0.12)"
      chartColor="#f5b544"
      chartSeed={10}
      loading={statsLoading}
    />
    <StatCard
      label="مقبول"
      value={stats?.approved ?? 0}
      icon={BadgeCheck}
      iconColor="#22d3a4"
      iconBg="rgba(34,211,164,0.12)"
      chartColor="#22d3a4"
      chartSeed={20}
      loading={statsLoading}
    />
    <StatCard
      label="مرفوض"
      value={stats?.rejected ?? 0}
      icon={XCircle}
      iconColor="#f43f7a"
      iconBg="rgba(244,63,122,0.12)"
      chartColor="#f43f7a"
      chartSeed={30}
      loading={statsLoading}
    />
  </div>

  <!-- Search & Filters -->
  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1">
        <Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field pr-10 w-full"
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
          bind:value={search}
          onkeydown={(e) => { if (e.key === 'Enter') { page = 1; fetchRequests(); } }}
        />
      </div>

      <!-- Status Filter -->
      <div class="relative">
        <Filter size={14} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <select
          class="input-field pr-9 pl-8 appearance-none cursor-pointer min-w-[160px]"
          bind:value={statusFilter}
          onchange={() => { page = 1; fetchRequests(); }}
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>

      <!-- Search Button -->
      <button
        class="btn-primary flex items-center justify-center gap-2 min-w-[100px]"
        onclick={() => { page = 1; fetchRequests(); }}
      >
        <Search size={15} />
        <span>بحث</span>
      </button>
    </div>
  </div>

  <!-- KYC Cards Grid -->
  <div class="space-y-4">
    {#if loading}
      <!-- Skeleton Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {#each Array(6) as _}
          <div class="panel p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="animate-shimmer h-11 w-11 rounded-xl" style="background: rgba(255,255,255,0.04);"></div>
              <div class="flex-1 space-y-2">
                <div class="animate-shimmer h-3.5 w-2/3 rounded" style="background: rgba(255,255,255,0.05);"></div>
                <div class="animate-shimmer h-3 w-1/2 rounded" style="background: rgba(255,255,255,0.04);"></div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="animate-shimmer h-3 w-3/4 rounded" style="background: rgba(255,255,255,0.04);"></div>
              <div class="animate-shimmer h-3 w-1/2 rounded" style="background: rgba(255,255,255,0.03);"></div>
            </div>
            <div class="flex gap-2">
              <div class="animate-shimmer h-8 w-20 rounded-lg" style="background: rgba(255,255,255,0.04);"></div>
              <div class="animate-shimmer h-8 w-20 rounded-lg" style="background: rgba(255,255,255,0.04);"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if requests.length === 0}
      <EmptyState
        icon={ShieldCheck}
        title="لا توجد طبات تحقق"
        description={search || statusFilter ? 'لا توجد نتائج مطابقة لمعايير البحث' : 'لم يتم تقديم أي طبات تحقق بعد'}
      />
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {#each requests as req (req.id)}
          {@const conf = getStatusConf(req.status)}
          <div class="panel p-5 space-y-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group">
            <!-- Header: Name + Status Pill -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-105"
                  style="background: {conf.bg};"
                >
                  <ShieldCheck size={20} style="color: {conf.color};" />
                </div>
                <div class="min-w-0">
                  <p class="font-bold text-sm truncate" style="color: var(--text-primary);">{req.full_name}</p>
                  <p class="text-xs truncate" style="color: var(--text-tertiary);">{req.user?.email || '—'}</p>
                </div>
              </div>
              <span class="{conf.pillClass} shrink-0">{conf.label}</span>
            </div>

            <!-- Details -->
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-medium" style="color: var(--text-quaternary);">نوع المستند</span>
                <span class="text-xs font-medium" style="color: var(--text-secondary);">{getDocTypeLabel(req.document_type)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-medium" style="color: var(--text-quaternary);">رقم المستند</span>
                <span class="text-xs font-mono tabular-nums" style="color: var(--text-secondary);">{maskString(req.document_number)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-medium" style="color: var(--text-quaternary);">تاريخ التقديم</span>
                <span class="text-xs tabular-nums" style="color: var(--text-secondary);">{formatDate(req.created_at)}</span>
              </div>
              {#if req.status === 'REJECTED' && req.rejection_reason}
                <div class="mt-1 p-2.5 rounded-lg" style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.1);">
                  <p class="text-[11px] font-medium mb-0.5" style="color: #f43f7a;">سبب الرفض:</p>
                  <p class="text-xs" style="color: var(--text-tertiary);">{req.rejection_reason}</p>
                </div>
              {/if}
            </div>

            <!-- Document Preview Buttons -->
            <div class="flex items-center gap-2 pt-1" style="border-top: 1px solid var(--border-subtle);">
              <button
                class="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-lg"
                onclick={() => openPreview(req.document_url, getDocTypeLabel(req.document_type), req.full_name)}
              >
                <FileText size={13} />
                <span>المستند</span>
              </button>
              {#if req.selfie_url}
                <button
                  class="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-lg"
                  onclick={() => openPreview(req.selfie_url!, 'صورة شخصية', req.full_name)}
                >
                  <Image size={13} />
                  <span>الصورة</span>
                </button>
              {/if}
            </div>

            <!-- Actions (Pending Only) -->
            {#if req.status === 'PENDING'}
              <div class="flex items-center gap-2">
                <button
                  class="btn-buy flex items-center justify-center gap-1.5 flex-1 text-xs py-2"
                  onclick={() => approveKYC(req)}
                  disabled={approvingId === req.id}
                >
                  {#if approvingId === req.id}
                    <Loader2 size={14} class="animate-spin" />
                    <span>جارٍ القبول...</span>
                  {:else}
                    <CheckCircle2 size={14} />
                    <span>قبول</span>
                  {/if}
                </button>
                <button
                  class="btn-danger flex items-center justify-center gap-1.5 flex-1 text-xs py-2"
                  onclick={() => openRejectModal(req)}
                  disabled={approvingId === req.id}
                >
                  <XCircle size={14} />
                  <span>رفض</span>
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      <Pagination bind:page={page} {totalPages} totalItems={totalItems} itemLabel="طلب تحقق" />
    {/if}
  </div>
</div>

<!-- ─── Document Preview Modal ────────────────────────────── -->
<Modal bind:open={previewOpen} title={previewTitle} icon={Eye} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" size="xl">
  {#if previewType === 'image'}
    <div class="flex items-center justify-center min-h-[300px]">
      <img
        src={previewUrl}
        alt={previewTitle}
        class="max-w-full max-h-[60vh] rounded-lg object-contain"
        style="border: 1px solid var(--border-subtle);"
      />
    </div>
  {:else}
    <iframe
      src={previewUrl}
      title={previewTitle}
      class="w-full rounded-lg"
      style="height: 60vh; border: 1px solid var(--border-subtle);"
    ></iframe>
  {/if}
</Modal>

<!-- ─── Reject Modal ──────────────────────────────────────── -->
<Modal
  bind:open={rejectOpen}
  title="رفض طلب التحقق"
  icon={XCircle}
  iconColor="#f43f7a"
  iconBg="rgba(244,63,122,0.12)"
  size="md"
>
  {#if rejectTarget}
    <div class="space-y-4">
      <div class="flex items-center gap-3 p-3 rounded-xl" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle);">
        <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(244,63,122,0.08);">
          <ShieldCheck size={18} style="color: #f43f7a;" />
        </div>
        <div class="min-w-0">
          <p class="font-medium text-sm truncate" style="color: var(--text-primary);">{rejectTarget.full_name}</p>
          <p class="text-xs" style="color: var(--text-quaternary);">{getDocTypeLabel(rejectTarget.document_type)} — {maskString(rejectTarget.document_number)}</p>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">سبب الرفض <span style="color: #f43f7a;">*</span></label>
        <textarea
          class="input-field w-full min-h-[120px] resize-y"
          placeholder="أدخل سبب رفض طلب التحقق..."
          bind:value={rejectReason}
          dir="rtl"
        ></textarea>
      </div>

      {#if rejectError}
        <div class="flex items-center gap-2 text-xs" style="color: #f43f7a;">
          <AlertCircle size={14} />
          <span>{rejectError}</span>
        </div>
      {/if}

      <div class="flex items-center gap-3 pt-2">
        <button
          class="btn-danger flex items-center justify-center gap-2 flex-1 py-2.5"
          onclick={submitReject}
          disabled={rejectLoading}
        >
          {#if rejectLoading}
            <Loader2 size={15} class="animate-spin" />
            <span>جارٍ الرفض...</span>
          {:else}
            <Send size={15} />
            <span>تأكيد الرفض</span>
          {/if}
        </button>
        <button
          class="btn-secondary py-2.5 px-5"
          onclick={() => { rejectOpen = false; }}
          disabled={rejectLoading}
        >
          إلغاء
        </button>
      </div>
    </div>
  {/if}
</Modal>
