<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, authPost, parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import {
    Plus, Save, Trash2, Coins, RefreshCw, Loader2,
    Crown, Award, Sparkles, TrendingUp, Percent, Wallet,
    Check, X, Edit, DollarSign
  } from 'lucide-svelte';

  let fees = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let savingId = $state<number | null>(null);

  onMount(() => {
    (async () => {
      await loadFees();
      loading = false;
    })();
  });

  async function loadFees() {
    refreshing = true;
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
    } finally {
      refreshing = false;
    }
  }

  async function saveFee(f: any, i: number) {
    savingId = i;
    try {
      if (f.id) {
        await authPost(`/api/v1/admin/fees/${f.id}`, f);
      } else {
        await authPost('/api/v1/admin/fees', f);
      }
      toasts.success('تم حفظ مستوى الرسوم');
      loadFees();
    } catch {
      toasts.error('فشل الحفظ');
    } finally {
      savingId = null;
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

  function addTier() {
    fees = [...fees, { id: 0, tier: '', maker_fee: 0.1, taker_fee: 0.1, daily_limit: 10000 }];
  }

  const tierMeta: Record<string, { icon: any; gradient: string; iconColor: string; accentClass: string }> = {
    VIP: { icon: Crown, gradient: 'from-accent-violet/25 to-accent-rose/15', iconColor: 'text-accent-violet', accentClass: 'pill-violet' },
    Gold: { icon: Award, gradient: 'from-accent-gold/25 to-accent-rose/15', iconColor: 'text-accent-gold', accentClass: 'pill-gold' },
    Silver: { icon: Sparkles, gradient: 'from-accent-azure/25 to-accent-violet/15', iconColor: 'text-accent-azure', accentClass: 'pill-azure' },
    Basic: { icon: TrendingUp, gradient: 'from-slate-500/25 to-slate-600/15', iconColor: 'text-slate-400', accentClass: 'pill-azure' }
  };

  function getTierMeta(tier: string) {
    return tierMeta[tier] || { icon: Coins, gradient: 'from-accent-gold/25 to-accent-violet/15', iconColor: 'text-accent-gold', accentClass: 'pill-gold' };
  }

  const stats = $derived({
    total: fees.length,
    lowestMaker: fees.length > 0 ? Math.min(...fees.map((f) => f.maker_fee || 0)) : 0,
    highestMaker: fees.length > 0 ? Math.max(...fees.map((f) => f.maker_fee || 0)) : 0,
    totalLimits: fees.reduce((sum, f) => sum + (f.daily_limit || 0), 0)
  });
</script>

<svelte:head><title>إدارة الرسوم — NEXUS Admin</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-violet/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-gold/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-gold/10 border border-accent-violet/20 flex items-center justify-center">
        <Percent size={22} class="text-accent-violet" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">إدارة الرسوم</h1>
          <span class="pill-gold text-[10px]">{fees.length} مستوى</span>
        </div>
        <p class="text-sm text-slate-400">تعديل جدول الرسوم والحدود لكل مستوى</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button onclick={loadFees} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
        <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
      </button>
      <button onclick={addTier} class="btn-primary">
        <Plus size={16} /> مستوى جديد
      </button>
    </div>
  </div>

  <!-- Quick stats grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Coins size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">المستويات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.total}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">مستوى رسوم</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <TrendingUp size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">أقل رسوم صانع</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.lowestMaker.toFixed(2)}%</p>
        <p class="text-[10px] text-slate-500 mt-0.5">للمستوى الأعلى</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Percent size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">أعلى رسوم صانع</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.highestMaker.toFixed(2)}%</p>
        <p class="text-[10px] text-slate-500 mt-0.5">للمستوى الأساسي</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Wallet size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إجمالي الحدود</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">${(stats.totalLimits / 1000).toFixed(0)}K</p>
        <p class="text-[10px] text-slate-500 mt-0.5">حد يومي إجمالي</p>
      </div>
    </div>
  </div>

  <!-- Fees list -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}<div class="panel p-5 animate-shimmer h-32"></div>{/each}
    </div>
  {:else if fees.length === 0}
    <div class="panel py-20 text-center">
      <div class="relative inline-block mb-4">
        <div class="absolute inset-0 bg-accent-violet/10 blur-3xl rounded-full"></div>
        <Percent size={48} class="relative text-slate-600 mx-auto" />
      </div>
      <p class="text-sm font-medium text-slate-300">لا توجد مستويات رسوم</p>
      <p class="text-xs text-slate-500 mt-1">أنشئ مستوى الرسوم الأول</p>
      <button onclick={addTier} class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-accent-violet/10 border border-accent-violet/30 text-accent-violet text-xs font-medium hover:bg-accent-violet/20 transition-colors">
        <Plus size={14} /> إضافة مستوى
      </button>
    </div>
  {:else}
    <div class="space-y-3">
      {#each fees as f, i}
        {@const meta = getTierMeta(f.tier)}
        <div class="panel p-5 sm:p-6 relative overflow-hidden group hover:border-white/15 transition-all">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {f.tier === 'VIP' ? 'rgba(168, 85, 247, 0.4)' : f.tier === 'Gold' ? 'rgba(245, 181, 68, 0.4)' : f.tier === 'Silver' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(148, 163, 184, 0.3)'}, transparent);"></div>

          <div class="relative">
            <!-- Tier header -->
            <div class="flex items-center justify-between gap-4 mb-4">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-br {meta.gradient} border border-white/10 flex items-center justify-center shrink-0">
                  <meta.icon size={18} class={meta.iconColor} />
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">المستوى</p>
                  <p class="text-base font-bold text-white">{f.tier || `مستوى ${i + 1}`}</p>
                </div>
              </div>
              {#if f.id}
                <button onclick={() => deleteFee(f.id)} class="p-2 rounded-lg text-accent-rose hover:bg-accent-rose/10 transition-colors" aria-label="حذف">
                  <Trash2 size={14} />
                </button>
              {/if}
            </div>

            <!-- Form grid -->
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <span class="input-label flex items-center gap-1">
                  <Coins size={10} class="text-accent-gold" /> اسم المستوى
                </span>
                <input bind:value={f.tier} type="text" class="input font-medium" placeholder="Basic" />
              </div>
              <div>
                <span class="input-label flex items-center gap-1">
                  <TrendingUp size={10} class="text-accent-mint" /> رسوم الصانع (%)
                </span>
                <input bind:value={f.maker_fee} type="number" step="0.01" class="input font-mono" />
              </div>
              <div>
                <span class="input-label flex items-center gap-1">
                  <Percent size={10} class="text-accent-rose" /> رسوم الآخذ (%)
                </span>
                <input bind:value={f.taker_fee} type="number" step="0.01" class="input font-mono" />
              </div>
              <div>
                <span class="input-label flex items-center gap-1">
                  <DollarSign size={10} class="text-accent-violet" /> الحد اليومي (USD)
                </span>
                <input bind:value={f.daily_limit} type="number" class="input font-mono" />
              </div>
            </div>

            <div class="flex gap-2 mt-4">
              <button onclick={() => saveFee(f, i)} disabled={savingId === i} class="btn-primary text-xs py-2">
                {#if savingId === i}
                  <Loader2 size={13} class="animate-spin" /> جارٍ الحفظ...
                {:else}
                  <Save size={13} /> حفظ المستوى
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
