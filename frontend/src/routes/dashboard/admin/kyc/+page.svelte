<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatDate } from '$lib/utils/format';
  import { toasts } from '$lib/stores/toast';
  import { Check, X, FileText, Clock, AlertCircle } from 'lucide-svelte';

  let requests = $state<any[]>([]);
  let loading = $state(true);
  let filter = $state<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  onMount(() => {
(async () => {
    await loadRequests();
    loading = false;
  
  })();
});

  async function loadRequests() {
    try {
      const res = await authGet(`/api/v1/admin/kyc?status=${filter}`);
      const data = await parseApiResponse<any>(res);
      requests = data?.requests || data || [];
    } catch {
      requests = [];
    }
  }

  $effect(() => {
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
</script>

<svelte:head><title>طلبات التحقق — لوحة الإدارة</title></svelte:head>

<div class="space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">طلبات التحقق (KYC)</h1>
    <p class="text-sm text-slate-400 mt-1">مراجعة طلبات التحقق من الهوية</p>
  </div>

  <div class="flex gap-1">
    {#each [{ k: 'pending', l: 'معلّقة' }, { k: 'approved', l: 'موافق عليها' }, { k: 'rejected', l: 'مرفوضة' }, { k: 'all', l: 'الكل' }] as f}
      <button
        onclick={() => (filter = f.k as any)}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {filter === f.k ? 'bg-accent-gold/15 text-accent-gold' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
      >
        {f.l}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}<div class="panel p-6 animate-shimmer h-32"></div>{/each}
    </div>
  {:else if requests.length === 0}
    <div class="panel py-16 text-center text-slate-500">
      <FileText size={40} class="mx-auto mb-3 opacity-30" />
      <p class="text-sm">لا توجد طلبات</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each requests as r}
        <div class="panel p-5">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-base font-bold text-white">{r.full_name}</h3>
                <span class="pill-gold">{r.document_type}</span>
              </div>
              <p class="text-xs text-slate-400">رقم المستند: <span class="font-mono">{r.document_number}</span></p>
              <p class="text-xs text-slate-400 mt-1">تاريخ الإرسال: {formatDate(r.created_at)}</p>
            </div>
            <span class="pill {r.status === 'APPROVED' ? 'pill-mint' : r.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
              {r.status === 'APPROVED' ? 'موافق' : r.status === 'PENDING' ? 'معلّق' : 'مرفوض'}
            </span>
          </div>

          {#if r.document_url}
            <div class="mb-4">
              <a href={r.document_url} target="_blank" class="block panel p-3 bg-ink-950/60 hover:border-accent-gold/30 transition-colors">
                <div class="flex items-center gap-2 text-xs text-slate-300">
                  <FileText size={14} />
                  عرض المستند المرفق
                </div>
              </a>
            </div>
          {/if}

          {#if r.status === 'PENDING'}
            <div class="flex gap-2">
              <button onclick={() => approve(r.id)} class="btn-buy text-xs py-2">
                <Check size={14} /> موافقة
              </button>
              <button onclick={() => reject(r.id)} class="btn-sell text-xs py-2">
                <X size={14} /> رفض
              </button>
            </div>
          {/if}

          {#if r.rejection_reason}
            <div class="panel p-3 bg-accent-rose/5 border-accent-rose/20 mt-3">
              <p class="text-xs text-slate-300"><span class="font-bold text-accent-rose">سبب الرفض:</span> {r.rejection_reason}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
