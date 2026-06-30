<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatDate } from '$lib/utils/format';
  import { toasts } from '$lib/stores/toast';
  import {
    Check, X, FileText, Clock, AlertCircle, ShieldCheck, RefreshCw,
    UserCheck, UserX, Loader2, Fingerprint, IdCard, Calendar, Hash,
    ChevronLeft, Image as ImageIcon, ExternalLink
  } from 'lucide-svelte';

  let requests = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let filter = $state<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  let liveTick = $state(0);
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    (async () => {
      await loadRequests();
      loading = false;
    })();
    liveInterval = setInterval(() => liveTick++, 5000);
    return () => { if (liveInterval) clearInterval(liveInterval); };
  });

  async function loadRequests() {
    refreshing = true;
    try {
      const res = await authGet(`/api/v1/admin/kyc?status=${filter}`);
      const data = await parseApiResponse<any>(res);
      requests = data?.requests || data || [];
    } catch {
      requests = [];
    } finally {
      refreshing = false;
    }
  }

  $effect(() => {
    filter;
    loadRequests();
  });

  async function approve(id: number) {
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/kyc/${id}/approve`);
      toasts.success('تمت الموافقة على الطلب');
      loadRequests();
    } catch {
      toasts.error('فشل الموافقة');
    }
  }

  async function reject(id: number) {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/kyc/${id}/reject`, { reason });
      toasts.success('تم رفض الطلب');
      loadRequests();
    } catch {
      toasts.error('فشل الرفض');
    }
  }

  const stats = $derived({
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
    total: requests.length
  });

  // Activity sparkline for pending queue
  const pendingSpark = $derived.by(() => {
    const base = Math.max(stats.pending, 5);
    const points: number[] = [];
    let v = base * 0.7;
    for (let i = 0; i < 19; i++) {
      v += (Math.sin(i * 0.5 + liveTick * 0.3) * base * 0.15) + (base * 0.01);
      v = Math.max(base * 0.3, v);
      points.push(v);
    }
    points.push(base);
    return points;
  });

  function sparklinePath(points: number[], w = 200, h = 50): string {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  function sparklineArea(points: number[], w = 200, h = 50): string {
    const path = sparklinePath(points, w, h);
    if (!path) return '';
    return `${path} L${w},${h} L0,${h} Z`;
  }

  const filterTabs = [
    { k: 'pending', l: 'معلّقة', icon: Clock, color: 'gold' },
    { k: 'approved', l: 'موافق عليها', icon: Check, color: 'mint' },
    { k: 'rejected', l: 'مرفوضة', icon: X, color: 'rose' },
    { k: 'all', l: 'الكل', icon: FileText, color: 'slate' }
  ] as const;
</script>

<svelte:head><title>طلبات التحقق — NEXUS Admin</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-mint/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-mint/10 border border-accent-gold/20 flex items-center justify-center">
        <Fingerprint size={22} class="text-accent-gold" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">طلبات التحقق</h1>
          {#if stats.pending > 0}
            <span class="pill-gold text-[10px] flex items-center gap-1">
              <span class="relative flex h-1.5 w-1.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-gold"></span>
              </span>
              {stats.pending} معلّق
            </span>
          {/if}
        </div>
        <p class="text-sm text-slate-400">مراجعة طلبات التحقق من الهوية (KYC)</p>
      </div>
    </div>
    <button onclick={loadRequests} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Quick stats grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Clock size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">معلّقة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.pending}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">بانتظار المراجعة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Check size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">موافق عليها</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.approved}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">طلب مُعتمد</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <X size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مرفوضة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.rejected}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">طلب مرفوض</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <FileText size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">الإجمالي</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.total}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">في الفلتر الحالي</p>
      </div>
    </div>
  </div>

  <!-- Pending queue hero (only when pending > 0) -->
  {#if stats.pending > 0 && filter === 'pending'}
    <div class="panel p-5 sm:p-6 relative overflow-hidden bg-accent-gold/5 border-accent-gold/25">
      <div class="absolute inset-0 opacity-50 pointer-events-none" aria-hidden="true">
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-accent-gold/15 blur-3xl rounded-full animate-pulse-glow"></div>
      </div>
      <div class="relative flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center">
            <Clock size={22} class="text-accent-gold" />
          </div>
          <div>
            <p class="text-sm font-bold text-white">{stats.pending} طلب بانتظار المراجعة</p>
            <p class="text-xs text-slate-400 mt-0.5">راجع المستندات واعتمد أو ارفض كل طلب</p>
          </div>
        </div>
        <div class="hidden sm:block">
          <svg width="180" height="45" viewBox="0 0 180 45">
            <defs>
              <linearGradient id="kycPendingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f5b544" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#f5b544" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineArea(pendingSpark, 180, 45)} fill="url(#kycPendingGrad)" />
            <path d={sparklinePath(pendingSpark, 180, 45)} stroke="#f5b544" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
      </div>
    </div>
  {/if}

  <!-- Filter tabs -->
  <div class="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/5 w-fit">
    {#each filterTabs as f}
      <button
        onclick={() => (filter = f.k as any)}
        class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 {filter === f.k ? 'bg-accent-gold/15 text-accent-gold shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
      >
        <f.icon size={12} /> {f.l}
      </button>
    {/each}
  </div>

  <!-- Requests list -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}<div class="panel p-6 animate-shimmer h-32"></div>{/each}
    </div>
  {:else if requests.length === 0}
    <div class="panel py-20 text-center">
      <div class="relative inline-block mb-4">
        <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full"></div>
        <FileText size={48} class="relative text-slate-600 mx-auto" />
      </div>
      <p class="text-sm font-medium text-slate-300">لا توجد طلبات</p>
      <p class="text-xs text-slate-500 mt-1">لا توجد طلبات مطابقة لهذا الفلتر</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each requests as r, i}
        <div class="panel p-5 sm:p-6 relative overflow-hidden group hover:border-white/15 transition-all">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {r.status === 'PENDING' ? 'rgba(245, 181, 68, 0.4)' : r.status === 'APPROVED' ? 'rgba(34, 211, 164, 0.4)' : 'rgba(251, 113, 133, 0.4)'}, transparent);"></div>

          <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-gold/25 to-accent-violet/25 border border-white/10 flex items-center justify-center text-sm font-black text-white shrink-0">
                {(r.full_name || '??').slice(0, 2).toUpperCase()}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 class="text-base font-bold text-white">{r.full_name}</h3>
                  <span class="pill-gold flex items-center gap-1 text-[10px]">
                    <IdCard size={9} /> {r.document_type}
                  </span>
                </div>
                <div class="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  <p class="text-xs text-slate-400 flex items-center gap-1.5">
                    <Hash size={11} class="text-slate-600" /> رقم المستند:
                    <span class="font-mono text-slate-300">{r.document_number}</span>
                  </p>
                  <p class="text-xs text-slate-400 flex items-center gap-1.5">
                    <Calendar size={11} class="text-slate-600" /> {formatDate(r.created_at)}
                  </p>
                </div>
              </div>
            </div>
            <span class="pill {r.status === 'APPROVED' ? 'pill-mint' : r.status === 'PENDING' ? 'pill-gold' : 'pill-rose'} flex items-center gap-1 text-[10px]">
              {#if r.status === 'APPROVED'}
                <Check size={9} /> موافق
              {:else if r.status === 'PENDING'}
                <Clock size={9} /> معلّق
              {:else}
                <X size={9} /> مرفوض
              {/if}
            </span>
          </div>

          {#if r.document_url}
            <div class="mb-4">
              <a href={r.document_url} target="_blank" class="block panel p-3 bg-ink-950/60 hover:border-accent-gold/30 transition-all group/doc">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
                    <ImageIcon size={15} class="text-accent-gold" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs font-medium text-white">عرض المستند المرفق</p>
                    <p class="text-[10px] text-slate-500">انقر لفتح المستند في تبويب جديد</p>
                  </div>
                  <ExternalLink size={14} class="text-slate-500 group-hover/doc:text-accent-gold transition-colors" />
                </div>
              </a>
            </div>
          {/if}

          {#if r.rejection_reason}
            <div class="panel p-3 bg-accent-rose/5 border-accent-rose/20 mb-4">
              <div class="flex items-start gap-2">
                <AlertCircle size={14} class="text-accent-rose shrink-0 mt-0.5" />
                <p class="text-xs text-slate-300">
                  <span class="font-bold text-accent-rose">سبب الرفض:</span> {r.rejection_reason}
                </p>
              </div>
            </div>
          {/if}

          {#if r.status === 'PENDING'}
            <div class="flex gap-2">
              <button onclick={() => approve(r.id)} class="btn-buy text-xs py-2 px-4 flex-1 sm:flex-none">
                <Check size={14} /> موافقة واعتماد
              </button>
              <button onclick={() => reject(r.id)} class="btn-sell text-xs py-2 px-4 flex-1 sm:flex-none">
                <X size={14} /> رفض الطلب
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
