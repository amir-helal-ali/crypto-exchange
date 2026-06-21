<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, authPost, parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Plus, Save, Trash2, Coins } from 'lucide-svelte';

  let fees = $state<any[]>([]);
  let loading = $state(true);

  onMount(() => {
(async () => {
    await loadFees();
    loading = false;
  
  })();
});

  async function loadFees() {
    try {
      const res = await authGet('/api/v1/admin/fees');
      const data = await parseApiResponse<any>(res);
      fees = data?.fees || data || [];
      if (fees.length === 0) {
        fees = [
          { id: 0, tier: 'Basic', maker_fee: 0.1, taker_fee: 0.1, daily_limit: 10000 },
          { id: 0, tier: 'Silver', maker_fee: 0.08, taker_fee: 0.09, daily_limit: 50000 },
          { id: 0, tier: 'Gold', maker_fee: 0.06, taker_fee: 0.07, daily_limit: 200000 },
          { id: 0, tier: 'VIP', maker_fee: 0.04, taker_fee: 0.05, daily_limit: 1000000 }
        ];
      }
    } catch {
      fees = [];
    }
  }

  async function saveFee(f: any, i: number) {
    try {
      if (f.id) {
        await authPost(`/api/v1/admin/fees/${f.id}`, f);
      } else {
        await authPost('/api/v1/admin/fees', f);
      }
      toasts.success('تم الحفظ');
      loadFees();
    } catch {
      toasts.error('فشل الحفظ');
    }
  }

  async function deleteFee(id: number) {
    if (!confirm('حذف هذا المستوى؟')) return;
    try {
      const { authDelete } = await import('$lib/api/client');
      await authDelete(`/api/v1/admin/fees/${id}`);
      toasts.success('تم الحذف');
      loadFees();
    } catch {
      toasts.error('فشل الحذف');
    }
  }
</script>

<svelte:head><title>الرسوم — لوحة الإدارة</title></svelte:head>

<div class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">إدارة الرسوم</h1>
      <p class="text-sm text-slate-400 mt-1">تعديل جدول الرسوم لكل مستوى</p>
    </div>
    <button onclick={() => fees.push({ id: 0, tier: '', maker_fee: 0.1, taker_fee: 0.1, daily_limit: 10000 })} class="btn-primary">
      <Plus size={16} /> مستوى جديد
    </button>
  </div>

  {#if loading}
    <div class="panel p-6 space-y-3">
      {#each Array(4) as _}<div class="h-20 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
    </div>
  {:else}
    <div class="space-y-3">
      {#each fees as f, i}
        <div class="panel p-5">
          <div class="grid sm:grid-cols-4 gap-4">
            <div>
              <span class="input-label">المستوى</span>
              <input bind:value={f.tier} type="text" class="input" placeholder="Basic" />
            </div>
            <div>
              <span class="input-label">رسوم الصانع (%)</span>
              <input bind:value={f.maker_fee} type="number" step="0.01" class="input font-mono" />
            </div>
            <div>
              <span class="input-label">رسوم الآخذ (%)</span>
              <input bind:value={f.taker_fee} type="number" step="0.01" class="input font-mono" />
            </div>
            <div>
              <span class="input-label">الحد اليومي (USD)</span>
              <input bind:value={f.daily_limit} type="number" class="input font-mono" />
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button onclick={() => saveFee(f, i)} class="btn-primary text-xs">
              <Save size={14} /> حفظ
            </button>
            {#if f.id}
              <button onclick={() => deleteFee(f.id)} class="btn-secondary text-xs">
                <Trash2 size={14} /> حذف
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
