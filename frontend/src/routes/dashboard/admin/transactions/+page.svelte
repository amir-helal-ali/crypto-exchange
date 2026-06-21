<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { Check, X, Clock, ArrowRightLeft } from 'lucide-svelte';
  import { toasts } from '$lib/stores/toast';

  let transactions = $state<any[]>([]);
  let loading = $state(true);
  let filter = $state<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  onMount(() => {
(async () => {
    await loadTransactions();
    loading = false;
  
  })();
});

  async function loadTransactions() {
    try {
      const res = await authGet(`/api/v1/admin/transactions?status=${filter}`);
      const data = await parseApiResponse<any>(res);
      transactions = data?.transactions || data || [];
    } catch {
      transactions = [];
    }
  }

  $effect(() => {
    loadTransactions();
  });

  async function approve(id: number) {
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/transactions/${id}/approve`);
      toasts.success('تمت الموافقة');
      loadTransactions();
    } catch {
      toasts.error('فشل');
    }
  }

  async function reject(id: number) {
    try {
      const { authPost } = await import('$lib/api/client');
      await authPost(`/api/v1/admin/transactions/${id}/reject`);
      toasts.success('تم الرفض');
      loadTransactions();
    } catch {
      toasts.error('فشل');
    }
  }
</script>

<svelte:head><title>المعاملات — لوحة الإدارة</title></svelte:head>

<div class="space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">المعاملات</h1>
    <p class="text-sm text-slate-400 mt-1">إدارة طلبات الإيداع والسحب</p>
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

  <div class="panel overflow-hidden">
    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if transactions.length === 0}
      <div class="py-16 text-center text-slate-500">
        <ArrowRightLeft size={40} class="mx-auto mb-3 opacity-30" />
        <p class="text-sm">لا توجد معاملات</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3">النوع</th>
              <th class="text-right font-medium px-5 py-3">العملة</th>
              <th class="text-right font-medium px-5 py-3">المبلغ</th>
              <th class="text-right font-medium px-5 py-3">التاريخ</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-left font-medium px-5 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each transactions as t}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td class="px-5 py-3 text-slate-300">{t.user_username || t.user_id}</td>
                <td class="px-5 py-3">
                  <span class="pill {t.type === 'DEPOSIT' ? 'pill-mint' : 'pill-rose'}">
                    {t.type === 'DEPOSIT' ? 'إيداع' : 'سحب'}
                  </span>
                </td>
                <td class="px-5 py-3 font-semibold text-white">{t.currency}</td>
                <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{formatPrice(t.amount, 6)}</td>
                <td class="px-5 py-3 text-xs text-slate-400">{formatDate(t.created_at)}</td>
                <td class="px-5 py-3">
                  <span class="pill {t.status === 'APPROVED' || t.status === 'COMPLETED' ? 'pill-mint' : t.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                    {t.status === 'APPROVED' || t.status === 'COMPLETED' ? 'موافق' : t.status === 'PENDING' ? 'معلّق' : 'مرفوض'}
                  </span>
                </td>
                <td class="px-5 py-3 text-left">
                  {#if t.status === 'PENDING'}
                    <div class="flex gap-1 justify-end">
                      <button onclick={() => approve(t.id)} class="p-1.5 rounded-lg text-accent-mint hover:bg-accent-mint/10" aria-label="موافقة">
                        <Check size={14} />
                      </button>
                      <button onclick={() => reject(t.id)} class="p-1.5 rounded-lg text-accent-rose hover:bg-accent-rose/10" aria-label="رفض">
                        <X size={14} />
                      </button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
