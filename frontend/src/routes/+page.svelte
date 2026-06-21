<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import LiveMiniChart from '$lib/components/LiveMiniChart.svelte';
  import { ShieldCheck, Zap, Wallet, ArrowLeft, BarChart3, Globe, ArrowUpRight, Activity } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { authStore } from '$lib/stores/auth';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';

  let tickers = $state<Record<string, MarketTicker>>({});
  let unsubNexus: (() => void) | null = null;
  let currentRate = $state(48.5);

  const previewSymbols = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', short: 'BTC', gradient: 'from-amber-500/20 to-orange-500/5', ring: 'border-amber-500/20' },
    { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH', gradient: 'from-indigo-500/20 to-purple-500/5', ring: 'border-indigo-500/20' },
    { symbol: 'SOLUSDT', name: 'Solana', short: 'SOL', gradient: 'from-fuchsia-500/20 to-pink-500/5', ring: 'border-fuchsia-500/20' },
    { symbol: 'BNBUSDT', name: 'BNB', short: 'BNB', gradient: 'from-yellow-500/20 to-amber-500/5', ring: 'border-yellow-500/20' },
    { symbol: 'XRPUSDT', name: 'Ripple', short: 'XRP', gradient: 'from-sky-500/20 to-blue-500/5', ring: 'border-sky-500/20' },
    { symbol: 'ADAUSDT', name: 'Cardano', short: 'ADA', gradient: 'from-cyan-500/20 to-teal-500/5', ring: 'border-cyan-500/20' }
  ];

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  const unsubMarket = marketStore.subscribe((t) => (tickers = t));

  onMount(() => {
    if (authStore.isAuthenticated()) goto('/dashboard');
    connectPreviewWS();
    return () => {
      unsubRate();
      unsubMarket();
      unsubNexus?.();
    };
  });

  function connectPreviewWS() {
    // Bootstrap with REST snapshot of all tickers
    (async () => {
      const all = await nexusMarket.getAllTickers();
      for (const t of all) {
        marketStore.updateTicker(t.symbol, {
          symbol: t.symbol,
          price: t.price,
          prevPrice: t.price,
          change24h: t.change24h,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: t.volume24h
        });
      }
    })();

    // Cycle through preview symbols every 3s so all cards stay live
    const symbols = previewSymbols.map((p) => p.symbol);
    let cycleIdx = 0;
    nexusMarket.switchSymbol(symbols[0]);
    const cycleInterval = setInterval(() => {
      cycleIdx = (cycleIdx + 1) % symbols.length;
      nexusMarket.switchSymbol(symbols[cycleIdx]);
    }, 3000);

    unsubNexus = nexusMarket.subscribeAll(() => {
      // marketStore is already updated inside nexusMarket
    });
    const origUnsub = unsubNexus;
    unsubNexus = () => {
      clearInterval(cycleInterval);
      origUnsub();
    };
  }

  const features = [
    {
      icon: Zap,
      title: 'تنفيذ فائق السرعة',
      desc: 'محرك مطابقة بأقل من 10 مللي ثانية لكل صفقة',
      color: 'accent-mint'
    },
    {
      icon: ShieldCheck,
      title: 'أمان بمستوى البنوك',
      desc: 'تشفير كامل + مصادقة ثنائية + تخزين بارد للأصول',
      color: 'accent-azure'
    },
    {
      icon: BarChart3,
      title: 'مخططات احترافية',
      desc: 'مؤشرات فنية متقدمة + رسم على الشارت + تصدير',
      color: 'accent-gold'
    },
    {
      icon: Wallet,
      title: 'محفظة متكاملة',
      desc: 'إيداع وسحب فوري + تتبع المعاملات + تقرير شامل',
      color: 'accent-violet'
    }
  ];

  const stats = [
    { value: '+2M', label: 'متداول نشط' },
    { value: '$50B', label: 'حجم تداول يومي' },
    { value: '+200', label: 'عملة رقمية' },
    { value: '99.99%', label: 'وقت تشغيل' }
  ];
</script>

<ParticleBackground />

<svelte:head><title>NEXUS Exchange — منصة تداول العملات الرقمية</title></svelte:head>

<!-- Floating theme toggle (top-left for RTL) -->
<div class="fixed top-4 left-4 z-50">
  <div class="panel p-1 rounded-xl">
    <ThemeToggle size={20} />
  </div>
</div>

<!-- Hero -->
<section class="relative min-h-screen flex items-center justify-center px-4 py-20">
  <div class="absolute inset-0 grid-bg opacity-30"></div>

  <div class="relative z-10 max-w-5xl mx-auto text-center">
    <!-- Badge -->
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-xs font-medium mb-8 animate-float">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
      منصة التداول رقم 1 في الشرق الأوسط
    </div>

    <!-- Title -->
    <h1 class="text-5xl sm:text-7xl font-bold leading-[1.1] text-balance mb-6">
      تداول بثقة على
      <span class="text-aurora block mt-2">منصة الجيل القادم</span>
    </h1>

    <!-- Subtitle -->
    <p class="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
      تجربة تداول احترافية تجمع بين السرعة والأمان والسيولة العالية. انضم إلى آلاف المتداولين الذين يثقون بنا.
    </p>

    <!-- CTAs -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
      <Button href="/register" size="lg" class="px-8 py-3.5 text-base">
        ابدأ التداول الآن
        <ArrowLeft size={20} />
      </Button>
      <Button href="/login" variant="secondary" size="lg" class="px-8 py-3.5 text-base">
        تسجيل الدخول
      </Button>
    </div>

    <!-- Live mini-charts row (BTC + ETH) -->
    <div class="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-12">
      <div class="panel p-4 hover:border-accent-gold/30 transition-colors">
        <LiveMiniChart symbol="BTCUSDT" height={70} />
      </div>
      <div class="panel p-4 hover:border-accent-violet/30 transition-colors">
        <LiveMiniChart symbol="ETHUSDT" height={70} />
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
      {#each stats as stat, i}
        <div class="text-center" style="animation: float 6s ease-in-out infinite; animation-delay: {i * 0.5}s;">
          <div class="text-3xl sm:text-4xl font-bold text-gold-gradient">{stat.value}</div>
          <div class="text-xs sm:text-sm text-slate-400 mt-1">{stat.label}</div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Live Markets Preview -->
<section class="relative px-4 py-20 max-w-6xl mx-auto">
  <div class="flex items-end justify-between mb-8">
    <div>
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-mint/10 border border-accent-mint/20 text-accent-mint text-xs font-medium mb-3">
        <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
        بيانات مباشرة من Binance
      </div>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mb-2">الأسعار اللحظية</h2>
      <p class="text-slate-400">أسعار حية بالجنيه المصري — حدّث تلقائياً كل ثانية</p>
    </div>
    <a href="/register" class="hidden sm:flex items-center gap-1 text-sm text-accent-gold hover:gap-2 transition-all">
      عرض كل الأسواق <ArrowUpRight size={16} />
    </a>
  </div>

  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {#each previewSymbols as coin, i}
      {@const t = tickers[coin.symbol]}
      <a
        href="/register"
        class="panel p-5 hover:border-white/15 transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden"
        style="animation: float 6s ease-in-out infinite; animation-delay: {i * 0.3}s;"
      >
        <!-- Coin glow -->
        <div class="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-br {coin.gradient} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

        <div class="relative z-10">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br {coin.gradient} border {coin.ring} flex items-center justify-center font-bold text-white text-sm">
                {coin.short.slice(0, 2)}
              </div>
              <div>
                <p class="font-bold text-white text-sm">{coin.short}</p>
                <p class="text-xs text-slate-500">{coin.name}</p>
              </div>
            </div>
            {#if t}
              <ChangeBadge change={t.change24h} showIcon={true} className="text-xs" />
            {/if}
          </div>

          <!-- Price -->
          <div class="space-y-1">
            {#if t}
              <div class="flex items-baseline gap-1">
                <span class="text-[10px] text-slate-500 font-bold">ج.م</span>
                <PriceFlash
                  value={usdToEgp(t.price, currentRate)}
                  prevValue={usdToEgp(t.prevPrice, currentRate)}
                  decimals={t.price > 1000 ? 0 : 2}
                  className="text-2xl font-bold text-white font-mono"
                />
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                <span class="flex items-center gap-1">
                  <Activity size={10} />
                  حجم: {egpCompact(usdToEgp(t.volume24h * t.price, currentRate))}
                </span>
              </div>
            {:else}
              <div class="space-y-2">
                <div class="h-7 w-32 rounded bg-white/5 animate-pulse"></div>
                <div class="h-3 w-24 rounded bg-white/5 animate-pulse"></div>
              </div>
            {/if}
          </div>
        </div>
      </a>
    {/each}
  </div>

  <!-- EGP rate info bar -->
  <div class="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 px-4 py-3 rounded-xl bg-ink-900/40 border border-white/5">
    <span class="flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
      التحديث مباشر
    </span>
    <span>•</span>
    <span>سعر الصرف الحالي: <span class="text-accent-gold font-mono font-bold">1 USD = {currentRate.toFixed(2)} EGP</span></span>
    <span>•</span>
    <span>جميع القيم بالجنيه المصري (ج.م)</span>
  </div>
</section>

<!-- Features -->
<section class="relative px-4 py-20 max-w-6xl mx-auto">
  <div class="text-center mb-12">
    <h2 class="text-3xl sm:text-4xl font-bold text-white mb-3">لماذا NEXUS؟</h2>
    <p class="text-slate-400">مزايا احترافية تجعلنا الخيار الأول للمتداولين</p>
  </div>

  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {#each features as feat, i}
      <div class="panel p-6 hover:border-white/15 transition-all duration-300 hover:-translate-y-1 group">
        <div class="w-12 h-12 rounded-xl bg-{feat.color}/10 border border-{feat.color}/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <feat.icon size={22} class="text-{feat.color}" />
        </div>
        <h3 class="text-lg font-bold text-white mb-2">{feat.title}</h3>
        <p class="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
      </div>
    {/each}
  </div>
</section>

<!-- CTA -->
<section class="relative px-4 py-20">
  <div class="max-w-3xl mx-auto panel-glow p-10 sm:p-14 text-center">
    <Globe size={48} class="text-accent-gold mx-auto mb-4" />
    <h2 class="text-3xl sm:text-4xl font-bold text-white mb-3">
      جاهز لبدء رحلتك؟
    </h2>
    <p class="text-slate-400 mb-8 max-w-xl mx-auto">
      أنشئ حسابك خلال دقيقة واحدة وابدأ التداول بأقل من 5 دولارات
    </p>
    <Button href="/register" size="lg" class="px-8">
      أنشئ حسابك المجاني
      <ArrowLeft size={20} />
    </Button>
  </div>
</section>

<footer class="px-4 py-8 text-center text-sm text-slate-500">
  © 2026 NEXUS Exchange. جميع الحقوق محفوظة.
</footer>
