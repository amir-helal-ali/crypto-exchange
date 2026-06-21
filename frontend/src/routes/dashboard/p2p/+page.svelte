<script lang="ts">
  /**
   * P2P Trading Marketplace — Buy/Sell crypto directly with other users via EGP
   * bank transfers. Binance-style P2P with verified merchants, escrow protection,
   * multiple payment methods, and live ad listings.
   */
  import { onMount } from 'svelte';
  import {
    Shield, Star, Clock, Search, Filter, ChevronDown, ChevronUp,
    TrendingUp, TrendingDown, Check, Users, Lock, MessageCircle,
    Banknote, CreditCard, Wallet, ArrowRightLeft, Plus, AlertCircle,
    Zap, Award, Eye, RefreshCw
  } from 'lucide-svelte';
  import { usdToEgp, egpCompact, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { formatPrice, formatCompact } from '$lib/utils/format';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { toasts } from '$lib/stores/toast';

  type Side = 'BUY' | 'SELL';
  type AdStatus = 'online' | 'offline';

  type P2PAd = {
    id: string;
    side: Side;
    asset: string;
    fiat: 'EGP';
    price: number; // EGP per unit
    limitMin: number; // EGP
    limitMax: number; // EGP
    available: number; // asset amount
    merchant: {
      name: string;
      verified: boolean;
      rating: number;
      trades: number;
      completion: number;
      online: boolean;
      lastSeen: number;
      responseMin: number;
    };
    paymentMethods: string[];
    status: AdStatus;
    createdAt: number;
  };

  let activeSide = $state<Side>('BUY');
  let activeAsset = $state('USDT');
  let searchQuery = $state('');
  let selectedPayment = $state<string>('all');
  let sortBy = $state<'price-asc' | 'price-desc' | 'rating' | 'trades' | 'recent'>('price-asc');
  let onlyVerified = $state(false);
  let onlyOnline = $state(true);
  let currentRate = $state(48.5);

  // Mock merchants + ads
  const mockMerchants = [
    { name: 'Ahmed_Crypto_EG', verified: true, rating: 99.8, trades: 3420, completion: 100, online: true, lastSeen: Date.now(), responseMin: 2 },
    { name: 'CairoPay_EG', verified: true, rating: 99.5, trades: 8950, completion: 99.9, online: true, lastSeen: Date.now(), responseMin: 1 },
    { name: 'Mahmoud_P2P', verified: true, rating: 98.2, trades: 1240, completion: 99.5, online: true, lastSeen: Date.now(), responseMin: 5 },
    { name: 'AlexExchange', verified: false, rating: 96.4, trades: 320, completion: 98, online: false, lastSeen: Date.now() - 3600000, responseMin: 15 },
    { name: 'NileCrypto', verified: true, rating: 99.9, trades: 12000, completion: 100, online: true, lastSeen: Date.now(), responseMin: 1 },
    { name: 'Pyramid_FX', verified: true, rating: 97.8, trades: 890, completion: 99.2, online: true, lastSeen: Date.now(), responseMin: 3 },
    { name: 'SphinxPay', verified: false, rating: 94.2, trades: 156, completion: 97, online: false, lastSeen: Date.now() - 7200000, responseMin: 30 },
    { name: 'Pharaohs_trade', verified: true, rating: 98.9, trades: 2100, completion: 99.8, online: true, lastSeen: Date.now(), responseMin: 2 }
  ];

  const paymentMethodsList = [
    { id: 'bank_transfer', label: 'تحويل بنكي', icon: Banknote },
    { id: 'fawry', label: 'فوري', icon: CreditCard },
    { id: 'vodafone_cash', label: 'فودافون كاش', icon: Wallet },
    { id: 'etisalat_cash', label: 'اتصالات كاش', icon: Wallet },
    { id: 'orange_cash', label: 'أورانج كاش', icon: Wallet },
    { id: 'instapay', label: 'انستاباي', icon: ArrowRightLeft },
    { id: 'meeza', label: 'ميزة', icon: CreditCard }
  ];

  // Generate ads based on current BTC price
  let ads = $state<P2PAd[]>([]);

  function generateAds() {
    const assets = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC'];
    const newAds: P2PAd[] = [];
    mockMerchants.forEach((m, mi) => {
      assets.forEach((asset, ai) => {
        // Base price in EGP
        let baseUsdPrice = 1;
        if (asset === 'BTC') baseUsdPrice = 67000 + Math.random() * 2000;
        else if (asset === 'ETH') baseUsdPrice = 3500 + Math.random() * 100;
        else if (asset === 'BNB') baseUsdPrice = 600 + Math.random() * 20;
        else baseUsdPrice = 1;

        // Merchant margin: BUY ads have higher price (they sell), SELL ads lower (they buy)
        const marginBuy = 0.005 + Math.random() * 0.02; // 0.5% - 2.5% premium
        const marginSell = -0.005 - Math.random() * 0.015;

        const egpRate = currentRate;
        const buyPrice = baseUsdPrice * egpRate * (1 + marginBuy);
        const sellPrice = baseUsdPrice * egpRate * (1 + marginSell);

        const maxAmount = asset === 'USDT' ? 50000 : asset === 'BTC' ? 500000 : 100000;

        // Skip some random combinations to vary listings
        if (Math.random() < 0.6) return;

        newAds.push({
          id: `${m.name}-${asset}-BUY-${mi}-${ai}`,
          side: 'BUY',
          asset,
          fiat: 'EGP',
          price: buyPrice,
          limitMin: 500 + Math.floor(Math.random() * 1500),
          limitMax: 5000 + Math.floor(Math.random() * maxAmount),
          available: asset === 'USDT' ? 1000 + Math.random() * 5000 : 0.5 + Math.random() * 5,
          merchant: m,
          paymentMethods: paymentMethodsList
            .filter(() => Math.random() > 0.6)
            .slice(0, 4)
            .map((p) => p.id),
          status: m.online ? 'online' : 'offline',
          createdAt: Date.now() - Math.random() * 86400000
        });

        newAds.push({
          id: `${m.name}-${asset}-SELL-${mi}-${ai}`,
          side: 'SELL',
          asset,
          fiat: 'EGP',
          price: sellPrice,
          limitMin: 500 + Math.floor(Math.random() * 1500),
          limitMax: 5000 + Math.floor(Math.random() * maxAmount),
          available: asset === 'USDT' ? 500 + Math.random() * 3000 : 0.2 + Math.random() * 3,
          merchant: m,
          paymentMethods: paymentMethodsList
            .filter(() => Math.random() > 0.6)
            .slice(0, 4)
            .map((p) => p.id),
          status: m.online ? 'online' : 'offline',
          createdAt: Date.now() - Math.random() * 86400000
        });
      });
    });
    ads = newAds;
  }

  onMount(() => {
    generateAds();
    const unsubRate = usdEgpRate.subscribe((r) => {
      currentRate = r;
    });
    return unsubRate;
  });

  function refresh() {
    generateAds();
    toasts.info('تم تحديث الإعلانات');
  }

  // Filtered ads
  const filteredAds = $derived.by(() => {
    let arr = ads.filter((a) => a.side === activeSide && a.asset === activeAsset);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      arr = arr.filter((a) => a.merchant.name.toLowerCase().includes(q));
    }
    if (selectedPayment !== 'all') {
      arr = arr.filter((a) => a.paymentMethods.includes(selectedPayment));
    }
    if (onlyVerified) arr = arr.filter((a) => a.merchant.verified);
    if (onlyOnline) arr = arr.filter((a) => a.status === 'online');

    switch (sortBy) {
      case 'price-asc': arr.sort((a, b) => (activeSide === 'BUY' ? a.price - b.price : b.price - a.price)); break;
      case 'price-desc': arr.sort((a, b) => (activeSide === 'BUY' ? b.price - a.price : a.price - b.price)); break;
      case 'rating': arr.sort((a, b) => b.merchant.rating - a.merchant.rating); break;
      case 'trades': arr.sort((a, b) => b.merchant.trades - a.merchant.trades); break;
      case 'recent': arr.sort((a, b) => b.createdAt - a.createdAt); break;
    }
    return arr;
  });

  // Aggregate stats
  const stats = $derived.by(() => {
    const onlineMerchants = new Set(ads.filter((a) => a.status === 'online').map((a) => a.merchant.name)).size;
    const totalMerchants = new Set(ads.map((a) => a.merchant.name)).size;
    const totalTrades = ads.reduce((s, a) => s + a.merchant.trades, 0) / 2;
    const avgCompletion = ads.length > 0 ? ads.reduce((s, a) => s + a.merchant.completion, 0) / ads.length : 0;
    return { onlineMerchants, totalMerchants, totalTrades, avgCompletion };
  });

  // Best price (cheapest for BUY, highest for SELL)
  const bestPrice = $derived.by(() => {
    if (filteredAds.length === 0) return 0;
    return activeSide === 'BUY'
      ? Math.min(...filteredAds.map((a) => a.price))
      : Math.max(...filteredAds.map((a) => a.price));
  });

  // Modal: trade flow
  let tradeModalOpen = $state(false);
  let selectedAd = $state<P2PAd | null>(null);
  let tradeAmount = $state(0);
  let tradeCurrency = $state<'fiat' | 'asset'>('fiat');

  function openTrade(ad: P2PAd) {
    selectedAd = ad;
    tradeAmount = ad.limitMin;
    tradeCurrency = 'fiat';
    tradeModalOpen = true;
  }

  // Computed trade values
  const tradeAssetAmount = $derived(
    tradeCurrency === 'fiat' ? tradeAmount / (selectedAd?.price || 1) : tradeAmount
  );
  const tradeFiatAmount = $derived(
    tradeCurrency === 'fiat' ? tradeAmount : tradeAmount * (selectedAd?.price || 1)
  );

  function startTrade() {
    if (!selectedAd) return;
    if (tradeFiatAmount < (selectedAd.limitMin || 0)) {
      toasts.error(`الحد الأدنى للطلب: ${formatEGP(selectedAd.limitMin)}`);
      return;
    }
    if (tradeFiatAmount > (selectedAd.limitMax || 0)) {
      toasts.error(`الحد الأقصى للطلب: ${formatEGP(selectedAd.limitMax)}`);
      return;
    }
    toasts.success('تم إنشاء طلب P2P بنجاح! سيتم قفل العملات في Escrow حتى تأكيد الدفع');
    tradeModalOpen = false;
  }

  const assets = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC'];

  function timeAgoCustom(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ساعة`;
    return `${Math.floor(h / 24)} يوم`;
  }
</script>

<svelte:head><title>P2P Trading — NEXUS</title></svelte:head>

<div class="space-y-4 pb-20 lg:pb-0">
  <!-- Hero header -->
  <div class="panel p-4 bg-gradient-to-l from-accent-gold/10 via-transparent to-transparent">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-accent-gold/15 flex items-center justify-center">
          <Users size={24} class="text-accent-gold" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">سوق P2P</h1>
          <p class="text-xs text-slate-400 mt-0.5">تداول مباشر بالجنيه المصري عبر التحويل البنكي والمحافظ الإلكترونية</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="px-3 py-1.5 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-full bg-accent-mint animate-pulse"></div>
          <span class="text-accent-mint font-bold">{stats.onlineMerchants}</span>
          <span class="text-slate-400">تاجر نشط</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <span class="text-slate-400">إجمالي الصفقات:</span>
          <span class="text-white font-bold mr-1">{formatCompact(stats.totalTrades)}</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <span class="text-slate-400">نسبة الإكمال:</span>
          <span class="text-accent-mint font-bold mr-1">{stats.avgCompletion.toFixed(1)}%</span>
        </div>
      </div>
    </div>

    <!-- Buy/Sell toggle -->
    <div class="mt-4 flex items-center gap-2">
      <button
        onclick={() => (activeSide = 'BUY')}
        class="flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all {activeSide === 'BUY' ? 'bg-accent-mint text-ink-950 shadow-lg shadow-accent-mint/30' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
      >
        شراء {activeAsset}
      </button>
      <button
        onclick={() => (activeSide = 'SELL')}
        class="flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all {activeSide === 'SELL' ? 'bg-accent-rose text-white shadow-lg shadow-accent-rose/30' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
      >
        بيع {activeAsset}
      </button>
      <div class="hidden sm:flex items-center gap-1 mr-2 text-xs">
        <span class="text-slate-500">الأصل:</span>
        {#each assets as a}
          <button
            onclick={() => (activeAsset = a)}
            class="px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors {activeAsset === a ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400 hover:bg-white/5'}"
          >{a}</button>
        {/each}
      </div>
      <button onclick={refresh} class="ml-auto p-2 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="تحديث">
        <RefreshCw size={14} />
      </button>
    </div>

    <!-- Mobile asset picker -->
    <div class="sm:hidden mt-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
      {#each assets as a}
        <button
          onclick={() => (activeAsset = a)}
          class="px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap {activeAsset === a ? 'bg-accent-gold/15 text-accent-gold' : 'bg-white/[0.03] text-slate-400'}"
        >{a}</button>
      {/each}
    </div>
  </div>

  <!-- Filters bar -->
  <div class="panel p-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative">
        <Search size={14} class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="بحث عن تاجر..."
          bind:value={searchQuery}
          class="w-44 bg-white/[0.03] border border-white/5 rounded-md pr-7 pl-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/40"
        />
      </div>

      <div class="flex items-center gap-1 text-xs">
        <Filter size={12} class="text-slate-500 ml-1" />
        <select bind:value={selectedPayment} class="bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none">
          <option value="all">كل طرق الدفع</option>
          {#each paymentMethodsList as p}
            <option value={p.id}>{p.label}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-center gap-1 text-xs">
        <span class="text-slate-500 text-[11px]">ترتيب:</span>
        <select bind:value={sortBy} class="bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none">
          <option value="price-asc">السعر (الأفضل أولاً)</option>
          <option value="price-desc">السعر (تنازلي)</option>
          <option value="rating">الأعلى تقييماً</option>
          <option value="trades">الأكثر صفقات</option>
          <option value="recent">الأحدث</option>
        </select>
      </div>

      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" bind:checked={onlyVerified} class="accent-accent-gold" />
        <Shield size={12} class="text-accent-gold" /> موثق فقط
      </label>
      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" bind:checked={onlyOnline} class="accent-accent-gold" />
        <div class="w-2 h-2 rounded-full bg-accent-mint"></div> متصل فقط
      </label>
    </div>
  </div>

  <!-- Ads table -->
  <div class="panel overflow-hidden">
    <div class="overflow-x-auto">
      {#if filteredAds.length === 0}
        <div class="py-12 text-center">
          <AlertCircle size={32} class="mx-auto text-slate-600 mb-2" />
          <p class="text-slate-500 text-sm">لا توجد إعلانات مطابقة لمعايير البحث</p>
        </div>
      {:else}
        <table class="w-full text-xs">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.02]">
              <th class="text-right font-medium px-4 py-3">التاجر</th>
              <th class="text-right font-medium px-4 py-3">السعر (ج.م)</th>
              <th class="text-right font-medium px-4 py-3">الحد/المتاح</th>
              <th class="text-right font-medium px-4 py-3">طرق الدفع</th>
              <th class="text-right font-medium px-4 py-3">التقييم</th>
              <th class="text-left font-medium px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAds as ad (ad.id)}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <!-- Merchant -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-gold/10 flex items-center justify-center text-accent-gold text-xs font-bold">
                      {ad.merchant.name.charAt(0)}
                    </div>
                    <div>
                      <div class="flex items-center gap-1">
                        <span class="font-bold text-white text-sm">{ad.merchant.name}</span>
                        {#if ad.merchant.verified}
                          <span class="text-accent-gold" title="موثق"><Check size={12} /></span>
                        {/if}
                      </div>
                      <div class="text-[10px] text-slate-500 flex items-center gap-1">
                        {#if ad.merchant.online}
                          <span class="w-1.5 h-1.5 rounded-full bg-accent-mint"></span>
                          <span class="text-accent-mint">متصل</span>
                        {:else}
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          <span>آخر ظهور: {timeAgoCustom(ad.merchant.lastSeen)}</span>
                        {/if}
                        <span class="text-slate-600">·</span>
                        <Clock size={9} class="text-slate-600" />
                        <span>{ad.merchant.responseMin} د</span>
                      </div>
                    </div>
                  </div>
                </td>
                <!-- Price -->
                <td class="px-4 py-3">
                  <div class="font-mono font-bold text-white tabular-nums text-sm">{formatEGP(ad.price)}</div>
                  {#if ad.price === bestPrice}
                    <span class="pill pill-mint text-[9px] mt-0.5 inline-block">أفضل سعر</span>
                  {/if}
                </td>
                <!-- Limits -->
                <td class="px-4 py-3">
                  <div class="text-slate-300 font-mono tabular-nums">{formatEGP(ad.limitMin)} - {formatEGP(ad.limitMax)}</div>
                  <div class="text-[10px] text-slate-500 mt-0.5">متاح: {formatPrice(ad.available, 4)} {ad.asset}</div>
                </td>
                <!-- Payment methods -->
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1 max-w-[200px]">
                    {#each ad.paymentMethods.slice(0, 3) as pm}
                      <span class="pill bg-white/[0.05] text-slate-300 text-[10px] py-0.5 px-1.5">
                        {paymentMethodsList.find((p) => p.id === pm)?.label || pm}
                      </span>
                    {/each}
                    {#if ad.paymentMethods.length > 3}
                      <span class="pill bg-white/[0.05] text-slate-500 text-[10px] py-0.5 px-1.5">+{ad.paymentMethods.length - 3}</span>
                    {/if}
                  </div>
                </td>
                <!-- Rating -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    <Star size={11} class="text-accent-gold fill-accent-gold" />
                    <span class="font-bold text-accent-gold tabular-nums">{ad.merchant.rating}%</span>
                  </div>
                  <div class="text-[10px] text-slate-500 mt-0.5 tabular-nums">{formatCompact(ad.merchant.trades)} صفقة</div>
                </td>
                <!-- Action -->
                <td class="px-4 py-3 text-left">
                  <button
                    onclick={() => openTrade(ad)}
                    class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors {ad.side === 'BUY' ? 'bg-accent-mint text-ink-950 hover:bg-accent-mint/90' : 'bg-accent-rose text-white hover:bg-accent-rose/90'}"
                  >
                    {ad.side === 'BUY' ? 'شراء' : 'بيع'} {ad.asset}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>

  <!-- Safety info -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div class="panel p-4">
      <div class="w-9 h-9 rounded-lg bg-accent-mint/15 flex items-center justify-center mb-2">
        <Lock size={16} class="text-accent-mint" />
      </div>
      <h4 class="text-sm font-bold text-white mb-1">حماية Escrow</h4>
      <p class="text-[11px] text-slate-400 leading-relaxed">
        يتم قفل العملات الرقمية في حساب ضمان حتى يؤكد التاجر استلام الدفع، ثم تُرسل فوراً لمحفظتك.
      </p>
    </div>
    <div class="panel p-4">
      <div class="w-9 h-9 rounded-lg bg-accent-gold/15 flex items-center justify-center mb-2">
        <Shield size={16} class="text-accent-gold" />
      </div>
      <h4 class="text-sm font-bold text-white mb-1">تجار موثقون</h4>
      <p class="text-[11px] text-slate-400 leading-relaxed">
        كل التاجر الموثقين خضعوا لعملية تحقق KYC كاملة ولديهم سجل تداول موثوق بنسبة إكمال تتجاوز 98%.
      </p>
    </div>
    <div class="panel p-4">
      <div class="w-9 h-9 rounded-lg bg-accent-rose/15 flex items-center justify-center mb-2">
        <MessageCircle size={16} class="text-accent-rose" />
      </div>
      <h4 class="text-sm font-bold text-white mb-1">دعم 24/7</h4>
      <p class="text-[11px] text-slate-400 leading-relaxed">
        فريق وساطة متاح على مدار الساعة لحل أي نزاع بين الأطراف خلال 24 ساعة كحد أقصى.
      </p>
    </div>
  </div>

  <!-- Become merchant CTA -->
  <div class="panel p-4 bg-gradient-to-l from-accent-gold/10 via-transparent to-transparent border-accent-gold/30">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <Award size={24} class="text-accent-gold" />
        <div>
          <h3 class="text-sm font-bold text-white">هل أنت تاجر محترف؟</h3>
          <p class="text-[11px] text-slate-400 mt-0.5">انضم لبرنامج التجار الموثقين واحصل على شارة ✓ + أولوية في الظهور + عمولات مخفضة</p>
        </div>
      </div>
      <button class="px-4 py-2 text-xs font-bold bg-accent-gold text-ink-950 rounded-md hover:bg-accent-gold/90 transition-colors flex items-center gap-1">
        <Plus size={12} /> تقدم كتاجر
      </button>
    </div>
  </div>
</div>

<!-- Trade modal -->
{#if tradeModalOpen && selectedAd}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
    <div class="w-full max-w-md bg-ink-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5 {selectedAd.side === 'BUY' ? 'bg-accent-mint/10' : 'bg-accent-rose/10'}">
        <div class="flex items-center gap-2">
          <Lock size={14} class={selectedAd.side === 'BUY' ? 'text-accent-mint' : 'text-accent-rose'} />
          <h3 class="text-sm font-bold text-white">
            {selectedAd.side === 'BUY' ? 'شراء' : 'بيع'} {selectedAd.asset} من {selectedAd.merchant.name}
          </h3>
        </div>
        <button onclick={() => (tradeModalOpen = false)} class="text-slate-400 hover:text-white">✕</button>
      </div>

      <div class="p-4 space-y-3">
        <!-- Price + limits -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-white/[0.03] rounded-md p-2">
            <div class="text-[10px] text-slate-500">السعر</div>
            <div class="font-mono font-bold text-white tabular-nums">{formatEGP(selectedAd.price)} ج.م</div>
          </div>
          <div class="bg-white/[0.03] rounded-md p-2">
            <div class="text-[10px] text-slate-500">الحدود</div>
            <div class="font-mono text-slate-300 tabular-nums text-[11px]">{formatEGP(selectedAd.limitMin)} - {formatEGP(selectedAd.limitMax)}</div>
          </div>
        </div>

        <!-- Amount input with toggle -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] text-slate-400">المبلغ</label>
            <div class="flex items-center gap-0.5 bg-white/[0.03] rounded p-0.5">
              <button
                onclick={() => (tradeCurrency = 'fiat')}
                class="px-2 py-0.5 text-[10px] rounded {tradeCurrency === 'fiat' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400'}"
              >ج.م</button>
              <button
                onclick={() => (tradeCurrency = 'asset')}
                class="px-2 py-0.5 text-[10px] rounded {tradeCurrency === 'asset' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400'}"
              >{selectedAd.asset}</button>
            </div>
          </div>
          <input
            type="number"
            bind:value={tradeAmount}
            placeholder={tradeCurrency === 'fiat' ? 'أدخل المبلغ بالجنيه' : `أدخل كمية ${selectedAd.asset}`}
            class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent-gold/40"
          />
          <div class="flex items-center justify-between mt-1 text-[10px] text-slate-500">
            <span>≈ {formatPrice(tradeAssetAmount, 6)} {selectedAd.asset}</span>
            <span>≈ {formatEGP(tradeFiatAmount)} ج.م</span>
          </div>
        </div>

        <!-- Quick amounts -->
        <div class="grid grid-cols-4 gap-1">
          {#each [0.25, 0.5, 0.75, 1] as pct}
            <button
              onclick={() => {
                const target = selectedAd.limitMin + (selectedAd.limitMax - selectedAd.limitMin) * pct;
                tradeCurrency = 'fiat';
                tradeAmount = Math.floor(target);
              }}
              class="py-1 text-[10px] rounded bg-white/[0.03] text-slate-300 hover:bg-white/10"
            >{pct * 100}%</button>
          {/each}
        </div>

        <!-- Payment method selection -->
        <div>
          <label class="text-[11px] text-slate-400 block mb-1.5">طريقة الدفع</label>
          <div class="grid grid-cols-2 gap-1.5">
            {#each selectedAd.paymentMethods as pm}
              {@const PMComp = paymentMethodsList.find((p) => p.id === pm)?.icon || Banknote}
              {@const pmLabel = paymentMethodsList.find((p) => p.id === pm)?.label || pm}
              <button class="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/[0.03] hover:bg-white/10 text-xs text-slate-200 border border-white/5">
                <svelte:component this={PMComp} size={12} class="text-accent-gold" />
                <span>{pmLabel}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Summary -->
        <div class="bg-white/[0.02] rounded-md p-3 space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-slate-400">ستستلم</span>
            <span class="font-bold text-accent-mint tabular-nums">{formatPrice(tradeAssetAmount, 6)} {selectedAd.asset}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">عمولة المنصة</span>
            <span class="text-accent-mint font-bold">مجانية (للمشتري)</span>
          </div>
          <div class="flex items-center justify-between pt-1.5 border-t border-white/5">
            <span class="text-slate-400">إجمالي الدفع</span>
            <span class="font-bold text-white font-mono tabular-nums">{formatEGP(tradeFiatAmount)} ج.م</span>
          </div>
        </div>

        <!-- Warning -->
        <div class="bg-amber-500/5 border border-amber-500/20 rounded-md p-2 flex items-start gap-1.5">
          <AlertCircle size={12} class="text-amber-500 flex-shrink-0 mt-0.5" />
          <p class="text-[10px] text-amber-200/80 leading-relaxed">
            لا تقم بأي تحويل خارج منصة NEXUS. كل التواصل يجب أن يكون عبر دردشة المنصة. التحويل الخارجي = خسارة مضمونة.
          </p>
        </div>

        <button
          onclick={startTrade}
          class="w-full py-2.5 text-sm font-bold rounded-md transition-colors {selectedAd.side === 'BUY' ? 'bg-accent-mint text-ink-950 hover:bg-accent-mint/90' : 'bg-accent-rose text-white hover:bg-accent-rose/90'}"
        >
          تأكيد الطلب — {selectedAd.side === 'BUY' ? 'شراء' : 'بيع'} {selectedAd.asset}
        </button>
      </div>
    </div>
  </div>
{/if}
