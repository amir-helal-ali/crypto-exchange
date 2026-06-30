<script lang="ts">
  import { onMount } from 'svelte';
  import { fees as feesApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, usdEgpRate } from '$lib/utils/currency';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    Coins, TrendingUp, ArrowRightLeft, Zap, Info, Calculator,
    Check, Sparkles, Crown, Star, Shield, RefreshCw
  } from 'lucide-svelte';

  let feeSchedules = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state<'tiers' | 'details' | 'calc'>('tiers');
  let currentRate = $state(48.5);

  // Calculator inputs
  let calcTradeAmount = $state('1000');
  let calcFeePercent = $state(0.1);
  let calcSide = $state<'maker' | 'taker'>('taker');

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  onMount(() => {
    (async () => {
      try {
        const res = await feesApi.getSchedules();
        feeSchedules = (await parseApiResponse<any[]>(res)) || [];
      } catch {
        // Fallback default fees
        feeSchedules = [
          { tier: 'Basic', maker_fee: 0.1, taker_fee: 0.1, daily_limit: 10000 },
          { tier: 'Silver', maker_fee: 0.08, taker_fee: 0.09, daily_limit: 50000 },
          { tier: 'Gold', maker_fee: 0.06, taker_fee: 0.07, daily_limit: 200000 },
          { tier: 'VIP', maker_fee: 0.04, taker_fee: 0.05, daily_limit: 1000000 }
        ];
      } finally {
        loading = false;
      }
    })();
    return unsubRate;
  });

  const tiers = [
    {
      name: 'Basic', label: 'أساسي', color: 'slate', icon: Zap, accent: '#94a3b8',
      features: ['رسوم قياسية', 'دعم عبر البريد', 'حد يومي 10K']
    },
    {
      name: 'Silver', label: 'فضي', color: 'azure', icon: ArrowRightLeft, accent: '#3b82f6',
      features: ['رسوم مخفّضة', 'دعم ذو أولوية', 'حد يومي 50K']
    },
    {
      name: 'Gold', label: 'ذهبي', color: 'gold', icon: Crown, accent: '#f5b544',
      features: ['رسوم منخفضة', 'دعم 24/7', 'حد يومي 200K', 'تحليلات متقدمة'],
      popular: true
    },
    {
      name: 'VIP', label: 'VIP', color: 'violet', icon: Sparkles, accent: '#a855f7',
      features: ['أدنى رسوم', 'مدير حساب خاص', 'حد يومي 1M', 'API مجاني', 'أحداث حصرية']
    }
  ];

  // Calc outputs
  const calcUsd = $derived(parseFloat(calcTradeAmount) || 0);
  const calcEgp = $derived(usdToEgp(calcUsd, currentRate));
  const calcFeeUsd = $derived((calcUsd * calcFeePercent) / 100);
  const calcFeeEgp = $derived(usdToEgp(calcFeeUsd, currentRate));
  const calcNetEgp = $derived(calcEgp - calcFeeEgp);
</script>

<svelte:head><title>الرسوم — NEXUS</title></svelte:head>

<div class="max-w-5xl mx-auto space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
        <Coins size={22} class="text-accent-gold" />
      </div>
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">جدول الرسوم</h1>
        <p class="text-sm text-slate-400 mt-0.5">رسوم تداول تنافسية تنخفض مع زيادة حجم التداول</p>
      </div>
    </div>
  </div>

  <!-- EGP rate banner -->
  <div class="panel p-4 bg-gradient-to-br from-accent-gold/8 to-accent-violet/5 border-accent-gold/20 relative overflow-hidden">
    <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/15 blur-3xl rounded-full animate-pulse-glow"></div>
    <div class="relative flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-accent-gold/15 border border-accent-gold/25 flex items-center justify-center shrink-0">
        <Coins size={18} class="text-accent-gold" />
      </div>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">العملة الأساسية للمنصة: الجنيه المصري (ج.م)</p>
        <p class="text-xs text-slate-400 mt-0.5 tabular-nums flex items-center gap-1.5">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
          </span>
          سعر الصرف الحالي: 1 USD ≈ {currentRate.toFixed(2)} ج.م
        </p>
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: 'tiers', label: 'المستويات', icon: TrendingUp },
      { key: 'details', label: 'جدول مفصّل', icon: ArrowRightLeft },
      { key: 'calc', label: 'حاسبة الرسوم', icon: Calculator }
    ]}
  />

  {#if activeTab === 'tiers'}
    <!-- Tiers grid — premium cards -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each tiers as tier, i}
        <div class="relative panel p-5 hover:border-white/20 transition-all hover:-translate-y-1.5 group overflow-hidden {tier.popular ? 'panel-glow' : ''}">
          <!-- Decorative glow -->
          <div class="absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full opacity-30 group-hover:opacity-60 transition-opacity" style="background: {tier.accent};"></div>

          {#if tier.popular}
            <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {tier.accent}, transparent);"></div>
            <span class="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-accent-gold text-ink-950 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <Star size={9} /> الأكثر شعبية
            </span>
          {/if}

          <div class="relative">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border" style="background: {tier.accent}15; border-color: {tier.accent}30;">
              <tier.icon size={22} style="color: {tier.accent};" />
            </div>

            <h3 class="text-base font-bold text-white mb-3">{tier.label}</h3>

            <div class="space-y-1.5 mb-4">
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-400">صانع (Maker)</span>
                <span class="text-lg font-bold font-mono text-white tabular-nums">
                  {feeSchedules[i]?.maker_fee?.toFixed(2) || '0.10'}%
                </span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-xs text-slate-400">آخذ (Taker)</span>
                <span class="text-lg font-bold font-mono text-white tabular-nums">
                  {feeSchedules[i]?.taker_fee?.toFixed(2) || '0.10'}%
                </span>
              </div>
              <div class="flex items-baseline justify-between pt-2 border-t border-white/5">
                <span class="text-xs text-slate-400">الحد اليومي</span>
                <span class="text-xs font-mono text-slate-300 tabular-nums">
                  {egpCompact(usdToEgp(feeSchedules[i]?.daily_limit || 10000, currentRate))} ج.م
                </span>
              </div>
            </div>

            <ul class="space-y-1.5 mb-4">
              {#each tier.features as f}
                <li class="flex items-center gap-2 text-[11px] text-slate-300">
                  <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style="background: {tier.accent}20;">
                    <Check size={10} style="color: {tier.accent};" />
                  </div>
                  {f}
                </li>
              {/each}
            </ul>

            {#if tier.popular}
              <button class="btn-primary w-full text-xs">ترقية الآن</button>
            {:else if i < 2}
              <button class="btn-secondary w-full text-xs">ترقية</button>
            {:else}
              <button class="btn-ghost w-full text-xs">المستوى الحالي</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if activeTab === 'details'}
    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
      <div class="px-5 py-4 border-b border-white/5 flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <ArrowRightLeft size={14} class="text-accent-gold" />
        </div>
        <h3 class="text-sm font-bold text-white">تفاصيل الرسوم</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.01]">
              <th class="text-right font-medium px-5 py-3">المستوى</th>
              <th class="text-right font-medium px-5 py-3">حجم التداول (30 يوم)</th>
              <th class="text-right font-medium px-5 py-3">صانع</th>
              <th class="text-left font-medium px-5 py-3">آخذ</th>
            </tr>
          </thead>
          <tbody>
            {#each feeSchedules as f, i}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: {tiers[i]?.accent}15; border: 1px solid {tiers[i]?.accent}30;">
                      {#if tiers[i]}
                        <svelte:component this={tiers[i].icon} size={14} style="color: {tiers[i].accent};" />
                      {/if}
                    </div>
                    <span class="font-semibold text-white">{tiers[i]?.label || f.tier}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5 font-mono text-slate-300 tabular-nums">
                  {egpCompact(usdToEgp(f.daily_limit || 0, currentRate))} ج.م
                </td>
                <td class="px-5 py-3.5">
                  <span class="font-mono font-bold text-accent-mint tabular-nums">{f.maker_fee?.toFixed(2) || '0.10'}%</span>
                </td>
                <td class="px-5 py-3.5 text-left">
                  <span class="font-mono font-bold text-accent-rose tabular-nums">{f.taker_fee?.toFixed(2) || '0.10'}%</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Additional info -->
    <div class="panel p-5 bg-accent-azure/5 border-accent-azure/20 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-azure/10 blur-3xl rounded-full"></div>
      <div class="relative">
        <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-accent-azure/15 flex items-center justify-center">
            <Info size={14} class="text-accent-azure" />
          </div>
          معلومات إضافية
        </h3>
        <ul class="space-y-2.5 text-xs text-slate-300">
          <li class="flex items-start gap-2.5">
            <div class="w-5 h-5 rounded-full bg-accent-azure/15 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={10} class="text-accent-azure" />
            </div>
            <span>الرسوم محسوبة على القيمة الإجمالية للصفقة (السعر × الكمية)</span>
          </li>
          <li class="flex items-start gap-2.5">
            <div class="w-5 h-5 rounded-full bg-accent-azure/15 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={10} class="text-accent-azure" />
            </div>
            <span>الإيداع والسحب مجاني لمعظم العملات (قد تطبّق رسوم شبكة البلوكتشين)</span>
          </li>
          <li class="flex items-start gap-2.5">
            <div class="w-5 h-5 rounded-full bg-accent-azure/15 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={10} class="text-accent-azure" />
            </div>
            <span>يتم تحديث مستواك تلقائياً كل 24 ساعة بناءً على حجم تداولك في آخر 30 يوم</span>
          </li>
        </ul>
      </div>
    </div>
  {:else if activeTab === 'calc'}
    <div class="panel p-6 space-y-5 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/8 blur-3xl rounded-full"></div>

      <h3 class="text-base font-bold text-white flex items-center gap-2 relative">
        <div class="w-8 h-8 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <Calculator size={16} class="text-accent-gold" />
        </div>
        حاسبة الرسوم
      </h3>

      <div class="grid sm:grid-cols-2 gap-4 relative">
        <div>
          <label class="input-label flex items-center gap-1.5">
            <Coins size={12} class="text-accent-gold" />
            قيمة الصفقة (USD)
          </label>
          <input
            bind:value={calcTradeAmount}
            type="number"
            step="0.01"
            class="input font-mono text-lg"
            placeholder="1000"
          />
          <p class="text-[10px] text-slate-500 mt-1 tabular-nums">
            ≈ {egpWithSymbol(calcEgp)}
          </p>
        </div>
        <div>
          <label class="input-label flex items-center gap-1.5">
            <TrendingUp size={12} class="text-accent-gold" />
            نوع الصفقة
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => { calcSide = 'maker'; calcFeePercent = 0.06; }}
              class="p-3 rounded-xl border text-center transition-all {calcSide === 'maker'
                ? 'border-accent-mint/40 bg-accent-mint/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <p class="text-xs font-bold {calcSide === 'maker' ? 'text-accent-mint' : 'text-slate-400'}">صانع</p>
              <p class="text-[10px] text-slate-500">Maker</p>
            </button>
            <button
              type="button"
              onclick={() => { calcSide = 'taker'; calcFeePercent = 0.07; }}
              class="p-3 rounded-xl border text-center transition-all {calcSide === 'taker'
                ? 'border-accent-rose/40 bg-accent-rose/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <p class="text-xs font-bold {calcSide === 'taker' ? 'text-accent-rose' : 'text-slate-400'}">آخذ</p>
              <p class="text-[10px] text-slate-500">Taker</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Tier selector -->
      <div class="relative">
        <label class="input-label flex items-center gap-1.5">
          <Crown size={12} class="text-accent-gold" />
          المستوى
        </label>
        <div class="grid grid-cols-4 gap-2">
          {#each [{ k: 0.1, l: 'أساسي' }, { k: 0.08, l: 'فضي' }, { k: 0.06, l: 'ذهبي' }, { k: 0.04, l: 'VIP' }] as opt}
            <button
              type="button"
              onclick={() => (calcFeePercent = opt.k)}
              class="p-2 rounded-xl border text-center transition-all {calcFeePercent === opt.k
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <p class="text-[10px] font-bold text-white">{opt.l}</p>
              <p class="text-[9px] text-slate-500 tabular-nums">{opt.k.toFixed(2)}%</p>
            </button>
          {/each}
        </div>
      </div>

      <!-- Result card -->
      <div class="panel-glow p-5 relative overflow-hidden">
        <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/15 blur-3xl rounded-full"></div>
        <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 relative">
          <Sparkles size={11} class="text-accent-gold" />
          الرسوم المتوقعة
        </p>
        <div class="grid grid-cols-2 gap-4 relative">
          <div>
            <p class="text-xs text-slate-400 mb-1">بالجنيه المصري</p>
            <p class="text-3xl font-bold text-gold-gradient tabular-nums">
              {egpWithSymbol(calcFeeEgp)}
            </p>
          </div>
          <div class="text-left">
            <p class="text-xs text-slate-400 mb-1">بالدولار الأمريكي</p>
            <p class="text-3xl font-bold text-slate-300 tabular-nums">
              ${formatPrice(calcFeeUsd)}
            </p>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs relative">
          <span class="text-slate-400 flex items-center gap-1.5">
            <Shield size={11} class="text-accent-mint" />
            صافي قيمة الصفقة بعد الرسوم
          </span>
          <span class="font-mono text-white font-bold tabular-nums">
            {egpWithSymbol(calcNetEgp)}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>
