<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShieldCheck, Search, Filter, Eye, CheckCircle2, XCircle, Clock,
    FileText, ChevronLeft, AlertCircle, Loader2, X, Send, BellRing, Image, BadgeCheck
  } from 'lucide-svelte';
  import { authGet, authPut, API, getToken } from '$lib/api/client';
  import type { KYCRequest } from '$lib/api/types';
  import { createAdminStream } from '$lib/api/types';
  import { formatDate, getDocTypeLabel, maskString } from '$lib/utils/helpers';
  import StatCard from '$lib/components/StatCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LiveIndicator from '$lib/components/LiveIndicator.svelte';
  import Modal from '$lib/components/Modal.svelte';

  interface KYCStats { pending: number; approved: number; rejected: number; }

  let kycRequests = $state<KYCRequest[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let page = $state(1);
  let totalPages = $state(1);
  let totalItems = $state(0);
  const limit = 20;
  let searchQuery = $state('');
  let statusFilter = $state('');
  let stats = $state<KYCStats>({ pending: 0, approved: 0, rejected: 0 });
  let previewOpen = $state(false);
  let previewUrl = $state('');
  let previewType = $state<'image' | 'pdf'>('image');
  let previewName = $state('');
  let rejectDialogOpen = $state(false);
  let rejectTargetId = $state<number | null>(null);
  let rejectReason = $state('');
  let rejectLoading = $state(false);
  let sseConnected = $state(false);
  let newKycCount = $state(0);
  let actionLoadingId = $state<number | null>(null);

  const statusConfig: Record<string, { label: string; pillClass: string; color: string; bg: string }> = {
    PENDING: { label: 'قيد المراجعة', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
    APPROVED: { label: 'مقبول', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
    REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', color: '#f43f7a', bg: 'rgba(244,63,122,0.12)' }
  };

  function getStatusConfig(status: string) { return statusConfig[status] || statusConfig.PENDING; }
  function detectDocType(url: string): 'image' | 'pdf' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('.pdf?')) return 'pdf';
    return 'image';
  }

  async function fetchKYC() {
    loading = true; error = null;
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await authGet(`/api/v1/admin/kyc?${params}`);
      if (!res.ok) throw new Error('فشل تحميل طباتات KYC');
      const json = await res.json();
      if (json.success) { kycRequests = json.data; totalPages = json.pagination.totalPages; totalItems = json.pagination.total; }
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  async function fetchStats() {
    try {
      const res = await authGet('/api/v1/admin/kyc/stats');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) stats = json.data;
    } catch {}
  }

  async function approveKYC(id: number) {
    actionLoadingId = id;
    try {
      const res = await authPut(`/api/v1/admin/kyc/${id}/review`, { status: 'APPROVED' });
      if (!res.ok) throw new Error('فشل قبول الطلب');
      kycRequests = kycRequests.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r);
      stats = { ...stats, pending: Math.max(0, stats.pending - 1), approved: stats.approved + 1 };
    } catch (e: any) { error = e.message; }
    finally { actionLoadingId = null; }
  }

  function openRejectDialog(id: number) { rejectTargetId = id; rejectReason = ''; rejectDialogOpen = true; }

  async function submitRejection() {
    if (!rejectTargetId || !rejectReason.trim()) return;
    rejectLoading = true;
    try {
      const res = await authPut(`/api/v1/admin/kyc/${rejectTargetId}/review`, { status: 'REJECTED', rejection_reason: rejectReason.trim() });
      if (!res.ok) throw new Error('فشل رفض الطلب');
      kycRequests = kycRequests.map(r => r.id === rejectTargetId ? { ...r, status: 'REJECTED', rejection_reason: rejectReason.trim() } : r);
      stats = { ...stats, pending: Math.max(0, stats.pending - 1), rejected: stats.rejected + 1 };
      rejectDialogOpen = false;
    } catch (e: any) { error = e.message; }
    finally { rejectLoading = false; }
  }

  function openPreview(kyc: KYCRequest) {
    previewUrl = kyc.document_url; previewType = detectDocType(kyc.document_url);
    previewName = `${kyc.full_name} — ${getDocTypeLabel(kyc.document_type)}`; previewOpen = true;
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => { searchQuery; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { page = 1; fetchKYC(); }, 400); });
  $effect(() => { statusFilter; page = 1; fetchKYC(); });
  $effect(() => { page; fetchKYC(); });

  let eventSource: EventSource | null = null;
  function connectSSE() {
    const es = createAdminStream(['kyc']);
    if (!es) return;
    es.onopen = () => { sseConnected = true; };
    es.addEventListener('kyc', () => { newKycCount++; fetchStats(); });
    es.onerror = () => { sseConnected = false; setTimeout(() => { es.close(); connectSSE(); }, 5000); };
    return es;
  }

  onMount(() => {
    (async () => { await Promise.all([fetchKYC(), fetchStats()]); loading = false; })();
    eventSource = connectSSE() ?? null;
    return () => { eventSource?.close(); };
  });
</script>

<!-- Document Preview Modal -->
<Modal bind:open={previewOpen} title={previewName} icon={BadgeCheck} iconColor="#f5b544" size="xl">
  <div class="flex items-center justify-center min-h-[300px]">
    {#if previewType === 'pdf'}
      <iframe src={previewUrl} class="w-full h-[70vh] rounded-xl border" style="border-color: var(--border-subtle); background: white;" title="معاينة PDF"></iframe>
    {:else}
      <img src={previewUrl} alt={previewName} class="max-w-full max-h-[70vh] rounded-xl object-contain" style="border: 1px solid var(--border-subtle);" />
    {/if}
  </div>
</Modal>

<!-- Reject Dialog -->
<Modal bind:open={rejectDialogOpen} title="رفض طلب التحقق" icon={XCircle} iconColor="#f43f7a" iconBg="rgba(244,63,122,0.12)">
  <div>
    <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
      سبب الرفض <span style="color: #f43f7a;">*</span>
    </label>
    <textarea class="input-field min-h-[120px] resize-y" bind:value={rejectReason} placeholder="أدخل سبب رفض الطلب..." dir="rtl"></textarea>
  </div>
  <div slot="footer" class="flex items-center gap-3 justify-end mt-4">
    <button class="btn-secondary" onclick={() => rejectDialogOpen = false} disabled={rejectLoading}>إلغاء</button>
    <button class="btn-danger flex items-center gap-2" onclick={submitRejection} disabled={rejectLoading || !rejectReason.trim()}>
      {#if rejectLoading}<Loader2 size={16} class="animate-spin" />{:else}<Send size={16} />{/if}
      رفض الطلب
    </button>
  </div>
</Modal>

<!-- Main Content -->
<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">التحقق KYC</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">مراجعة طباتات التحقق من الهوية</p>
    </div>
    <div class="flex items-center gap-3">
      <LiveIndicator connected={sseConnected} />
      {#if newKycCount > 0}
        <button class="pill-gold flex items-center gap-2 cursor-pointer animate-pulse-soft transition-all" onclick={() => { newKycCount = 0; page = 1; fetchKYC(); fetchStats(); }}>
          <BellRing size={14} /><span>{newKycCount} طلب جديد</span>
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <StatCard label="قيد المراجعة" value={stats.pending} icon={Clock} iconColor="#f5b544" iconBg="rgba(245,181,68,0.12)" sparkColor="#f5b544" sparkSeed={0} loading={loading} />
    <StatCard label="مقبول" value={stats.approved} icon={CheckCircle2} iconColor="#22d3a4" iconBg="rgba(34,211,164,0.12)" sparkColor="#22d3a4" sparkSeed={1} loading={loading} />
    <StatCard label="مرفوض" value={stats.rejected} icon={XCircle} iconColor="#f43f7a" iconBg="rgba(244,63,122,0.12)" sparkColor="#f43f7a" sparkSeed={2} loading={loading} />
  </div>

  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input type="text" class="input-field pr-10" placeholder="بحث بالاسم أو البريد..." bind:value={searchQuery} dir="rtl" />
      </div>
      <div class="relative">
        <Filter size={16} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <select class="input-field pr-9 pl-8 appearance-none cursor-pointer min-w-[160px]" bind:value={statusFilter} dir="rtl">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>
    </div>
  </div>

  <div class="space-y-4">
    {#if loading}
      {#each Array(4) as _}
        <div class="panel p-5">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4 flex-1">
              <div class="animate-shimmer h-12 w-12 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
              <div class="space-y-2 flex-1">
                <div class="animate-shimmer h-4 w-40 rounded" style="background: rgba(255,255,255,0.06);"></div>
                <div class="animate-shimmer h-3 w-56 rounded" style="background: rgba(255,255,255,0.04);"></div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    {:else if kycRequests.length === 0}
      <EmptyState icon={ShieldCheck} title="لا توجد طباتات تحقق" description={statusFilter || searchQuery ? 'جرّب تغيير عوامل التصفية' : 'ستظهر طباتات التحقق هنا عند تقديمها'} />
    {:else}
      {#each kycRequests as kyc (kyc.id)}
        {@const sc = getStatusConfig(kyc.status)}
        {@const isPending = kyc.status === 'PENDING'}
        {@const isActing = actionLoadingId === kyc.id}
        <div class="panel p-5 transition-all duration-300 hover:border-white/[0.12]">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-4 min-w-0">
              <div class="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 font-bold text-sm" style="background: {sc.bg}; color: {sc.color};">
                {kyc.full_name?.charAt(0) || kyc.user?.username?.charAt(0) || '?'}
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-sm truncate">{kyc.full_name || kyc.user?.username || '—'}</h3>
                <p class="text-xs mt-0.5 truncate" style="color: var(--text-tertiary);">{kyc.user?.email || '—'}</p>
              </div>
            </div>
            <span class={sc.pillClass}><CheckCircle2 size={12} />{sc.label}</span>
          </div>
          <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs" style="color: var(--text-secondary);">
            <div class="flex items-center gap-1.5"><FileText size={13} style="color: var(--text-quaternary);" /><span>{getDocTypeLabel(kyc.document_type)}</span></div>
            <div class="flex items-center gap-1.5 font-mono"><Image size={13} style="color: var(--text-quaternary);" /><span>{maskString(kyc.document_number)}</span></div>
            <div class="flex items-center gap-1.5"><Clock size={13} style="color: var(--text-quaternary);" /><span>{formatDate(kyc.created_at)}</span></div>
          </div>
          {#if kyc.status === 'REJECTED' && kyc.rejection_reason}
            <div class="mt-3 p-3 rounded-lg text-xs" style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.12); color: var(--text-secondary);">
              <span class="font-semibold" style="color: #f43f7a;">سبب الرفض: </span>{kyc.rejection_reason}
            </div>
          {/if}
          <div class="mt-4 flex items-center justify-between flex-wrap gap-2">
            <button class="btn-ghost flex items-center gap-2 text-xs" onclick={() => openPreview(kyc)}>
              <Eye size={15} />معاينة المستند
            </button>
            {#if isPending}
              <div class="flex items-center gap-2">
                <button class="btn-buy flex items-center gap-1.5 text-xs" onclick={() => approveKYC(kyc.id)} disabled={isActing}>
                  {#if isActing}<Loader2 size={14} class="animate-spin" />{:else}<CheckCircle2 size={14} />{/if}قبول
                </button>
                <button class="btn-danger flex items-center gap-1.5 text-xs" onclick={() => openRejectDialog(kyc.id)} disabled={isActing}>
                  <XCircle size={14} />رفض
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <Pagination bind:page={page} totalPages={totalPages} totalItems={totalItems} itemLabel="طلب" />
</div>
