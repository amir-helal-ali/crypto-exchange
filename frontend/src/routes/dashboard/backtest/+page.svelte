<script lang="ts">
  /**
   * Strategy Backtesting — Run historical strategy simulations on real kline data.
   * Built-in strategies:
   *   1) SMA Crossover (fast/slow)
   *   2) RSI Oversold/Overbought
   *   3) MACD Crossover
   *   4) Bollinger Bands Breakout
   * Computes: total return %, win rate, # trades, max drawdown, Sharpe ratio,
   * equity curve, trade list with entry/exit/P&L, and overlays signals on a mini chart.
   */
  import { onMount } from 'svelte';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { formatPrice, formatCompact, formatSymbol, timeAgo } from '$lib/utils/format';
  import {
    FlaskConical, Play, RotateCcw, TrendingUp, TrendingDown,
    Target, Award, Activity, DollarSign, Percent, AlertTriangle,
    BarChart3, ArrowUpRight, ArrowDownRight, Settings2
  } from 'lucide-svelte';

  // --- Inputs ---
  let symbol = $state('BTCUSDT');
  let timeframe = $state('1H');
  let strategy = $state<'sma-cross' | 'rsi' | 'macd-cross' | 'boll-breakout'>('sma-cross');
  let initialCapital = $state(10000);
  let feePct = $state(0.1);
  let fastPeriod = $state(20);
  let slowPeriod = $state(50);
  let rsiPeriod = $state(14);
  let rsiOversold = $state(30);
  let rsiOverbought = $state(70);
  let macdFast = $state(12);
  let macdSlow = $state(26);
  let macdSignal = $state(9);
  let bollPeriod = $state(20);
  let bollStd = $state(2);

  // --- Results ---
  type Trade = {
    index: number;
    time: number;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    exitTime: number;
    qty: number;
    pnl: number;
    pnlPct: number;
    bars: number;
  };

  type EquityPoint = { time: number; equity: number; price: number };

  let trades = $state<Trade[]>([]);
  let equityCurve = $state<EquityPoint[]>([]);
  let priceData = $state<number[]>([]);
  let signalPoints = $state<{ time: number; price: number; type: 'BUY' | 'SELL' }[]>([]);
  let running = $state(false);
  let hasRun = $state(false);

  // --- Indicators (re-implemented lightweight) ---
  function sma(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      out.push(sum / period);
    }
    return out;
  }

  function ema(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [];
    const k = 2 / (period + 1);
    let prev: number | null = null;
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      if (prev === null) {
        // Seed with SMA
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        prev = sum / period;
        out.push(prev);
      } else {
        prev = values[i] * k + prev * (1 - k);
        out.push(prev);
      }
    }
    return out;
  }

  function rsi(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [];
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < values.length; i++) {
      if (i === 0) { out.push(null); continue; }
      const change = values[i] - values[i - 1];
      const gain = Math.max(0, change);
      const loss = Math.max(0, -change);
      if (i <= period - 1) {
        avgGain += gain;
        avgLoss += loss;
        if (i === period - 1) {
          avgGain /= period;
          avgLoss /= period;
          const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
          out.push(100 - 100 / (1 + rs));
        } else {
          out.push(null);
        }
      } else {
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      }
    }
    return out;
  }

  function macd(values: number[], fast: number, slow: number, signal: number) {
    const ef = ema(values, fast);
    const es = ema(values, slow);
    const line: (number | null)[] = values.map((_, i) =>
      ef[i] !== null && es[i] !== null ? (ef[i] as number) - (es[i] as number) : null
    );
    // Signal = EMA of line (filter nulls)
    const filtered: number[] = [];
    const startIdx: number[] = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== null) { filtered.push(line[i] as number); startIdx.push(i); }
    }
    const sigFiltered = ema(filtered, signal);
    const signalLine: (number | null)[] = new Array(values.length).fill(null);
    for (let i = 0; i < sigFiltered.length; i++) {
      if (sigFiltered[i] !== null) signalLine[startIdx[i]] = sigFiltered[i];
    }
    return { line, signalLine };
  }

  function bollinger(values: number[], period: number, std: number) {
    const mid = sma(values, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1 || mid[i] === null) {
        upper.push(null); lower.push(null); continue;
      }
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += Math.pow(values[j] - (mid[i] as number), 2);
      }
      const sd = Math.sqrt(sumSq / period);
      upper.push((mid[i] as number) + sd * std);
      lower.push((mid[i] as number) - sd * std);
    }
    return { mid, upper, lower };
  }

  // --- Backtest engine ---
  async function runBacktest() {
    running = true;
    hasRun = false;
    trades = [];
    equityCurve = [];
    signalPoints = [];

    const klines = await nexusMarket.getKlines(symbol, timeframe, 500);
    if (klines.length < 50) {
      running = false;
      return;
    }

    const closes = klines.map((k: any) => k.close);
    priceData = closes;

    // Generate signal series: +1 = BUY, -1 = SELL, 0 = HOLD
    const signals: number[] = new Array(closes.length).fill(0);

    if (strategy === 'sma-cross') {
      const fast = sma(closes, fastPeriod);
      const slow = sma(closes, slowPeriod);
      for (let i = 1; i < closes.length; i++) {
        if (fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) continue;
        const prevDiff = (fast[i - 1] as number) - (slow[i - 1] as number);
        const currDiff = (fast[i] as number) - (slow[i] as number);
        if (prevDiff <= 0 && currDiff > 0) signals[i] = 1;
        else if (prevDiff >= 0 && currDiff < 0) signals[i] = -1;
      }
    } else if (strategy === 'rsi') {
      const r = rsi(closes, rsiPeriod);
      let wasOversold = false;
      let wasOverbought = false;
      for (let i = 0; i < closes.length; i++) {
        if (r[i] === null) continue;
        const val = r[i] as number;
        if (val < rsiOversold) { wasOversold = true; wasOverbought = false; }
        if (val > rsiOverbought) { wasOverbought = true; wasOversold = false; }
        // BUY when RSI crosses back above oversold
        if (wasOversold && val > rsiOversold) { signals[i] = 1; wasOversold = false; }
        // SELL when RSI crosses back below overbought
        else if (wasOverbought && val < rsiOverbought) { signals[i] = -1; wasOverbought = false; }
      }
    } else if (strategy === 'macd-cross') {
      const { line, signalLine } = macd(closes, macdFast, macdSlow, macdSignal);
      for (let i = 1; i < closes.length; i++) {
        if (line[i] === null || signalLine[i] === null || line[i - 1] === null || signalLine[i - 1] === null) continue;
        const prevDiff = (line[i - 1] as number) - (signalLine[i - 1] as number);
        const currDiff = (line[i] as number) - (signalLine[i] as number);
        if (prevDiff <= 0 && currDiff > 0) signals[i] = 1;
        else if (prevDiff >= 0 && currDiff < 0) signals[i] = -1;
      }
    } else if (strategy === 'boll-breakout') {
      const { upper, lower, mid } = bollinger(closes, bollPeriod, bollStd);
      for (let i = 1; i < closes.length; i++) {
        if (upper[i] === null || lower[i] === null || upper[i - 1] === null) continue;
        // BUY when price breaks above upper band (breakout long)
        if (closes[i - 1] <= (upper[i - 1] as number) && closes[i] > (upper[i] as number)) signals[i] = 1;
        // SELL when price breaks below lower band (breakdown)
        else if (closes[i - 1] >= (lower[i - 1] as number) && closes[i] < (lower[i] as number)) signals[i] = -1;
        // Exit when price returns to middle
        else if (mid[i] !== null) {
          if (closes[i - 1] > (mid[i - 1] as number) && closes[i] <= (mid[i] as number)) signals[i] = -1;
          else if (closes[i - 1] < (mid[i - 1] as number) && closes[i] >= (mid[i] as number)) signals[i] = 1;
        }
      }
    }

    // Simulate trades — go LONG on +1, exit on -1
    let position: { entryIndex: number; entryPrice: number; qty: number } | null = null;
    let cash = initialCapital;
    const eqCurve: EquityPoint[] = [];
    const newTrades: Trade[] = [];

    for (let i = 0; i < closes.length; i++) {
      const price = closes[i];
      // Open LONG
      if (signals[i] === 1 && !position) {
        const fee = cash * (feePct / 100);
        const investable = cash - fee;
        const qty = investable / price;
        position = { entryIndex: i, entryPrice: price, qty };
        cash = 0;
        signalPoints.push({ time: klines[i].time, price, type: 'BUY' });
      }
      // Close LONG
      else if (signals[i] === -1 && position) {
        const proceeds = position.qty * price;
        const fee = proceeds * (feePct / 100);
        cash = proceeds - fee;
        const pnl = cash - initialCapital * (position.qty * position.entryPrice / initialCapital);
        const cost = position.qty * position.entryPrice;
        const net = proceeds - fee - cost;
        newTrades.push({
          index: newTrades.length + 1,
          time: klines[position.entryIndex].time,
          side: 'LONG',
          entryPrice: position.entryPrice,
          exitPrice: price,
          exitTime: klines[i].time,
          qty: position.qty,
          pnl: net,
          pnlPct: (net / cost) * 100,
          bars: i - position.entryIndex
        });
        signalPoints.push({ time: klines[i].time, price, type: 'SELL' });
        position = null;
      }
      // Mark-to-market equity
      const equity = position ? position.qty * price : cash;
      eqCurve.push({ time: klines[i].time, equity, price });
    }
    // Close any open position at last price
    if (position) {
      const lastIdx = closes.length - 1;
      const price = closes[lastIdx];
      const proceeds = position.qty * price;
      const fee = proceeds * (feePct / 100);
      cash = proceeds - fee;
      const cost = position.qty * position.entryPrice;
      const net = proceeds - fee - cost;
      newTrades.push({
        index: newTrades.length + 1,
        time: klines[position.entryIndex].time,
        side: 'LONG',
        entryPrice: position.entryPrice,
        exitPrice: price,
        exitTime: klines[lastIdx].time,
        qty: position.qty,
        pnl: net,
        pnlPct: (net / cost) * 100,
        bars: lastIdx - position.entryIndex
      });
    }

    trades = newTrades;
    equityCurve = eqCurve;
    running = false;
    hasRun = true;
  }

  // --- Performance metrics ---
  const finalEquity = $derived(equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital);
  const totalReturnPct = $derived(((finalEquity - initialCapital) / initialCapital) * 100);
  const winCount = $derived(trades.filter((t) => t.pnl > 0).length);
  const lossCount = $derived(trades.filter((t) => t.pnl <= 0).length);
  const winRate = $derived(trades.length > 0 ? (winCount / trades.length) * 100 : 0);
  const avgWin = $derived(winCount > 0 ? trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / winCount : 0);
  const avgLoss = $derived(lossCount > 0 ? Math.abs(trades.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0) / lossCount) : 0);
  const profitFactor = $derived(avgLoss > 0 ? (avgWin * winCount) / (avgLoss * lossCount) : (winCount > 0 ? Infinity : 0));
  const maxDrawdown = $derived.by(() => {
    let peak = -Infinity;
    let maxDD = 0;
    for (const p of equityCurve) {
      if (p.equity > peak) peak = p.equity;
      const dd = (peak - p.equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD * 100;
  });

  // Buy & hold benchmark
  const buyHoldReturn = $derived.by(() => {
    if (priceData.length < 2) return 0;
    const first = priceData[0];
    const last = priceData[priceData.length - 1];
    return ((last - first) / first) * 100;
  });

  // Sharpe ratio (per-bar returns, annualized by sqrt of bars per year — approx)
  const sharpe = $derived.by(() => {
    if (equityCurve.length < 2) return 0;
    const rets: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      rets.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity);
    }
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const variance = rets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / rets.length;
    const sd = Math.sqrt(variance);
    if (sd === 0) return 0;
    // Rough annualization: bars/year ~ 365*24 for 1H, 365*24*4 for 15m, etc.
    const barsPerYear: Record<string, number> = { '1m': 525600, '5m': 105120, '15m': 35040, '1H': 8760, '4H': 2190, '1D': 365, '1W': 52 };
    const bpv = barsPerYear[timeframe] || 365;
    return (mean / sd) * Math.sqrt(bpv);
  });

  // Equity curve SVG path
  const equityPath = $derived.by(() => {
    if (equityCurve.length < 2) return '';
    const w = 800;
    const h = 200;
    const max = Math.max(...equityCurve.map((p) => p.equity));
    const min = Math.min(...equityCurve.map((p) => p.equity));
    const range = max - min || 1;
    return equityCurve.map((p, i) => {
      const x = (i / (equityCurve.length - 1)) * w;
      const y = h - ((p.equity - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  const pricePath = $derived.by(() => {
    if (priceData.length < 2) return '';
    const w = 800;
    const h = 200;
    const max = Math.max(...priceData);
    const min = Math.min(...priceData);
    const range = max - min || 1;
    return priceData.map((p, i) => {
      const x = (i / (priceData.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  // Equity curve area fill path
  const equityAreaPath = $derived.by(() => {
    if (!equityPath) return '';
    return `${equityPath} L800,200 L0,200 Z`;
  });

  const strategies = [
    { v: 'sma-cross', l: 'تقاطع SMA', desc: 'شراء عند تقاطع السريع فوق البطيء، بيع عند العكس' },
    { v: 'rsi', l: 'RSI تشبع', desc: 'شراء عند الخروج من التشبع البيعي، بيع عند الخروج من التشبع الشرائي' },
    { v: 'macd-cross', l: 'تقاطع MACD', desc: 'شراء عند تقاطع الخط فوق خط الإشارة، بيع عند العكس' },
    { v: 'boll-breakout', l: 'اختراق بولينجر', desc: 'شراء عند اختراق النطاق العلوي، بيع عند العودة للوسط' }
  ];

  onMount(() => {
    runBacktest();
  });
</script>

<svelte:head><title>اختبار الاستراتيجيات — NEXUS</title></svelte:head>

<div class="space-y-4 pb-20 lg:pb-0 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/7 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="panel p-4 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
    <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
    <div class="relative flex items-center gap-3">
      <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/25 flex items-center justify-center shrink-0">
        <div class="absolute inset-0 bg-accent-gold/15 blur-xl rounded-xl"></div>
        <FlaskConical size={20} class="relative text-accent-gold" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-tight">اختبار الاستراتيجيات</h1>
        <p class="text-[11px] text-slate-400 mt-0.5">اختبر استراتيجيات التداول على بيانات تاريخية حقيقية واحسب الأداء</p>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">
    <!-- Config panel -->
    <div class="panel p-4 space-y-3 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
      <h3 class="relative text-sm font-bold text-white flex items-center gap-2 tracking-tight">
        <div class="w-7 h-7 rounded-lg bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
          <Settings2 size={14} class="text-accent-violet" />
        </div>
        إعدادات الاختبار
      </h3>

      <div>
        <label class="text-[11px] text-slate-400 block mb-1">الزوج</label>
        <select bind:value={symbol} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-2 text-xs text-white focus:outline-none focus:border-accent-gold/40">
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="BNBUSDT">BNB/USDT</option>
          <option value="SOLUSDT">SOL/USDT</option>
          <option value="XRPUSDT">XRP/USDT</option>
          <option value="ADAUSDT">ADA/USDT</option>
          <option value="DOGEUSDT">DOGE/USDT</option>
        </select>
      </div>

      <div>
        <label class="text-[11px] text-slate-400 block mb-1">الإطار الزمني</label>
        <div class="grid grid-cols-4 gap-1">
          {#each ['15m', '1H', '4H', '1D'] as tf}
            <button
              onclick={() => (timeframe = tf)}
              class="py-1.5 text-xs rounded-md transition-colors {timeframe === tf ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5 border border-transparent'}"
            >{tf}</button>
          {/each}
        </div>
      </div>

      <div>
        <label class="text-[11px] text-slate-400 block mb-1">الاستراتيجية</label>
        <select bind:value={strategy} class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-2 text-xs text-white focus:outline-none">
          {#each strategies as s}
            <option value={s.v}>{s.l}</option>
          {/each}
        </select>
        <p class="text-[10px] text-slate-500 mt-1 leading-relaxed">
          {strategies.find((s) => s.v === strategy)?.desc}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">رأس المال ($)</label>
          <input type="number" bind:value={initialCapital} min="100" step="100" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
        </div>
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">العمولة (%)</label>
          <input type="number" bind:value={feePct} min="0" max="1" step="0.05" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-gold/40" />
        </div>
      </div>

      <!-- Strategy-specific params -->
      {#if strategy === 'sma-cross'}
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">SMA سريعة</label>
            <input type="number" bind:value={fastPeriod} min="2" max="200" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">SMA بطيئة</label>
            <input type="number" bind:value={slowPeriod} min="5" max="400" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
        </div>
      {:else if strategy === 'rsi'}
        <div class="space-y-2 pt-2 border-t border-white/5">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">فترة RSI</label>
            <input type="number" bind:value={rsiPeriod} min="2" max="50" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">تشبع بيعي</label>
              <input type="number" bind:value={rsiOversold} min="5" max="50" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
            </div>
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">تشبع شرائي</label>
              <input type="number" bind:value={rsiOverbought} min="50" max="95" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
            </div>
          </div>
        </div>
      {:else if strategy === 'macd-cross'}
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">سريع</label>
            <input type="number" bind:value={macdFast} min="2" max="50" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">بطيء</label>
            <input type="number" bind:value={macdSlow} min="5" max="200" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">إشارة</label>
            <input type="number" bind:value={macdSignal} min="2" max="50" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
        </div>
      {:else if strategy === 'boll-breakout'}
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">الفترة</label>
            <input type="number" bind:value={bollPeriod} min="5" max="100" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
          <div>
            <label class="text-[11px] text-slate-400 block mb-1">الانحراف</label>
            <input type="number" bind:value={bollStd} min="1" max="4" step="0.5" class="w-full bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none" />
          </div>
        </div>
      {/if}

      <button
        onclick={runBacktest}
        disabled={running}
        class="btn-primary w-full py-2.5 mt-2 text-sm"
      >
        {#if running}
          <div class="w-4 h-4 border-2 border-ink-950 border-t-transparent rounded-full animate-spin"></div>
          جاري الاختبار...
        {:else}
          <Play size={14} /> تشغيل الاختبار
        {/if}
      </button>
    </div>

    <!-- Results panel -->
    <div class="space-y-3">
      {#if hasRun}
        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="panel p-3 relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-16 h-16 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
            <div class="relative flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <DollarSign size={10} /> العائد الإجمالي
            </div>
            <div class="relative text-lg font-bold {totalReturnPct >= 0 ? 'text-accent-mint' : 'text-accent-rose'} tabular-nums">
              {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
            </div>
            <div class="relative text-[10px] text-slate-400 mt-0.5 font-mono tabular-nums">${finalEquity.toFixed(2)}</div>
          </div>
          <div class="panel p-3 relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-16 h-16 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
            <div class="relative flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <Target size={10} /> معدل الربح
            </div>
            <div class="relative text-lg font-bold text-white tabular-nums">{winRate.toFixed(1)}%</div>
            <div class="relative text-[10px] text-slate-400 mt-0.5 tabular-nums">{winCount}W / {lossCount}L</div>
          </div>
          <div class="panel p-3 relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-16 h-16 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
            <div class="relative flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <AlertTriangle size={10} /> أقصى تراجع
            </div>
            <div class="relative text-lg font-bold text-accent-rose tabular-nums">-{maxDrawdown.toFixed(2)}%</div>
            <div class="relative text-[10px] text-slate-400 mt-0.5">Max Drawdown</div>
          </div>
          <div class="panel p-3 relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-16 h-16 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
            <div class="relative flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              <Award size={10} /> عامل الربح
            </div>
            <div class="relative text-lg font-bold text-white tabular-nums">{profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}</div>
            <div class="relative text-[10px] text-slate-400 mt-0.5">Profit Factor</div>
          </div>
        </div>

        <!-- Equity curve + price chart -->
        <div class="panel p-4 relative overflow-hidden">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
          <div class="relative flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
              <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
                <BarChart3 size={14} class="text-accent-gold" />
              </div>
              منحنى رأس المال
            </h3>
            <div class="flex items-center gap-3 text-[10px]">
              <span class="flex items-center gap-1 text-accent-gold"><span class="w-2 h-2 rounded-sm bg-accent-gold"></span> رأس المال</span>
              <span class="flex items-center gap-1 text-slate-400"><span class="w-2 h-2 rounded-sm bg-slate-500"></span> السعر</span>
            </div>
          </div>
          <div class="relative w-full" style="height: 200px;">
            <svg viewBox="0 0 800 200" preserveAspectRatio="none" class="w-full h-full">
              <!-- Price line (background) -->
              {#if pricePath}
                <path d={pricePath} fill="none" stroke="rgba(100,116,139,0.4)" stroke-width="1" />
              {/if}
              <!-- Equity area -->
              {#if equityAreaPath}
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color={totalReturnPct >= 0 ? '#22d3a4' : '#f43f7a'} stop-opacity="0.35" />
                    <stop offset="100%" stop-color={totalReturnPct >= 0 ? '#22d3a4' : '#f43f7a'} stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path d={equityAreaPath} fill="url(#eqGrad)" />
                <path d={equityPath} fill="none" stroke={totalReturnPct >= 0 ? '#22d3a4' : '#f43f7a'} stroke-width="2" />
              {/if}
              <!-- Signal markers (BUY/SELL) -->
              {#each signalPoints as sp, i}
                {@const x = (i / Math.max(1, signalPoints.length - 1)) * 800}
                {@const y = 200 - ((sp.price - Math.min(...priceData)) / (Math.max(...priceData) - Math.min(...priceData) || 1)) * 200}
                <circle cx={x} cy={y} r="3" fill={sp.type === 'BUY' ? '#22d3a4' : '#f43f7a'} stroke="#fff" stroke-width="0.5" />
              {/each}
            </svg>
          </div>
          <div class="flex items-center justify-between mt-2 text-[10px] text-slate-500">
            <span>البداية: ${initialCapital.toFixed(0)}</span>
            <span>النهاية: ${finalEquity.toFixed(2)}</span>
          </div>
        </div>

        <!-- Comparison + metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="panel p-4 relative overflow-hidden">
            <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.3), transparent);"></div>
            <h3 class="relative text-sm font-bold text-white mb-3 flex items-center gap-2 tracking-tight">
              <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
                <Activity size={14} class="text-accent-mint" />
              </div>
              مقارنة الأداء
            </h3>
            <div class="relative space-y-2">
              <div class="flex items-center justify-between p-2 rounded-md bg-white/[0.02] border border-white/5">
                <span class="text-xs text-slate-400">عائد الاستراتيجية</span>
                <span class="text-sm font-bold tabular-nums {totalReturnPct >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                  {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                </span>
              </div>
              <div class="flex items-center justify-between p-2 rounded-md bg-white/[0.02] border border-white/5">
                <span class="text-xs text-slate-400">عائد الشراء والاحتفاظ</span>
                <span class="text-sm font-bold tabular-nums {buyHoldReturn >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                  {buyHoldReturn >= 0 ? '+' : ''}{buyHoldReturn.toFixed(2)}%
                </span>
              </div>
              <div class="flex items-center justify-between p-2 rounded-md bg-accent-gold/5 border border-accent-gold/15">
                <span class="text-xs text-slate-300">الفارق</span>
                <span class="text-sm font-bold tabular-nums text-accent-gold">
                  {(totalReturnPct - buyHoldReturn >= 0 ? '+' : '')}{(totalReturnPct - buyHoldReturn).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div class="panel p-4 relative overflow-hidden">
            <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
            <h3 class="relative text-sm font-bold text-white mb-3 flex items-center gap-2 tracking-tight">
              <div class="w-7 h-7 rounded-lg bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
                <Percent size={14} class="text-accent-violet" />
              </div>
              إحصائيات تفصيلية
            </h3>
            <div class="relative grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 rounded-md bg-white/[0.02] border border-white/5">
                <div class="text-[10px] text-slate-500">عدد الصفقات</div>
                <div class="font-bold text-white tabular-nums">{trades.length}</div>
              </div>
              <div class="p-2 rounded-md bg-white/[0.02] border border-white/5">
                <div class="text-[10px] text-slate-500">معامل شارب</div>
                <div class="font-bold text-white tabular-nums">{sharpe.toFixed(2)}</div>
              </div>
              <div class="p-2 rounded-md bg-white/[0.02] border border-white/5">
                <div class="text-[10px] text-slate-500">متوسط الربح</div>
                <div class="font-bold text-accent-mint tabular-nums">+${avgWin.toFixed(2)}</div>
              </div>
              <div class="p-2 rounded-md bg-white/[0.02] border border-white/5">
                <div class="text-[10px] text-slate-500">متوسط الخسارة</div>
                <div class="font-bold text-accent-rose tabular-nums">-${avgLoss.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Trades table -->
        <div class="panel overflow-hidden relative">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
          <div class="relative px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
              <BarChart3 size={14} class="text-accent-gold" />
            </div>
            <h3 class="text-sm font-bold text-white tracking-tight">سجل الصفقات <span class="text-[10px] text-slate-500 tabular-nums">({trades.length})</span></h3>
          </div>
          {#if trades.length === 0}
            <div class="py-8 text-center text-slate-500 text-sm">لا توجد صفقات منفذة في هذه الفترة</div>
          {:else}
            <div class="overflow-x-auto max-h-96">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-ink-900">
                  <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                    <th class="text-right font-medium px-3 py-2">#</th>
                    <th class="text-right font-medium px-3 py-2">دخول</th>
                    <th class="text-right font-medium px-3 py-2">خروج</th>
                    <th class="text-right font-medium px-3 py-2">سعر الدخول</th>
                    <th class="text-right font-medium px-3 py-2">سعر الخروج</th>
                    <th class="text-right font-medium px-3 py-2">الكمية</th>
                    <th class="text-right font-medium px-3 py-2">شمعات</th>
                    <th class="text-left font-medium px-3 py-2">الربح/الخسارة</th>
                  </tr>
                </thead>
                <tbody>
                  {#each trades.slice().reverse() as t}
                    <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td class="px-3 py-2 text-slate-400 font-mono">#{t.index}</td>
                      <td class="px-3 py-2 text-slate-300 font-mono text-[10px]">{new Date(t.time).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</td>
                      <td class="px-3 py-2 text-slate-300 font-mono text-[10px]">{new Date(t.exitTime).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</td>
                      <td class="px-3 py-2 font-mono text-slate-300 tabular-nums">${formatPrice(t.entryPrice)}</td>
                      <td class="px-3 py-2 font-mono text-slate-300 tabular-nums">${formatPrice(t.exitPrice)}</td>
                      <td class="px-3 py-2 font-mono text-slate-400 tabular-nums">{t.qty.toFixed(6)}</td>
                      <td class="px-3 py-2 text-slate-400 tabular-nums">{t.bars}</td>
                      <td class="px-3 py-2 text-left">
                        <span class="font-mono font-bold tabular-nums {t.pnl >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                          {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}$
                        </span>
                        <span class="block text-[10px] tabular-nums {t.pnlPct >= 0 ? 'text-accent-mint/70' : 'text-accent-rose/70'}">
                          {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {:else if running}
        <div class="panel p-12 text-center relative overflow-hidden">
          <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/8 blur-3xl rounded-full"></div>
          <div class="relative inline-block w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
          <p class="relative mt-3 text-slate-400 text-sm">جاري تشغيل الاختبار...</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="panel p-3 border-accent-gold/20 bg-accent-gold/5 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="relative flex items-start gap-2">
      <AlertTriangle size={14} class="text-accent-gold flex-shrink-0 mt-0.5" />
      <p class="text-[11px] text-accent-gold/80 leading-relaxed">
        <strong class="text-accent-gold">تنبيه:</strong>
        نتائج الاختبار التاريخي لا تضمن الأداء المستقبلي. الأداء المحسوب هنا لا يأخذ في الاعتبار الانزلاق السعري (slippage) أو تأثير حجم الأمر على السوق. استخدم هذه الأداة لأغراض تعليمية وبحثية فقط.
      </p>
    </div>
  </div>
</div>
