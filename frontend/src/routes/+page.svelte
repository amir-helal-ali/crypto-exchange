<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import LiveMiniChart from '$lib/components/LiveMiniChart.svelte';
  import {
    ShieldCheck, Zap, Wallet, ArrowLeft, BarChart3, Globe, ArrowUpRight,
    Activity, ChevronLeft, Sparkles, Crown, TrendingUp, Server, Lock,
    AtSign, Send, Link2
  } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import { authStore } from '$lib/stores/auth';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';

  let tickers = $state<Record<string, MarketTicker>>({});
  let unsubNexus: (() => void) | null = null;
  let currentRate = $state(48.5);

  const previewSymbols = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', short: 'BTC', gradient: 'from-accent-gold/20 to-accent-rose/5', ring: 'border-accent-gold/20', glow: 'bg-accent-gold/10' },
    { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH', gradient: 'from-accent-violet/20 to-accent-azure/5', ring: 'border-accent-violet/20', glow: 'bg-accent-violet/10' },
    { symbol: 'SOLUSDT', name: 'Solana', short: 'SOL', gradient: 'from-accent-violet/20 to-accent-rose/5', ring: 'border-accent-violet/20', glow: 'bg-accent-violet/10' },
    { symbol: 'BNBUSDT', name: 'BNB', short: 'BNB', gradient: 'from-accent-gold/20 to-accent-violet/5', ring: 'border-accent-gold/20', glow: 'bg-accent-gold/10' },
    { symbol: 'XRPUSDT', name: 'Ripple', short: 'XRP', gradient: 'from-accent-azure/20 to-accent-mint/5', ring: 'border-accent-azure/20', glow: 'bg-accent-azure/10' },
    { symbol: 'ADAUSDT', name: 'Cardano', short: 'ADA', gradient: 'from-accent-mint/20 to-accent-azure/5', ring: 'border-accent-mint/20', glow: 'bg-accent-mint/10' }
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

    unsubNexus = nexusMarket.subscribeAll(() => {});
  }

  // Static color class lookup (Tailwind JIT-safe)
  const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    mint: { bg: 'bg-accent-mint/10', border: 'border-accent-mint/20', text: 'text-accent-mint', glow: 'bg-accent-mint/10' },
    azure: { bg: 'bg-accent-azure/10', border: 'border-accent-azure/20', text: 'text-accent-azure', glow: 'bg-accent-azure/10' },
    gold: { bg: 'bg-accent-gold/10', border: 'border-accent-gold/20', text: 'text-accent-gold', glow: 'bg-accent-gold/10' },
    violet: { bg: 'bg-accent-violet/10', border: 'border-accent-violet/20', text: 'text-accent-violet', glow: 'bg-accent-violet/10' },
    rose: { bg: 'bg-accent-rose/10', border: 'border-accent-rose/20', text: 'text-accent-rose', glow: 'bg-accent-rose/10' }
  };

  const features = [
    {
      icon: Zap,
      title: 'تنفيذ فائق السرعة',
      desc: 'محرك مطابقة بأقل من 10 مللي ثانية لكل صفقة، مع ضمان تنفيذ فوري حتى في أوقات الذروة',
      color: 'mint',
      stat: '< 10ms',
      statLabel: 'زمن التنفيذ'
    },
    {
      icon: ShieldCheck,
      title: 'أمان بمستوى البنوك',
      desc: 'تشفير كامل + مصادقة ثنائية + تخزين بارد للأصول الرقمية في خزائن متعددة التوقيع',
      color: 'azure',
      stat: '256-bit',
      statLabel: 'تشفير AES'
    },
    {
      icon: BarChart3,
      title: 'مخططات احترافية',
      desc: 'مؤشرات فنية متقدمة + رسم على الشارت + تصدير + أوامر معقدة (Stop-Limit, OCO)',
      color: 'gold',
      stat: '+50',
      statLabel: 'مؤشر فني'
    },
    {
      icon: Wallet,
      title: 'محفظة متكاملة',
      desc: 'إيداع وسحب فوري + تتبع المعاملات + تقرير شامل بالجنيه المصري والدولار',
      color: 'violet',
      stat: 'فوري',
      statLabel: 'معالجة الإيداع'
    }
  ];

  const stats = [
    { value: '+2M', label: 'متداول نشط', icon: Crown },
    { value: '$50B', label: 'حجم تداول يومي', icon: TrendingUp },
    { value: '+200', label: 'عملة رقمية', icon: Server },
    { value: '99.99%', label: 'وقت تشغيل', icon: Activity }
  ];

  const footerLinks = [
    { title: 'المنصة', links: ['التداول', 'الأسواق', 'الرسوم', 'API'] },
    { title: 'الشركة', links: ['من نحن', 'الوظائف', 'المدونة', 'تواصل معنا'] },
    { title: 'قانوني', links: ['الشروط', 'الخصوصية', 'AML/KYC', 'الأمان'] }
  ];
</script>

<ParticleBackground />

<svelte:head><title>NEXUS Exchange — منصة تداول العملات الرقمية</title></svelte:head>

<!-- Top fixed gradient strip -->
<div class="fixed top-0 inset-x-0 h-px pointer-events-none z-50" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.5), rgba(168, 85, 247, 0.4), transparent);"></div>

<!-- Hero -->
<section class="relative min-h-screen flex items-center justify-center px-4 py-20">
  <div class="absolute inset-0 grid-bg opacity-30"></div>
  <!-- Aurora wash -->
  <div class="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-32 left-1/4 w-[60rem] h-[40rem] rounded-full bg-accent-violet/10 blur-[120px] animate-float"></div>
    <div class="absolute top-1/2 right-1/4 w-[50rem] h-[40rem] rounded-full bg-accent-gold/8 blur-[120px] animate-float" style="animation-delay: 1.5s;"></div>
    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-[30rem] rounded-full bg-accent-mint/5 blur-[120px] animate-float" style="animation-delay: 3s;"></div>
  </div>

  <div class="relative z-10 max-w-5xl mx-auto text-center">
    <!-- Badge -->
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-accent-gold/15 to-accent-violet/10 border border-accent-gold/25 text-accent-gold text-xs font-semibold mb-8 animate-float tracking-wide">
      <span class="relative flex h-1.5 w-1.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
      </span>
      منصة التداول رقم 1 في الشرق الأوسط
    </div>

    <!-- Title -->
    <h1 class="text-5xl sm:text-7xl font-bold leading-[1.05] text-balance mb-6 tracking-tight">
      تداول بثقة على
      <span class="text-aurora block mt-2" style="text-shadow: 0 0 40px rgba(245, 181, 68, 0.25);">منصة الجيل القادم</span>
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

    <!-- Live mini-charts row -->
    <div class="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-12">
      <div class="panel p-4 hover:border-accent-gold/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.5), transparent);"></div>
        <div class="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-accent-gold/10 blur-2xl group-hover:bg-accent-gold/20 transition-all"></div>
        <div class="relative">
          <LiveMiniChart symbol="BTCUSDT" height={70} />
        </div>
      </div>
      <div class="panel p-4 hover:border-accent-violet/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5), transparent);"></div>
        <div class="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-accent-violet/10 blur-2xl group-hover:bg-accent-violet/20 transition-all"></div>
        <div class="relative">
          <LiveMiniChart symbol="ETHUSDT" height={70} />
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
      {#each stats as stat, i}
        <div class="panel p-4 relative overflow-hidden group" style="animation: float 6s ease-in-out infinite; animation-delay: {i * 0.5}s;">
          <div class="absolute -top-6 -right-6 w-16 h-16 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
          <div class="relative">
            <stat.icon size={14} class="text-accent-gold mx-auto mb-1.5" />
            <div class="text-2xl sm:text-3xl font-bold text-gold-gradient tabular-nums">{stat.value}</div>
            <div class="text-[10px] sm:text-xs text-slate-400 mt-0.5">{stat.label}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Live Markets Preview -->
<section class="relative px-4 py-20 max-w-6xl mx-auto">
  <!-- Section topbar gradient -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.4), transparent);"></div>

  <div class="flex items-end justify-between mb-8 flex-wrap gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-mint/10 border border-accent-mint/20 text-accent-mint text-xs font-medium mb-3">
        <span class="relative flex h-1.5 w-1.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
          <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
        </span>
        بيانات مباشرة من Binance
      </div>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">الأسعار اللحظية</h2>
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
        <!-- Topbar gradient -->
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
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
      <span class="relative flex h-1.5 w-1.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
      </span>
      التحديث مباشر
    </span>
    <span class="text-slate-700">•</span>
    <span>سعر الصرف الحالي: <span class="text-accent-gold font-mono font-bold">1 USD = {currentRate.toFixed(2)} EGP</span></span>
    <span class="text-slate-700">•</span>
    <span>جميع القيم بالجنيه المصري (ج.م)</span>
  </div>
</section>

<!-- Features -->
<section class="relative px-4 py-20 max-w-6xl mx-auto">
  <!-- Section topbar gradient -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.4), transparent);"></div>

  <div class="text-center mb-12">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/20 text-accent-violet text-xs font-medium mb-3">
      <Sparkles size={11} />
      لماذا تختارنا
    </div>
    <h2 class="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">لماذا NEXUS؟</h2>
    <p class="text-slate-400">مزايا احترافية تجعلنا الخيار الأول للمتداولين</p>
  </div>

  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {#each features as feat, i}
      {@const c = colorClasses[feat.color]}
      <div class="panel p-6 hover:border-white/15 transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {feat.color === 'mint' ? 'rgba(34, 211, 164, 0.5)' : feat.color === 'azure' ? 'rgba(59, 130, 246, 0.5)' : feat.color === 'gold' ? 'rgba(245, 181, 68, 0.5)' : 'rgba(168, 85, 247, 0.5)'}, transparent);"></div>
        <div class="absolute -top-12 -right-12 w-32 h-32 rounded-full {c.glow} blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
        <div class="relative">
          <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 rounded-xl {c.bg} {c.border} border flex items-center justify-center group-hover:scale-110 transition-transform">
              <feat.icon size={22} class={c.text} />
            </div>
            <div class="text-left">
              <p class="text-sm font-bold text-white tabular-nums">{feat.stat}</p>
              <p class="text-[9px] text-slate-500 uppercase tracking-wider">{feat.statLabel}</p>
            </div>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">{feat.title}</h3>
          <p class="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- CTA -->
<section class="relative px-4 py-20">
  <div class="max-w-3xl mx-auto panel-glow p-10 sm:p-14 text-center relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.6), transparent);"></div>
    <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-accent-gold/15 blur-3xl pointer-events-none animate-pulse-glow"></div>
    <div class="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-accent-violet/15 blur-3xl pointer-events-none animate-pulse-glow" style="animation-delay: 2s;"></div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/20 border border-accent-gold/30 mb-4">
        <Globe size={32} class="text-accent-gold" />
      </div>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
        جاهز لبدء رحلتك؟
      </h2>
      <p class="text-slate-400 mb-8 max-w-xl mx-auto">
        أنشئ حسابك خلال دقيقة واحدة وابدأ التداول بأقل من 5 دولارات
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button href="/register" size="lg" class="px-8">
          أنشئ حسابك المجاني
          <ArrowLeft size={20} />
        </Button>
        <a href="/login" class="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1">
          لدي حساب بالفعل <ChevronLeft size={14} />
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="relative px-4 py-12 border-t border-white/5">
  <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);"></div>
  <div class="max-w-6xl mx-auto">
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
      <!-- Brand -->
      <div class="lg:col-span-1">
        <a href="/" class="flex items-center gap-2.5 mb-4">
          <div class="relative w-9 h-9 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950">
            <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
            <span class="relative text-sm">N</span>
          </div>
          <span class="text-lg font-bold text-white tracking-tight">NEXUS</span>
        </a>
        <p class="text-xs text-slate-400 leading-relaxed mb-4">
          منصة تداول العملات الرقمية الأكثر احترافية في الشرق الأوسط.
        </p>
        <div class="flex items-center gap-2">
          <a href="#" class="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-400 hover:text-accent-gold hover:border-accent-gold/20 transition-colors" aria-label="Email">
            <AtSign size={14} />
          </a>
          <a href="#" class="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-400 hover:text-accent-gold hover:border-accent-gold/20 transition-colors" aria-label="Telegram">
            <Send size={14} />
          </a>
          <a href="#" class="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-400 hover:text-accent-gold hover:border-accent-gold/20 transition-colors" aria-label="Website">
            <Link2 size={14} />
          </a>
        </div>
      </div>

      <!-- Links -->
      {#each footerLinks as col}
        <div>
          <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">{col.title}</p>
          <ul class="space-y-2">
            {#each col.links as link}
              <li>
                <a href="#" class="text-xs text-slate-400 hover:text-accent-gold transition-colors flex items-center gap-1 group">
                  <ChevronLeft size={10} class="text-slate-700 group-hover:text-accent-gold transition-colors" />
                  {link}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    <div class="pt-6 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
      <p class="text-xs text-slate-500">© 2026 NEXUS Exchange. جميع الحقوق محفوظة.</p>
      <div class="flex items-center gap-4 text-[10px] text-slate-500">
        <span class="flex items-center gap-1.5">
          <Lock size={10} class="text-accent-mint" />
          SSL مشفّر
        </span>
        <span class="flex items-center gap-1.5">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
          </span>
          جميع الأنظمة تعمل
        </span>
      </div>
    </div>
  </div>
</footer>
