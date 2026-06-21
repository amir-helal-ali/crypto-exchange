<script lang="ts">
  import { onMount } from 'svelte';
  import { fees as feesApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, usdEgpRate } from '$lib/utils/currency';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { Coins, TrendingUp, ArrowRightLeft, Zap, Info, Calculator } from 'lucide-svelte';

  let feeSchedules = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state<'tiers' | 'details' | 'calc'>('tiers');
  let currentRate = $state(48.5);

  // Calculator inputs
  let calcTradeAmount = $state('1000');
  let calcFeePercent = $state(0.1);

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
    { name: 'Basic', label: 'أساسي', color: 'slate', icon: Zap, features: ['رسوم قياسية', 'دعم عبر البريد', 'حد يومي 10K'] },
    { name: 'Silver', label: 'فضي', color: 'azure', icon: ArrowRightLeft, features: ['رسوم مخفّضة', 'دعم ذو أولوية', 'حد يومي 50K'] },
    { name: 'Gold', label: 'ذهبي', color: 'gold', icon: TrendingUp, features: ['رسوم منخفضة', 'دعم 24/7', 'حد يومي 200K', 'تحليلات متقدمة'] },
    { name: 'VIP', label: 'VIP', color: 'violet', icon: Coins, features: ['أدنى رسوم', 'مدير حساب خاص', 'حد يومي 1M', 'API مجاني', 'أحداث حصرية'] }
  ];

  // Calc outputs
  const calcUsd = $derived(parseFloat(calcTradeAmount) || 0);
  const calcEgp = $derived(usdToEgp(calcUsd, currentRate));
  const calcFeeUsd = $derived((calcUsd * calcFeePercent) / 100);
  const calcFeeEgp = $derived(usdToEgp(calcFeeUsd, currentRate));
</script>

<svelte:head><title>الرسوم — NEXUS</title></svelte:head>

<div class="max-w-5xl mx-auto space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">جدول الرسوم</h1>
    <p class="text-sm text-slate-400 mt-1">رسوم تداول تنافسية تنخفض مع زيادة حجم التداول</p>
  </div>

  <!-- EGP rate banner -->
  <div class="panel p-4 bg-gradient-to-br from-accent-gold/5 to-accent-violet/5 border-accent-gold/20">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-accent-gold/15 flex items-center justify-center shrink-0">
        <Coins size={18} class="text-accent-gold" />
      </div>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">العملة الأساسية للمنصة: الجنيه المصري (ج.م)</p>
        <p class="text-xs text-slate-400 mt-0.5 tabular-nums">
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
    <!-- Tiers grid -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {#each tiers as tier, i}
        <div class="panel p-5 hover:border-white/15 transition-all hover:-translate-y-1 {i === 2 ? 'panel-glow' : ''}">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-9 h-9 rounded-lg bg-{tier.color}/10 border border-{tier.color}/20 flex items-center justify-center">
              <tier.icon size={16} class="text-{tier.color}" />
            </div>
            <span class="text-sm font-bold text-white">{tier.label}</span>
          </div>

          <div class="space-y-1.5 mb-4">
            <div class="flex items-baseline justify-between">
              <span class="text-xs text-slate-400">صانع (Maker)</span>
              <span class="text-lg font-bold font-mono text-white">
                {feeSchedules[i]?.maker_fee?.toFixed(2) || '0.10'}%
              </span>
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-xs text-slate-400">آخذ (Taker)</span>
              <span class="text-lg font-bold font-mono text-white">
                {feeSchedules[i]?.taker_fee?.toFixed(2) || '0.10'}%
              </span>
            </div>
            <div class="flex items-baseline justify-between pt-2 border-t border-white/5">
              <span class="text-xs text-slate-400">الحد اليومي</span>
              <span class="text-xs font-mono text-slate-300 tabular-nums">
                {egpCompact(usdToEgp(feeSchedules[i]?.daily_limit || 10000, currentRate))}
              </span>
            </div>
          </div>

          <ul class="space-y-1.5 mb-4">
            {#each tier.features as f}
              <li class="flex items-center gap-2 text-[11px] text-slate-300">
                <svg class="w-3 h-3 text-accent-mint shrink-0" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="2" fill="none" />
                </svg>
                {f}
              </li>
            {/each}
          </ul>

          {#if i === 2}
            <button class="btn-primary w-full text-xs">الأكثر شعبية</button>
          {/if}
        </div>
      {/each}
    </div>
  {:else if activeTab === 'details'}
    <div class="panel overflow-hidden">
      <div class="px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white">تفاصيل الرسوم</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th class="text-right font-medium px-5 py-3">المستوى</th>
              <th class="text-right font-medium px-5 py-3">حجم التداول (30 يوم)</th>
              <th class="text-right font-medium px-5 py-3">صانع</th>
              <th class="text-left font-medium px-5 py-3">آخذ</th>
            </tr>
          </thead>
          <tbody>
            {#each feeSchedules as f, i}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td class="px-5 py-3 font-semibold text-white">{tiers[i]?.label || f.tier}</td>
                <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">
                  {egpCompact(usdToEgp(f.daily_limit || 0, currentRate))}
                </td>
                <td class="px-5 py-3 font-mono text-accent-mint tabular-nums">{f.maker_fee?.toFixed(2) || '0.10'}%</td>
                <td class="px-5 py-3 font-mono text-accent-rose text-left tabular-nums">{f.taker_fee?.toFixed(2) || '0.10'}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel p-5 bg-accent-azure/5 border-accent-azure/20">
      <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
        <Info size={14} class="text-accent-azure" /> معلومات إضافية
      </h3>
      <ul class="space-y-2 text-xs text-slate-300">
        <li class="flex items-start gap-2">
          <span class="text-accent-azure mt-0.5">•</span>
          <span>الرسوم محسوبة على القيمة الإجمالية للصفقة (السعر × الكمية)</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-accent-azure mt-0.5">•</span>
          <span>الإيداع والسحب مجاني لمعظم العملات (قد تطبّق رسوم شبكة البلوكتشين)</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-accent-azure mt-0.5">•</span>
          <span>يتم تحديث مستواك تلقائياً كل 24 ساعة بناءً على حجم تداولك في آخر 30 يوم</span>
        </li>
      </ul>
    </div>
  {:else if activeTab === 'calc'}
    <div class="panel p-6 space-y-5">
      <h3 class="text-base font-bold text-white flex items-center gap-2">
        <Calculator size={18} class="text-accent-gold" /> حاسبة الرسوم
      </h3>

      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <span class="input-label">قيمة الصفقة (USD)</span>
          <input
            bind:value={calcTradeAmount}
            type="number"
            step="0.01"
            class="input font-mono"
            placeholder="1000"
          />
          <p class="text-[10px] text-slate-500 mt-1 tabular-nums">
            ≈ {egpWithSymbol(calcEgp)}
          </p>
        </div>
        <div>
          <span class="input-label">نسبة الرسوم (%)</span>
          <select bind:value={calcFeePercent} class="input">
            <option value={0.1}>0.10% — أساسي</option>
            <option value={0.08}>0.08% — فضي</option>
            <option value={0.06}>0.06% — ذهبي</option>
            <option value={0.04}>0.04% — VIP</option>
          </select>
        </div>
      </div>

      <!-- Result card -->
      <div class="panel-glow p-5">
        <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-2">الرسوم المتوقعة</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-slate-400 mb-1">بالجنيه المصري</p>
            <p class="text-2xl font-bold text-gold-gradient tabular-nums">
              {egpWithSymbol(calcFeeEgp)}
            </p>
          </div>
          <div class="text-left">
            <p class="text-xs text-slate-400 mb-1">بالدولار الأمريكي</p>
            <p class="text-2xl font-bold text-slate-300 tabular-nums">
              ${formatPrice(calcFeeUsd)}
            </p>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
          <span class="text-slate-400">صافي قيمة الصفقة بعد الرسوم</span>
          <span class="font-mono text-white tabular-nums">
            {egpWithSymbol(calcEgp - calcFeeEgp)}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>
