<script lang="ts">
  /**
   * Trading Bots — DCA / Grid / Signal bots that auto-trade based on strategies.
   * Users can create, monitor, pause, and delete bots. Each bot has live P&L,
   * number of trades executed, and configuration summary.
   */
  import { onMount } from 'svelte';
  import {
    Bot, Plus, Play, Pause, Square, Trash2, Settings2, Activity,
    TrendingUp, TrendingDown, DollarSign, Percent, Target, Clock,
    Grid3x3, Repeat, Zap, Award, Check, X, Eye, ChevronDown, ChevronUp,
    BarChart3, AlertTriangle, RefreshCw, Cpu, Layers
  } from 'lucide-svelte';
  import { formatPrice, formatCompact, formatPercent } from '$lib/utils/format';
  import { usdToEgp, egpCompact, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { toasts } from '$lib/stores/toast';

  type BotType = 'DCA' | 'GRID' | 'SIGNAL';
  type BotStatus = 'running' | 'paused' | 'stopped';

  type TradingBot = {
    id: string;
    name: string;
    type: BotType;
    symbol: string;
    status: BotStatus;
    createdAt: number;
    invested: number; // USD
    currentValue: number; // USD
    pnl: number;
    pnlPct: number;
    trades: number;
    config: {
      // DCA
      intervalHours?: number;
      perOrder?: number;
      // Grid
      upperPrice?: number;
      lowerPrice?: number;
      gridCount?: number;
      // Signal
      strategy?: string;
      leverage?: number;
    };
    lastTradeAt?: number;
    nextAction?: string;
    logs: { time: number; msg: string; type: 'info' | 'success' | 'warn' | 'error' }[];
  };

  let bots = $state<TradingBot[]>([]);
  let createOpen = $state(false);
  let selectedBot = $state<TradingBot | null>(null);
  let detailOpen = $state(false);
  let currentRate = $state(48.5);

  // Create form state
  let newName = $state('');
  let newType = $state<BotType>('GRID');
  let newSymbol = $state('BTCUSDT');
  let newInvestment = $state(500);
  let newUpper = $state(70000);
  let newLower = $state(60000);
  let newGridCount = $state(10);
  let newIntervalHours = $state(4);
  let newPerOrder = $state(50);
  let newStrategy = $state<'sma-cross' | 'rsi' | 'macd-cross'>('rsi');
  let newLeverage = $state(1);

  function generateBots(): TradingBot[] {
    return [
      {
        id: 'bot1',
        name: 'BTC Grid Master',
        type: 'GRID',
        symbol: 'BTCUSDT',
        status: 'running',
        createdAt: Date.now() - 86400000 * 14,
        invested: 1000,
        currentValue: 1142.50,
        pnl: 142.50,
        pnlPct: 14.25,
        trades: 47,
        config: { upperPrice: 70000, lowerPrice: 60000, gridCount: 15 },
        lastTradeAt: Date.now() - 1200000,
        nextAction: 'شراء عند 64,500 (Grid #5)',
        logs: [
          { time: Date.now() - 1200000, msg: 'تم تنفيذ أمر شراء BTC @ 64,500$', type: 'success' },
          { time: Date.now() - 3600000, msg: 'تم تنفيذ أمر بيع BTC @ 65,200$', type: 'success' },
          { time: Date.now() - 7200000, msg: 'السعر تجاوز الحد العلوي - مراقبة', type: 'warn' },
          { time: Date.now() - 86400000, msg: 'تم إعادة ضبط الشبكة', type: 'info' }
        ]
      },
      {
        id: 'bot2',
        name: 'ETH DCA Monthly',
        type: 'DCA',
        symbol: 'ETHUSDT',
        status: 'running',
        createdAt: Date.now() - 86400000 * 30,
        invested: 1500,
        currentValue: 1689.30,
        pnl: 189.30,
        pnlPct: 12.62,
        trades: 30,
        config: { intervalHours: 24, perOrder: 50 },
        lastTradeAt: Date.now() - 3600000 * 8,
        nextAction: 'شراء دوري بعد 16 ساعة',
        logs: [
          { time: Date.now() - 3600000 * 8, msg: 'شراء دوري ETH @ 3,540$ (50$)', type: 'success' },
          { time: Date.now() - 86400000, msg: 'شراء دوري ETH @ 3,495$ (50$)', type: 'success' },
          { time: Date.now() - 86400000 * 2, msg: 'شراء دوري ETH @ 3,420$ (50$)', type: 'success' }
        ]
      },
      {
        id: 'bot3',
        name: 'RSI Signal Bot',
        type: 'SIGNAL',
        symbol: 'SOLUSDT',
        status: 'paused',
        createdAt: Date.now() - 86400000 * 7,
        invested: 800,
        currentValue: 742.80,
        pnl: -57.20,
        pnlPct: -7.15,
        trades: 12,
        config: { strategy: 'rsi', leverage: 1 },
        lastTradeAt: Date.now() - 86400000,
        nextAction: 'بانتظار إشارة RSI < 30',
        logs: [
          { time: Date.now() - 86400000, msg: 'تم إيقاف البوت يدوياً', type: 'warn' },
          { time: Date.now() - 86400000 * 2, msg: 'بيع SOL @ 145$ (خسارة -3.2%)', type: 'error' },
          { time: Date.now() - 86400000 * 3, msg: 'شراء SOL @ 150$ (إشارة RSI)', type: 'success' }
        ]
      },
      {
        id: 'bot4',
        name: 'BNB Grid Pro',
        type: 'GRID',
        symbol: 'BNBUSDT',
        status: 'running',
        createdAt: Date.now() - 86400000 * 21,
        invested: 600,
        currentValue: 678.40,
        pnl: 78.40,
        pnlPct: 13.07,
        trades: 89,
        config: { upperPrice: 650, lowerPrice: 550, gridCount: 20 },
        lastTradeAt: Date.now() - 600000,
        nextAction: 'بيع عند 620$ (Grid #12)',
        logs: [
          { time: Date.now() - 600000, msg: 'شراء BNB @ 590$', type: 'success' },
          { time: Date.now() - 1800000, msg: 'بيع BNB @ 595$', type: 'success' }
        ]
      }
    ];
  }

  onMount(() => {
    bots = generateBots();
    usdEgpRate.subscribe((r) => (currentRate = r));
  });

  // Stats
  const stats = $derived.by(() => {
    const total = bots.length;
    const running = bots.filter((b) => b.status === 'running').length;
    const paused = bots.filter((b) => b.status === 'paused').length;
    const totalInvested = bots.reduce((s, b) => s + b.invested, 0);
    const totalValue = bots.reduce((s, b) => s + b.currentValue, 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const totalTrades = bots.reduce((s, b) => s + b.trades, 0);
    return { total, running, paused, totalInvested, totalValue, totalPnL, totalPnLPct, totalTrades };
  });

  function toggleStatus(bot: TradingBot) {
    bot.status = bot.status === 'running' ? 'paused' : 'running';
    bots = [...bots];
    toasts.success(bot.status === 'running' ? `تم تفعيل ${bot.name}` : `تم إيقاف ${bot.name} مؤقتاً`);
  }

  function stopBot(bot: TradingBot) {
    if (!confirm(`هل أنت متأكد من إيقاف ${bot.name} نهائياً؟ سيتم تصفية所有 المراكز.`)) return;
    bot.status = 'stopped';
    bots = [...bots];
    toasts.info(`تم إيقاف ${bot.name} وتصفية المراكز`);
  }

  function deleteBot(bot: TradingBot) {
    if (!confirm(`حذف ${bot.name} نهائياً؟`)) return;
    bots = bots.filter((b) => b.id !== bot.id);
    toasts.info(`تم حذف ${bot.name}`);
  }

  function createBot() {
    if (!newName.trim()) {
      toasts.error('الرجاء إدخال اسم للبوت');
      return;
    }
    const config: any = {};
    if (newType === 'GRID') {
      config.upperPrice = newUpper;
      config.lowerPrice = newLower;
      config.gridCount = newGridCount;
    } else if (newType === 'DCA') {
      config.intervalHours = newIntervalHours;
      config.perOrder = newPerOrder;
    } else if (newType === 'SIGNAL') {
      config.strategy = newStrategy;
      config.leverage = newLeverage;
    }

    const newBot: TradingBot = {
      id: `bot${Date.now()}`,
      name: newName,
      type: newType,
      symbol: newSymbol,
      status: 'running',
      createdAt: Date.now(),
      invested: newInvestment,
      currentValue: newInvestment,
      pnl: 0,
      pnlPct: 0,
      trades: 0,
      config,
      nextAction: 'في انتظار الإشارة الأولى...',
      logs: [
        { time: Date.now(), msg: `تم إنشاء البوت بنجاح - استثمار مبدئي ${newInvestment}$`, type: 'success' }
      ]
    };
    bots = [newBot, ...bots];
    toasts.success(`تم إنشاء ${newName} بنجاح!`);
    createOpen = false;
    newName = '';
  }

  function openDetail(bot: TradingBot) {
    selectedBot = bot;
    detailOpen = true;
  }

  function timeAgoShort(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}س`;
    return `${Math.floor(h / 24)}ي`;
  }

  function logColor(t: string): string {
    switch (t) {
      case 'success': return 'text-accent-mint';
      case 'warn': return 'text-amber-400';
      case 'error': return 'text-accent-rose';
      default: return 'text-slate-400';
    }
  }

  const botTypes = [
    { v: 'GRID', l: 'الشبكة (Grid)', icon: Grid3x3, desc: 'يضع أوامر شراء/بيع في نطاق سعري — يربح من التذبذب', color: '#f5b544' },
    { v: 'DCA', l: 'المتوسط (DCA)', icon: Repeat, desc: 'يشتري كميات ثابتة على فترات منتظمة — يقلل متوسط التكلفة', color: '#22d3a4' },
    { v: 'SIGNAL', l: 'الإشارة (Signal)', icon: Zap, desc: 'ينفذ الصفقات بناءً على إشارات المؤشرات الفنية', color: '#a855f7' }
  ];
</script>

<svelte:head><title>Trading Bots — NEXUS</title></svelte:head>

<div class="space-y-4 pb-20 lg:pb-0">
  <!-- Hero header -->
  <div class="panel p-4 bg-gradient-to-l from-accent-gold/10 via-transparent to-transparent">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-accent-gold/15 flex items-center justify-center">
          <Bot size={24} class="text-accent-gold" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">بوتات التداول</h1>
          <p class="text-xs text-slate-400 mt-0.5">أتمتة استراتيجياتك — تعمل 24/7 حتى أثناء نومك</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="px-3 py-1.5 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-full bg-accent-mint animate-pulse"></div>
          <span class="text-accent-mint font-bold">{stats.running}</span>
          <span class="text-slate-400">نشط</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <span class="text-slate-400">متوقف مؤقت:</span>
          <span class="text-amber-400 font-bold mr-1">{stats.paused}</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <span class="text-slate-400">صفقات منفذة:</span>
          <span class="text-white font-bold mr-1 tabular-nums">{stats.totalTrades}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Portfolio summary -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div class="panel p-3">
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase mb-1">
        <DollarSign size={10} /> إجمالي الاستثمار
      </div>
      <div class="text-lg font-bold text-white tabular-nums">${stats.totalInvested.toFixed(2)}</div>
      <div class="text-[10px] text-slate-400 mt-0.5">≈ {egpCompact(usdToEgp(stats.totalInvested, currentRate))}</div>
    </div>
    <div class="panel p-3">
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase mb-1">
        <Activity size={10} /> القيمة الحالية
      </div>
      <div class="text-lg font-bold text-white tabular-nums">${stats.totalValue.toFixed(2)}</div>
      <div class="text-[10px] text-slate-400 mt-0.5">≈ {egpCompact(usdToEgp(stats.totalValue, currentRate))}</div>
    </div>
    <div class="panel p-3">
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase mb-1">
        <Percent size={10} /> إجمالي الربح/الخسارة
      </div>
      <div class="text-lg font-bold tabular-nums {stats.totalPnL >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
        {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}$
      </div>
      <div class="text-[10px] tabular-nums mt-0.5 {stats.totalPnLPct >= 0 ? 'text-accent-mint/70' : 'text-accent-rose/70'}">
        {stats.totalPnLPct >= 0 ? '+' : ''}{stats.totalPnLPct.toFixed(2)}%
      </div>
    </div>
    <div class="panel p-3">
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase mb-1">
        <Cpu size={10} /> البوتات النشطة
      </div>
      <div class="text-lg font-bold text-white tabular-nums">{stats.running}/{stats.total}</div>
      <div class="text-[10px] text-slate-400 mt-0.5">تعمل الآن</div>
    </div>
  </div>

  <!-- Create bot button -->
  <div class="flex items-center justify-between">
    <h2 class="text-sm font-bold text-white flex items-center gap-1.5">
      <Layers size={14} class="text-accent-gold" /> بوتاتي
    </h2>
    <button
      onclick={() => (createOpen = true)}
      class="px-4 py-2 text-xs font-bold bg-accent-gold text-ink-950 rounded-md hover:bg-accent-gold/90 transition-colors flex items-center gap-1.5"
    >
      <Plus size={14} /> إنشاء بوت جديد
    </button>
  </div>

  <!-- Bots grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    {#each bots as bot (bot.id)}
      <div class="panel p-4 relative overflow-hidden">
        <!-- Status indicator -->
        <div class="absolute top-0 right-0 px-2 py-1 text-[10px] font-bold rounded-bl-md
          {bot.status === 'running' ? 'bg-accent-mint/20 text-accent-mint' : bot.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : 'bg-accent-rose/20 text-accent-rose'}">
          {#if bot.status === 'running'}<span class="inline-block w-1.5 h-1.5 rounded-full bg-accent-mint mr-1 animate-pulse"></span>{/if}
          {bot.status === 'running' ? 'نشط' : bot.status === 'paused' ? 'متوقف مؤقت' : 'متوقف'}
        </div>

        <div class="flex items-start gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background: {botTypes.find((t) => t.v === bot.type)?.color}30;">
            <svelte:component this={botTypes.find((t) => t.v === bot.type)?.icon || Bot} size={18} style="color: {botTypes.find((t) => t.v === bot.type)?.color};" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold text-white truncate">{bot.name}</h3>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span class="pill bg-white/[0.05] text-slate-300 text-[9px] py-0 px-1.5">{bot.type}</span>
              <span>{bot.symbol}</span>
              <span class="text-slate-600">·</span>
              <Clock size={9} />
              <span>{timeAgoShort(bot.createdAt)}</span>
            </div>
          </div>
        </div>

        <!-- P&L -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="bg-white/[0.02] rounded-md p-2">
            <div class="text-[9px] text-slate-500 uppercase">مستثمر</div>
            <div class="text-sm font-bold text-white tabular-nums">${bot.invested}</div>
          </div>
          <div class="bg-white/[0.02] rounded-md p-2">
            <div class="text-[9px] text-slate-500 uppercase">الحالي</div>
            <div class="text-sm font-bold text-white tabular-nums">${bot.currentValue.toFixed(2)}</div>
          </div>
          <div class="bg-white/[0.02] rounded-md p-2">
            <div class="text-[9px] text-slate-500 uppercase">الربح</div>
            <div class="text-sm font-bold tabular-nums {bot.pnl >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
              {bot.pnl >= 0 ? '+' : ''}{bot.pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>

        <!-- Next action -->
        {#if bot.nextAction && bot.status === 'running'}
          <div class="bg-accent-gold/5 border border-accent-gold/20 rounded-md p-2 mb-3 flex items-center gap-1.5">
            <Zap size={11} class="text-accent-gold flex-shrink-0" />
            <span class="text-[10px] text-slate-300 truncate">{bot.nextAction}</span>
          </div>
        {/if}

        <!-- Config summary -->
        <div class="text-[10px] text-slate-500 mb-3">
          {#if bot.type === 'GRID'}
            النطاق: ${formatPrice(bot.config.lowerPrice || 0)} - ${formatPrice(bot.config.upperPrice || 0)} · {bot.config.gridCount} مستويات
          {:else if bot.type === 'DCA'}
            كل {bot.config.intervalHours}س · ${bot.config.perOrder} لكل أمر
          {:else if bot.type === 'SIGNAL'}
            استراتيجية: {bot.config.strategy} · {bot.config.leverage}x رافعة
          {/if}
        </div>

        <!-- Stats line -->
        <div class="flex items-center justify-between text-[10px] text-slate-500 mb-3">
          <span class="flex items-center gap-1">
            <Activity size={10} />
            {bot.trades} صفقة
          </span>
          {#if bot.lastTradeAt}
            <span class="flex items-center gap-1">
              آخر صفقة: {timeAgoShort(bot.lastTradeAt)}
            </span>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1">
          <button
            onclick={() => toggleStatus(bot)}
            disabled={bot.status === 'stopped'}
            class="flex-1 py-1.5 text-xs font-bold rounded-md transition-colors disabled:opacity-30
              {bot.status === 'running' ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-accent-mint/15 text-accent-mint hover:bg-accent-mint/25'}"
          >
            {#if bot.status === 'running'}<Pause size={11} class="inline ml-1" /> إيقاف مؤقت{:else}<Play size={11} class="inline ml-1" /> تفعيل{/if}
          </button>
          <button
            onclick={() => openDetail(bot)}
            class="px-3 py-1.5 text-xs bg-white/[0.03] text-slate-300 rounded-md hover:bg-white/5"
            aria-label="تفاصيل"
          >
            <Eye size={12} />
          </button>
          <button
            onclick={() => stopBot(bot)}
            disabled={bot.status === 'stopped'}
            class="px-3 py-1.5 text-xs bg-accent-rose/15 text-accent-rose rounded-md hover:bg-accent-rose/25 disabled:opacity-30"
            aria-label="إيقاف نهائي"
          >
            <Square size={12} />
          </button>
          <button
            onclick={() => deleteBot(bot)}
            class="px-3 py-1.5 text-xs bg-white/[0.03] text-slate-400 rounded-md hover:bg-accent-rose/15 hover:text-accent-rose"
            aria-label="حذف"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    {/each}
  </div>

  {#if bots.length === 0}
    <div class="panel p-12 text-center">
      <Bot size={32} class="mx-auto text-slate-600 mb-2" />
      <p class="text-slate-400 text-sm mb-3">لا توجد بوتات بعد</p>
      <button
        onclick={() => (createOpen = true)}
        class="px-4 py-2 text-xs font-bold bg-accent-gold text-ink-950 rounded-md hover:bg-accent-gold/90 transition-colors inline-flex items-center gap-1.5"
      >
        <Plus size={12} /> إنشاء أول بوت
      </button>
    </div>
  {/if}

  <!-- Educational section -->
  <div class="panel p-4">
    <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
      <Award size={14} class="text-accent-gold" /> أنواع البوتات
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      {#each botTypes as bt}
        <div class="bg-white/[0.02] rounded-lg p-3 border-l-2" style="border-color: {bt.color};">
          <div class="flex items-center gap-2 mb-2">
            <svelte:component this={bt.icon} size={14} style="color: {bt.color};" />
            <h4 class="text-xs font-bold text-white">{bt.l}</h4>
          </div>
          <p class="text-[10px] text-slate-400 leading-relaxed">{bt.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Create bot modal -->
{#if createOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
    <div class="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-ink-900 border border-white/10 rounded-2xl shadow-2xl">
      <div class="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-accent-gold/10">
        <div class="flex items-center gap-2">
          <Plus size={16} class="text-accent-gold" />
          <h3 class="text-sm font-bold text-white">إنشاء بوت جديد</h3>
        </div>
        <button onclick={() => (createOpen = false)} class="text-slate-400 hover:text-white">✕</button>
      </div>
      <div class="p-4 space-y-3">
        <!-- Bot type selector -->
        <div>
          <label class="text-[11px] text-slate-400 block mb-1.5">نوع البوت</label>
          <div class="grid grid-cols-3 gap-2">
            {#each botTypes as bt}
              <button
                onclick={() => (newType = bt.v as BotType)}
                class="p-3 rounded-lg border-2 transition-all text-center
                  {newType === bt.v ? 'bg-white/[0.05]' : 'border-white/5 hover:border-white/10'}"
                style={newType === bt.v ? `border-color: ${bt.color};` : ''}
              >
                <svelte:component this={bt.icon} size={18} class="mx-auto mb-1" style="color: {bt.color};" />
                <div class="text-[11px] font-bold text-white">{bt.l.split(' ')[0]}</div>
              </button>
            {/each}
          </div>
          <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
            {botTypes.find((t) => t.v === newType)?.desc}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">اسم البوت</label>
            <input type="text" bind:value={newName} placeholder="مثال: BTC Grid Master" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-gold/40" />
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">الزوج</label>
            <select bind:value={newSymbol} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-2 text-xs text-white focus:outline-none">
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
              <option value="BNBUSDT">BNB/USDT</option>
              <option value="SOLUSDT">SOL/USDT</option>
              <option value="XRPUSDT">XRP/USDT</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-[11px] text-slate-400 block mb-1">الاستثمار المبدئي ($)</label>
          <input type="number" bind:value={newInvestment} min="50" step="50" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
          <p class="text-[10px] text-slate-500 mt-1">≈ {formatEGP(usdToEgp(newInvestment, currentRate))} ج.م</p>
        </div>

        {#if newType === 'GRID'}
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">السعر العلوي ($)</label>
              <input type="number" bind:value={newUpper} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
            </div>
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">السعر السفلي ($)</label>
              <input type="number" bind:value={newLower} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
            </div>
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">عدد مستويات الشبكة: {newGridCount}</label>
            <input type="range" bind:value={newGridCount} min="5" max="50" class="w-full accent-accent-gold" />
          </div>
        {:else if newType === 'DCA'}
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">كل (ساعات)</label>
              <input type="number" bind:value={newIntervalHours} min="1" max="168" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
            </div>
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">لكل أمر ($)</label>
              <input type="number" bind:value={newPerOrder} min="10" step="10" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
            </div>
          </div>
        {:else if newType === 'SIGNAL'}
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">الاستراتيجية</label>
              <select bind:value={newStrategy} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-2 text-xs text-white focus:outline-none">
                <option value="sma-cross">تقاطع SMA</option>
                <option value="rsi">RSI تشبع</option>
                <option value="macd-cross">تقاطع MACD</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">الرافعة: {newLeverage}x</label>
              <input type="range" bind:value={newLeverage} min="1" max="10" class="w-full accent-accent-gold" />
            </div>
          </div>
        {/if}

        <div class="bg-amber-500/5 border border-amber-500/20 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} class="text-amber-500 flex-shrink-0 mt-0.5" />
          <p class="text-[10px] text-amber-200/80 leading-relaxed">
            البوتات تنطوي على مخاطر. تأكد من فهمك للاستراتيجية قبل الإطلاق. يُنصح بالبدء بمبلغ صغير للاختبار.
          </p>
        </div>

        <button
          onclick={createBot}
          class="w-full py-2.5 text-sm font-bold bg-accent-gold text-ink-950 rounded-md hover:bg-accent-gold/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} /> إنشاء وإطلاق البوت
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Bot detail modal -->
{#if detailOpen && selectedBot}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
    <div class="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-ink-900 border border-white/10 rounded-2xl shadow-2xl">
      <div class="flex items-center justify-between px-5 py-3 border-b border-white/5 sticky top-0 bg-ink-900 z-10">
        <div class="flex items-center gap-2">
          <svelte:component this={botTypes.find((t) => t.v === selectedBot.type)?.icon || Bot} size={16} style="color: {botTypes.find((t) => t.v === selectedBot.type)?.color};" />
          <h3 class="text-sm font-bold text-white">{selectedBot.name}</h3>
        </div>
        <button onclick={() => (detailOpen = false)} class="text-slate-400 hover:text-white">✕</button>
      </div>
      <div class="p-4 space-y-3">
        <!-- Big P&L -->
        <div class="text-center py-3">
          <div class="text-[10px] text-slate-500 uppercase mb-1">إجمالي الربح/الخسارة</div>
          <div class="text-3xl font-bold tabular-nums {selectedBot.pnl >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
            {selectedBot.pnl >= 0 ? '+' : ''}{selectedBot.pnl.toFixed(2)}$
          </div>
          <div class="text-sm tabular-nums mt-0.5 {selectedBot.pnlPct >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
            {selectedBot.pnlPct >= 0 ? '+' : ''}{selectedBot.pnlPct.toFixed(2)}%
          </div>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="bg-white/[0.03] rounded-md p-2 text-center">
            <div class="text-[10px] text-slate-500">استثمار</div>
            <div class="font-bold text-white tabular-nums">${selectedBot.invested}</div>
          </div>
          <div class="bg-white/[0.03] rounded-md p-2 text-center">
            <div class="text-[10px] text-slate-500">قيمة حالية</div>
            <div class="font-bold text-white tabular-nums">${selectedBot.currentValue.toFixed(2)}</div>
          </div>
          <div class="bg-white/[0.03] rounded-md p-2 text-center">
            <div class="text-[10px] text-slate-500">صفقات</div>
            <div class="font-bold text-white tabular-nums">{selectedBot.trades}</div>
          </div>
        </div>

        <!-- Config -->
        <div>
          <h4 class="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
            <Settings2 size={12} class="text-accent-gold" /> الإعدادات
          </h4>
          <div class="bg-white/[0.02] rounded-md p-3 space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">النوع</span>
              <span class="font-bold text-white">{selectedBot.type}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">الزوج</span>
              <span class="font-bold text-white">{selectedBot.symbol}</span>
            </div>
            {#if selectedBot.type === 'GRID'}
              <div class="flex items-center justify-between">
                <span class="text-slate-400">النطاق</span>
                <span class="font-mono text-slate-300 tabular-nums">${formatPrice(selectedBot.config.lowerPrice || 0)} - ${formatPrice(selectedBot.config.upperPrice || 0)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">المستويات</span>
                <span class="font-bold text-white">{selectedBot.config.gridCount}</span>
              </div>
            {:else if selectedBot.type === 'DCA'}
              <div class="flex items-center justify-between">
                <span class="text-slate-400">الفاصل</span>
                <span class="font-bold text-white">{selectedBot.config.intervalHours} ساعة</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">لكل أمر</span>
                <span class="font-bold text-white tabular-nums">${selectedBot.config.perOrder}</span>
              </div>
            {:else if selectedBot.type === 'SIGNAL'}
              <div class="flex items-center justify-between">
                <span class="text-slate-400">الاستراتيجية</span>
                <span class="font-bold text-white">{selectedBot.config.strategy}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">الرافعة</span>
                <span class="font-bold text-white">{selectedBot.config.leverage}x</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Logs -->
        <div>
          <h4 class="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
            <Activity size={12} class="text-accent-gold" /> سجل النشاط
          </h4>
          <div class="bg-white/[0.02] rounded-md p-2 max-h-48 overflow-y-auto space-y-1.5">
            {#each selectedBot.logs as log}
              <div class="flex items-start gap-2 text-[11px]">
                <span class="text-[9px] text-slate-500 font-mono mt-0.5">{timeAgoShort(log.time)}</span>
                <span class="{logColor(log.type)} flex-1">{log.msg}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Next action -->
        {#if selectedBot.nextAction && selectedBot.status === 'running'}
          <div class="bg-accent-gold/5 border border-accent-gold/20 rounded-md p-2 flex items-center gap-2">
            <Zap size={12} class="text-accent-gold flex-shrink-0" />
            <div class="flex-1">
              <div class="text-[9px] text-slate-500 uppercase">الإجراء التالي</div>
              <div class="text-[11px] text-slate-200">{selectedBot.nextAction}</div>
            </div>
          </div>
        {/if}

        <div class="flex items-center gap-1.5 pt-2">
          <button
            onclick={() => toggleStatus(selectedBot)}
            class="flex-1 py-2 text-xs font-bold rounded-md {selectedBot.status === 'running' ? 'bg-amber-500/15 text-amber-400' : 'bg-accent-mint/15 text-accent-mint'}"
          >
            {#if selectedBot.status === 'running'}<Pause size={12} class="inline ml-1" /> إيقاف مؤقت{:else}<Play size={12} class="inline ml-1" /> تفعيل{/if}
          </button>
          <button
            onclick={() => { stopBot(selectedBot); detailOpen = false; }}
            class="px-3 py-2 text-xs bg-accent-rose/15 text-accent-rose rounded-md"
          >
            <Square size={12} />
          </button>
          <button
            onclick={() => { deleteBot(selectedBot); detailOpen = false; }}
            class="px-3 py-2 text-xs bg-white/[0.03] text-slate-400 rounded-md hover:bg-accent-rose/15 hover:text-accent-rose"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
