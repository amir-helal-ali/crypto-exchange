<script lang="ts">
  /**
   * NEXUS Trading Competitions — bounty/leaderboard page.
   * Active, upcoming, and past competitions with prize pools,
   * user rank, top traders, countdowns.
   */
  import { onMount } from 'svelte';
  import { formatPrice, formatCompact, timeAgo } from '$lib/utils/format';
  import { usdToEgp, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import {
    Trophy,
    Users,
    Clock,
    Gift,
    TrendingUp,
    Star,
    Crown,
    Medal,
    Zap,
    ArrowRight,
    Calendar,
    CheckCircle2,
    Sparkles
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

  let filtered = $derived(competitions.filter((c) => c.status === activeTab));

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  }

  function daysRemaining(endIso: string): number {
    return Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / 86400000));
  }

  function typeBadge(t: string): { label: string; cls: string } {
    if (t === 'spot') return { label: 'سبوت', cls: 'pill-mint' };
    if (t === 'futures') return { label: 'عقود', cls: 'pill-gold' };
    if (t === 'trading_volume') return { label: 'حجم تداول', cls: 'pill-blue' };
    if (t === 'pnl') return { label: 'ربحية', cls: 'pill-rose' };
    return { label: t, cls: 'pill-gold' };
  }

  function rankColor(rank: number): string {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-slate-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-slate-500';
  }
</script>

<svelte:head><title>المسابقات — NEXUS</title></svelte:head>

<div class="space-y-5">
  <!-- Hero section -->
  <div class="panel p-6 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10 pointer-events-none">
      <div class="absolute top-4 left-4 text-9xl"><Trophy class="text-accent-gold" /></div>
      <div class="absolute bottom-4 right-4 text-7xl"><Sparkles class="text-accent-mint" /></div>
    </div>
    <div class="relative z-10">
      <div class="flex items-center gap-2 mb-2">
        <Trophy size={28} class="text-accent-gold" />
        <h1 class="text-2xl font-bold text-white">مسابقات التداول</h1>
      </div>
      <p class="text-slate-400 text-sm mb-4">نافس أفضل المتداولين واربح جوائز ضخمة بالدولار. بطولات أسبوعية وشهرية على مختلف الأزواج والمنتجات.</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
          <div class="text-[10px] text-slate-500 mb-1">إجمالي الجوائز</div>
          <div class="text-lg font-bold text-accent-gold font-mono">$100,000+</div>
        </div>
        <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
          <div class="text-[10px] text-slate-500 mb-1">مسابقات نشطة</div>
          <div class="text-lg font-bold text-accent-mint font-mono">{competitions.filter((c) => c.status === 'active').length}</div>
        </div>
        <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
          <div class="text-[10px] text-slate-500 mb-1">إجمالي المشاركين</div>
          <div class="text-lg font-bold text-white font-mono">{competitions.reduce((s, c) => s + c.participants, 0).toLocaleString()}</div>
        </div>
        <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
          <div class="text-[10px] text-slate-500 mb-1">ترتيبك المتوسط</div>
          <div class="text-lg font-bold text-accent-violet font-mono">#28</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="panel overflow-hidden">
    <div class="px-4 pt-3 pb-0 border-b border-white/5">
      <NavTabs
        value={activeTab}
        onchange={(key) => (activeTab = key as any)}
        variant="underline"
        size="sm"
        items={[
          { key: 'active', label: 'نشطة' },
          { key: 'upcoming', label: 'قادمة' },
          { key: 'ended', label: 'منتهية' }
        ]}
      />
    </div>

    <!-- Competition cards -->
    <div class="p-4 space-y-4">
      {#each filtered as c (c.id)}
        {@const badge = typeBadge(c.type)}
        <div class="bg-ink-900/40 rounded-xl border border-white/5 overflow-hidden hover:border-accent-gold/30 transition-colors">
          <!-- Header -->
          <div class="p-4 flex items-start justify-between gap-4 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <div class="flex items-center gap-2 mb-1.5">
                <h3 class="text-lg font-bold text-white">{c.title}</h3>
                <span class="pill {badge.cls}">{badge.label}</span>
                {#if c.pair !== 'ALL'}
                  <span class="pill pill-gold">{c.pair}</span>
                {/if}
              </div>
              <p class="text-xs text-slate-400">{c.description}</p>
              <div class="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                <span class="flex items-center gap-1"><Calendar size={11} /> {formatDate(c.startDate)} — {formatDate(c.endDate)}</span>
                <span class="flex items-center gap-1"><Users size={11} /> {c.participants.toLocaleString()} مشارك</span>
                {#if c.status === 'active'}
                  <span class="flex items-center gap-1 text-accent-mint"><Clock size={11} /> {daysRemaining(c.endDate)} يوم متبقي</span>
                {/if}
              </div>
            </div>

            <!-- Prize pool -->
            <div class="text-center shrink-0">
              <div class="text-[10px] text-slate-500 uppercase tracking-wider">جائزة كبرى</div>
              <div class="text-2xl font-bold text-accent-gold font-mono">${formatPrice(c.prizePool)}</div>
              <div class="text-[10px] text-accent-gold font-mono">≈ {formatEGP(usdToEgp(c.prizePool, currentRate))}</div>
            </div>
          </div>

          <!-- My stats (if active and I'm participating) -->
          {#if c.status === 'active' && c.myRank}
            <div class="bg-accent-gold/5 border-t border-white/5 px-4 py-3 grid grid-cols-3 gap-3">
              <div>
                <div class="text-[10px] text-slate-500">ترتيبي</div>
                <div class="text-base font-bold text-accent-gold font-mono">#{c.myRank}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500">حجم تداولي</div>
                <div class="text-base font-bold text-white font-mono">${formatPrice(c.myVolume || 0)}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-500">ربحي</div>
                <div class="text-base font-bold text-accent-mint font-mono">+${formatPrice(c.myPnl || 0)}</div>
              </div>
            </div>
          {/if}

          <!-- Top traders leaderboard -->
          {#if c.topTraders.length > 0}
            <div class="border-t border-white/5 p-4">
              <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-semibold">
                <Crown size={13} class="text-accent-gold" />
                المتصدرون
              </div>
              <div class="space-y-1.5">
                {#each c.topTraders as t}
                  <div class="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded-md hover:bg-white/[0.02]">
                    <div class="flex items-center gap-2">
                      <span class="w-6 text-center font-bold {rankColor(t.rank)}">#{t.rank}</span>
                      {#if t.rank === 1}
                        <Crown size={12} class="text-yellow-400" />
                      {:else if t.rank <= 3}
                        <Medal size={12} class={rankColor(t.rank)} />
                      {/if}
                      <span class="font-semibold text-white">{t.user}</span>
                    </div>
                    <div class="flex items-center gap-4 font-mono text-slate-400">
                      <span>{formatCompact(t.volume)} <span class="text-[9px]">VOL</span></span>
                      <span class="text-accent-mint">+${formatPrice(t.pnl)}</span>
                      <span class="text-accent-gold min-w-[60px] text-left">${formatPrice(t.prize)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Rules -->
          <div class="border-t border-white/5 p-4">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-2">الشروط والأحكام</div>
            <ul class="text-[11px] text-slate-400 space-y-1">
              {#each c.rules as rule}
                <li class="flex items-start gap-1.5">
                  <CheckCircle2 size={11} class="text-accent-mint mt-0.5 shrink-0" />
                  <span>{rule}</span>
                </li>
              {/each}
            </ul>
          </div>

          <!-- Action button -->
          <div class="border-t border-white/5 p-4 flex justify-end">
            {#if c.status === 'active'}
              <a href="/dashboard/exchange?symbol={c.pair !== 'ALL' ? c.pair : 'BTCUSDT'}" class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-gold text-white text-sm font-semibold hover:bg-accent-gold/90 transition-colors">
                <Zap size={13} /> تداول الآن
                <ArrowRight size={13} class="rotate-180" />
              </a>
            {:else if c.status === 'upcoming'}
              <button class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-slate-300 text-sm font-semibold hover:bg-white/10 transition-colors">
                <Clock size={13} /> تذكيرني عند البدء
              </button>
            {:else}
              <span class="text-xs text-slate-500">انتهت المسابقة</span>
            {/if}
          </div>
        </div>
      {/each}

      {#if filtered.length === 0}
        <div class="py-10 text-center text-slate-500">لا توجد مسابقات في هذه الفئة</div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global([data-theme='light']) .text-slate-500 {
    color: #94a3b8 !important;
  }
  :global([data-theme='light']) .text-slate-400 {
    color: #64748b !important;
  }
  :global([data-theme='light']) .text-slate-300 {
    color: #475569 !important;
  }
  :global([data-theme='light']) .text-white {
    color: #0f172a !important;
  }
  :global([data-theme='light']) .bg-white\/5 {
    background-color: rgba(15, 23, 42, 0.05) !important;
  }
  :global([data-theme='light']) .bg-ink-900\/40,
  :global([data-theme='light']) .bg-ink-900\/50 {
    background-color: rgba(15, 23, 42, 0.03) !important;
  }
  :global([data-theme='light']) .border-white\/5 {
    border-color: rgba(15, 23, 42, 0.08) !important;
  }
</style>
