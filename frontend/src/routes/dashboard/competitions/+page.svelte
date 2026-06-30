<script lang="ts">
  /**
   * NEXUS Trading Competitions — bounty/leaderboard page.
   * Active, upcoming, and past competitions with prize pools,
   * user rank, top traders, countdowns.
   */
  import { onMount } from 'svelte';
  import { formatPrice, formatCompact } from '$lib/utils/format';
  import { usdToEgp, formatEGP, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import {
    Trophy, Users, Clock, Crown, Medal, Zap, Calendar,
    CheckCircle2, Sparkles, TrendingUp, Activity, Gift, Flame, Star
  } from 'lucide-svelte';
  import NavTabs from '$lib/components/NavTabs.svelte';

  let activeTab = $state<'active' | 'upcoming' | 'ended'>('active');
  let currentRate = $state(48.5);
  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  onMount(() => unsubRate());

  interface Competition {
    id: number;
    title: string;
    type: 'spot' | 'futures' | 'trading_volume' | 'pnl';
    pair: string;
    prizePool: number;
    participants: number;
    startDate: string;
    endDate: string;
    status: 'active' | 'upcoming' | 'ended';
    myRank?: number;
    myVolume?: number;
    myPnl?: number;
    description: string;
    rules: string[];
    topTraders: { rank: number; user: string; volume: number; pnl: number; prize: number }[];
  }

  const competitions: Competition[] = [
    {
      id: 1,
      title: 'بطولة BTC الكبرى',
      type: 'trading_volume',
      pair: 'BTCUSDT',
      prizePool: 50000,
      participants: 1842,
      startDate: new Date(Date.now() - 86400000 * 3).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 4).toISOString(),
      status: 'active',
      myRank: 47,
      myVolume: 125000,
      myPnl: 3250,
      description: 'تداول بأعلى حجم على زوج BTC/USDT خلال 7 أيام. الفائزون يتقاسمون جائزة 50,000 USDT.',
      rules: [
        'الحساب مفعّل عليه KYC مستوى 2',
        'الحد الأدنى لحجم التداول اليومي 1,000 USDT',
        'لا يوجد حد أقصى لعدد الصفقات',
        'يُحتسب فقط تداولات BTC/USDT'
      ],
      topTraders: [
        { rank: 1, user: 'CryptoPharaoh', volume: 8250000, pnl: 142500, prize: 15000 },
        { rank: 2, user: 'NileTrader', volume: 6920000, pnl: 98200, prize: 8000 },
        { rank: 3, user: 'DesertFox', volume: 5410000, pnl: 75400, prize: 5000 },
        { rank: 4, user: 'SphinxPro', volume: 4320000, pnl: 62100, prize: 3000 },
        { rank: 5, user: 'PyramidFX', volume: 3950000, pnl: 54800, prize: 2000 }
      ]
    },
    {
      id: 2,
      title: 'تحدي العقود الذهبية',
      type: 'pnl',
      pair: 'ETHUSDT',
      prizePool: 25000,
      participants: 956,
      startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'active',
      myRank: 12,
      myVolume: 89000,
      myPnl: 5420,
      description: 'أعلى ربح صافي على عقود ETH خلال أسبوع. جائزة كبرى 10,000 USDT.',
      rules: [
        'تداول عقود ETHUSD فقط',
        'الحد الأدنى للرافعة 5x',
        'لا يُسمح بالهيدج',
        'الحد الأدنى لحجم المركز 100 USDT'
      ],
      topTraders: [
        { rank: 1, user: 'GoldHunter', volume: 4200000, pnl: 89500, prize: 10000 },
        { rank: 2, user: 'EthMax', volume: 3850000, pnl: 72400, prize: 5000 },
        { rank: 3, user: 'L2Wizard', volume: 2950000, pnl: 58200, prize: 3000 }
      ]
    },
    {
      id: 3,
      title: 'سباق المبتدئين',
      type: 'spot',
      pair: 'ALL',
      prizePool: 10000,
      participants: 3245,
      startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 9).toISOString(),
      status: 'upcoming',
      description: 'بطولة مخصصة للمتداولين الجدد. أكمل أول 5 صفقات وادخل السحب على 10,000 USDT.',
      rules: [
        'للحسابات المسجلة خلال آخر 30 يوم',
        'أكمل 5 صفقات على الأقل',
        'الحد الأدنى لكل صفقة 50 USDT'
      ],
      topTraders: []
    },
    {
      id: 4,
      title: 'كأس BNB',
      type: 'trading_volume',
      pair: 'BNBUSDT',
      prizePool: 15000,
      participants: 1102,
      startDate: new Date(Date.now() - 86400000 * 14).toISOString(),
      endDate: new Date(Date.now() - 86400000 * 7).toISOString(),
      status: 'ended',
      myRank: 23,
      myVolume: 78500,
      myPnl: 1850,
      description: 'انتهت البطولة. شكراً لجميع المشاركين.',
      rules: ['تداول BNB/USDT spot فقط', 'الحد الأدنى اليومي 500 USDT'],
      topTraders: [
        { rank: 1, user: 'BNBKing', volume: 5200000, pnl: 45200, prize: 5000 },
        { rank: 2, user: 'BinanceBull', volume: 4100000, pnl: 38100, prize: 3000 },
        { rank: 3, user: 'CoinMaster', volume: 3250000, pnl: 28400, prize: 1500 }
      ]
    }
  ];

  let filtered = $state(competitions.filter((c) => c.status === activeTab));

  $effect(() => {
    filtered = competitions.filter((c) => c.status === activeTab);
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  }

  function daysRemaining(endIso: string): number {
    return Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / 86400000));
  }

  function hoursRemaining(endIso: string): number {
    return Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / 3600000));
  }

  // Static class lookups (Tailwind JIT-safe)
  const typeMeta: Record<string, { label: string; pill: string; topbar: string; glow: string; text: string }> = {
    spot: {
      label: 'سبوت',
      pill: 'pill-mint',
      topbar: 'rgba(34, 211, 164, 0.5)',
      glow: 'bg-accent-mint/10',
      text: 'text-accent-mint'
    },
    futures: {
      label: 'عقود',
      pill: 'pill-gold',
      topbar: 'rgba(245, 181, 68, 0.5)',
      glow: 'bg-accent-gold/10',
      text: 'text-accent-gold'
    },
    trading_volume: {
      label: 'حجم تداول',
      pill: 'pill-azure',
      topbar: 'rgba(59, 130, 246, 0.5)',
      glow: 'bg-accent-azure/10',
      text: 'text-accent-azure'
    },
    pnl: {
      label: 'ربحية',
      pill: 'pill-rose',
      topbar: 'rgba(251, 113, 133, 0.5)',
      glow: 'bg-accent-rose/10',
      text: 'text-accent-rose'
    }
  };

  // Rank styling — using accent palette only (no yellow/orange)
  function rankMeta(rank: number): { color: string; bg: string; border: string } {
    if (rank === 1) return { color: 'text-accent-gold', bg: 'bg-accent-gold/15', border: 'border-accent-gold/30' };
    if (rank === 2) return { color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/20' };
    if (rank === 3) return { color: 'text-accent-rose', bg: 'bg-accent-rose/15', border: 'border-accent-rose/30' };
    return { color: 'text-slate-500', bg: 'bg-white/5', border: 'border-white/10' };
  }

  // Hero stats (computed)
  const totalPrizePool = competitions.reduce((s, c) => s + c.prizePool, 0);
  const totalParticipants = competitions.reduce((s, c) => s + c.participants, 0);
  const activeCount = competitions.filter((c) => c.status === 'active').length;
</script>

<svelte:head><title>المسابقات — NEXUS</title></svelte:head>

<div class="space-y-5 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Hero -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <!-- Layered aurora -->
    <div class="absolute inset-0 opacity-60 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-16 -right-16 w-64 h-64 bg-accent-gold/20 blur-3xl rounded-full animate-float"></div>
      <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-accent-rose/15 blur-3xl rounded-full animate-float" style="animation-delay: 2s;"></div>
    </div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative flex items-center gap-4 flex-wrap mb-6">
      <div class="relative shrink-0">
        <div class="absolute inset-0 bg-accent-gold/30 blur-2xl rounded-2xl animate-pulse-glow"></div>
        <div class="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet border border-accent-gold/30 flex items-center justify-center">
          <Trophy size={26} class="text-ink-950" />
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">مسابقات التداول</h1>
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
            </span>
            <span class="text-[10px] font-bold text-accent-mint tracking-wide">{activeCount} نشطة</span>
          </div>
        </div>
        <p class="text-sm text-slate-400 leading-relaxed">
          نافس أفضل المتداولين واربح جوائز ضخمة بالدولار. بطولات أسبوعية وشهرية على مختلف الأزواج والمنتجات.
        </p>
      </div>
    </div>

    <!-- Hero stat cards -->
    <div class="relative grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="stat-card group relative overflow-hidden">
        <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 mb-2">
            <Gift size={12} class="text-accent-gold" />
            <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إجمالي الجوائز</span>
          </div>
          <p class="text-xl font-bold text-gold-gradient tabular-nums">${formatPrice(totalPrizePool)}</p>
          <p class="text-[10px] text-slate-500 mt-0.5 tabular-nums">≈ {egpCompact(usdToEgp(totalPrizePool, currentRate))} ج.م</p>
        </div>
      </div>
      <div class="stat-card group relative overflow-hidden">
        <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 mb-2">
            <Flame size={12} class="text-accent-mint" />
            <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مسابقات نشطة</span>
          </div>
          <p class="text-xl font-bold text-white tabular-nums">{activeCount}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">بطولة جارية الآن</p>
        </div>
      </div>
      <div class="stat-card group relative overflow-hidden">
        <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 mb-2">
            <Users size={12} class="text-accent-violet" />
            <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">المشاركون</span>
          </div>
          <p class="text-xl font-bold text-white tabular-nums">{totalParticipants.toLocaleString()}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">متداول منافس</p>
        </div>
      </div>
      <div class="stat-card group relative overflow-hidden">
        <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-azure/10 blur-2xl rounded-full group-hover:bg-accent-azure/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 mb-2">
            <Star size={12} class="text-accent-azure" />
            <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">ترتيبك المتوسط</span>
          </div>
          <p class="text-xl font-bold text-white tabular-nums">#28</p>
          <p class="text-[10px] text-slate-500 mt-0.5">من أفضل 5%</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: 'active', label: 'نشطة', icon: Flame, count: activeCount },
      { key: 'upcoming', label: 'قادمة', icon: Calendar, count: competitions.filter((c) => c.status === 'upcoming').length },
      { key: 'ended', label: 'منتهية', icon: Trophy, count: competitions.filter((c) => c.status === 'ended').length }
    ]}
  />

  <!-- Competition cards -->
  <div class="space-y-4">
    {#each filtered as c (c.id)}
      {@const meta = typeMeta[c.type]}
      {@const days = daysRemaining(c.endDate)}
      {@const hours = hoursRemaining(c.endDate)}
      {@const progressPct = c.status === 'active'
        ? Math.min(100, Math.max(0, ((Date.now() - new Date(c.startDate).getTime()) / (new Date(c.endDate).getTime() - new Date(c.startDate).getTime())) * 100))
        : c.status === 'ended' ? 100 : 0}
      <div class="panel overflow-hidden relative group">
        <!-- Topbar gradient -->
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {meta.topbar}, transparent);"></div>
        <!-- Background glow -->
        <div class="absolute -top-20 -left-20 w-64 h-64 {meta.glow} blur-3xl rounded-full opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"></div>

        <!-- Header -->
        <div class="relative p-5 sm:p-6 flex items-start justify-between gap-4 flex-wrap">
          <div class="flex-1 min-w-[220px]">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <h3 class="text-lg sm:text-xl font-bold text-white tracking-tight">{c.title}</h3>
              <span class="pill {meta.pill} text-[10px]">{meta.label}</span>
              {#if c.pair !== 'ALL'}
                <span class="pill pill-gold text-[10px]">{c.pair}</span>
              {/if}
              {#if c.status === 'active'}
                <span class="pill pill-mint text-[10px] flex items-center gap-1">
                  <span class="relative flex h-1.5 w-1.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
                    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
                  </span>
                  جارية
                </span>
              {/if}
            </div>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">{c.description}</p>
            <div class="flex items-center gap-3 mt-3 text-[11px] text-slate-500 flex-wrap">
              <span class="flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(c.startDate)} — {formatDate(c.endDate)}
              </span>
              <span class="flex items-center gap-1">
                <Users size={11} />
                <span class="tabular-nums">{c.participants.toLocaleString()}</span> مشارك
              </span>
              {#if c.status === 'active'}
                <span class="flex items-center gap-1 text-accent-mint font-semibold">
                  <Clock size={11} />
                  {#if days > 0}
                    <span class="tabular-nums">{days}</span> يوم متبقي
                  {:else}
                    <span class="tabular-nums">{hours}</span> ساعة متبقية
                  {/if}
                </span>
              {/if}
            </div>

            <!-- Progress bar for active competitions -->
            {#if c.status === 'active'}
              <div class="mt-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[9px] uppercase tracking-wider text-slate-500 font-bold">تقدّم البطولة</span>
                  <span class="text-[9px] text-accent-mint font-bold tabular-nums">{progressPct.toFixed(0)}%</span>
                </div>
                <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-accent-mint to-accent-azure transition-all duration-500" style="width: {progressPct}%;"></div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Prize pool -->
          <div class="text-center shrink-0 relative">
            <div class="absolute inset-0 bg-accent-gold/10 blur-2xl rounded-2xl"></div>
            <div class="relative px-4 py-3 rounded-2xl bg-accent-gold/5 border border-accent-gold/20">
              <div class="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">جائزة كبرى</div>
              <div class="text-2xl sm:text-3xl font-bold text-gold-gradient font-mono tabular-nums">${formatPrice(c.prizePool)}</div>
              <div class="text-[10px] text-accent-gold font-mono tabular-nums mt-0.5">≈ {formatEGP(usdToEgp(c.prizePool, currentRate))}</div>
            </div>
          </div>
        </div>

        <!-- My stats (if active and I'm participating) -->
        {#if c.status === 'active' && c.myRank}
          <div class="relative bg-accent-gold/[0.03] border-t border-white/5 px-5 sm:px-6 py-4">
            <div class="grid grid-cols-3 gap-3">
              <div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Trophy size={9} class="text-accent-gold" /> ترتيبي
                </div>
                <div class="text-base sm:text-lg font-bold text-accent-gold font-mono tabular-nums">#{c.myRank}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Activity size={9} class="text-accent-azure" /> حجم تداولي
                </div>
                <div class="text-base sm:text-lg font-bold text-white font-mono tabular-nums">${formatPrice(c.myVolume || 0)}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <TrendingUp size={9} class="text-accent-mint" /> ربحي
                </div>
                <div class="text-base sm:text-lg font-bold text-accent-mint font-mono tabular-nums">+${formatPrice(c.myPnl || 0)}</div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Top traders leaderboard -->
        {#if c.topTraders.length > 0}
          <div class="relative border-t border-white/5 p-5 sm:p-6">
            <div class="flex items-center gap-1.5 text-xs text-slate-300 mb-3 font-semibold">
              <Crown size={14} class="text-accent-gold" />
              المتصدرون
              <span class="text-[10px] text-slate-500 font-normal">— أعلى 5 مراكز</span>
            </div>
            <div class="space-y-1.5">
              {#each c.topTraders as t}
                {@const r = rankMeta(t.rank)}
                <div class="flex items-center justify-between gap-3 text-xs py-2 px-3 rounded-xl hover:bg-white/[0.02] transition-colors group/row">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg {r.bg} {r.border} border flex items-center justify-center shrink-0">
                      {#if t.rank === 1}
                        <Crown size={12} class={r.color} />
                      {:else if t.rank <= 3}
                        <Medal size={12} class={r.color} />
                      {:else}
                        <span class="text-[10px] font-bold {r.color} tabular-nums">{t.rank}</span>
                      {/if}
                    </div>
                    <span class="font-semibold text-white">{t.user}</span>
                  </div>
                  <div class="flex items-center gap-3 sm:gap-4 font-mono text-[11px]">
                    <span class="text-slate-400 hidden sm:inline tabular-nums">
                      {formatCompact(t.volume)} <span class="text-[9px] text-slate-600">VOL</span>
                    </span>
                    <span class="text-accent-mint tabular-nums">+${formatPrice(t.pnl)}</span>
                    <span class="text-accent-gold min-w-[60px] text-left font-bold tabular-nums">${formatPrice(t.prize)}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Rules -->
        <div class="relative border-t border-white/5 p-5 sm:p-6 bg-white/[0.01]">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={11} class="text-accent-mint" />
            الشروط والأحكام
          </div>
          <ul class="text-[11px] sm:text-xs text-slate-400 space-y-1.5 grid sm:grid-cols-2 gap-x-4">
            {#each c.rules as rule}
              <li class="flex items-start gap-1.5">
                <span class="w-1 h-1 rounded-full bg-accent-gold/60 mt-1.5 shrink-0"></span>
                <span class="leading-relaxed">{rule}</span>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Action button -->
        <div class="relative border-t border-white/5 p-4 sm:p-5 flex justify-end">
          {#if c.status === 'active'}
            <a
              href="/dashboard/exchange?symbol={c.pair !== 'ALL' ? c.pair : 'BTCUSDT'}"
              class="btn-buy text-sm"
            >
              <Zap size={14} /> تداول الآن
            </a>
          {:else if c.status === 'upcoming'}
            <button class="btn-ghost text-sm">
              <Clock size={14} /> ذكّرني عند البدء
            </button>
          {:else}
            <span class="text-xs text-slate-500 flex items-center gap-1.5">
              <Trophy size={12} class="text-slate-600" /> انتهت المسابقة
            </span>
          {/if}
        </div>
      </div>
    {/each}

    {#if filtered.length === 0}
      <div class="panel py-20 text-center relative overflow-hidden">
        <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
        <div class="relative">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full"></div>
            <Trophy size={48} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">لا توجد مسابقات في هذه الفئة</p>
          <p class="text-xs text-slate-500 mt-1">تابعنا للإعلان عن بطولات جديدة قريباً</p>
        </div>
      </div>
    {/if}
  </div>
</div>
