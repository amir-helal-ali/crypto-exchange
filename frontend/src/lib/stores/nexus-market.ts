/**
 * NEXUS Market Data — single source of truth for all live market data.
 *
 * ARCHITECTURE
 * ------------
 * ONE persistent WebSocket connection to /ws/market carries every channel
 * for every symbol the UI currently cares about. Subscriptions are managed
 * dynamically by sending JSON messages:
 *
 *   { "action": "subscribe",   "symbols": ["BTCUSDT","ETHUSDT"],
 *     "channels": ["ticker","trade","depth","kline_1m"] }
 *
 * The server pushes back typed messages:
 *
 *   { "type": "ticker",  "symbol": "BTCUSDT", "data": { ... } }
 *   { "type": "kline",   "symbol": "BTCUSDT", "data": { ... } }
 *   { "type": "trade",   "symbol": "BTCUSDT", "data": { ... } }
 *   { "type": "depth",   "symbol": "BTCUSDT", "data": { ... } }
 *   { "type": "trades_snapshot", "symbol": "BTCUSDT", "data": [ ... ] }
 *
 * NO setInterval cycling. NO polling. Everything is push-based.
 *
 * If the WebSocket drops, a single reconnect re-establishes ALL
 * subscriptions atomically — the server even re-sends bootstrap
 * snapshots on subscribe, so the UI never shows stale data.
 */
import { browser } from '$app/environment';
import { API_BASE } from '$lib/api/client';
import { marketStore, type MarketTicker } from '$lib/stores/market';

export interface NexusTick {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  ts: number;
}

export interface NexusKline {
  symbol: string;
  interval: string;
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
}

export interface NexusTrade {
  symbol: string;
  id: number;
  price: number;
  qty: number;
  side: 'BUY' | 'SELL';
  time: number;
}

export interface NexusOrderbook {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  ts: number;
}

type TickerListener = (tick: NexusTick) => void;
type KlineListener = (k: NexusKline) => void;
type TradeListener = (t: NexusTrade) => void;
type OrderbookListener = (ob: NexusOrderbook) => void;

const CHANNEL_TICKER = 'ticker';
const CHANNEL_TRADE = 'trade';
const CHANNEL_DEPTH = 'depth';

function klineChannel(interval: string) {
  return `kline_${interval}`;
}

class NexusMarketFeed {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;

  // Listeners
  private tickerListeners = new Map<string, Set<TickerListener>>(); // symbol → listeners
  private globalTickerListeners = new Set<TickerListener>();
  private klineListeners = new Map<string, Set<KlineListener>>(); // symbol:interval → listeners
  private tradeListeners = new Map<string, Set<TradeListener>>(); // symbol → listeners
  private orderbookListeners = new Map<string, Set<OrderbookListener>>(); // symbol → listeners

  // Pending subscriptions to (re-)send on connect
  private desiredSubs = new Map<string, Set<string>>(); // symbol → set of channels

  /**
   * Subscribe to live ticker updates for a specific symbol.
   * Returns an unsubscribe function.
   */
  subscribe(symbol: string, fn: TickerListener): () => void {
    if (!browser) return () => {};
    const sym = symbol.toUpperCase();
    if (!this.tickerListeners.has(sym)) this.tickerListeners.set(sym, new Set());
    this.tickerListeners.get(sym)!.add(fn);
    this.addSubscription(sym, CHANNEL_TICKER);
    return () => {
      this.tickerListeners.get(sym)?.delete(fn);
      if (this.tickerListeners.get(sym)?.size === 0) {
        this.tickerListeners.delete(sym);
        this.removeSubscription(sym, CHANNEL_TICKER);
      }
    };
  }

  /**
   * Subscribe to ALL ticker updates regardless of symbol.
   */
  subscribeAll(fn: TickerListener): () => void {
    if (!browser) return () => {};
    this.globalTickerListeners.add(fn);
    // Subscribe to a default basket so we always get some data even if
    // no per-symbol subscribers exist yet
    for (const sym of DEFAULT_BASKET) {
      this.addSubscription(sym, CHANNEL_TICKER);
    }
    return () => {
      this.globalTickerListeners.delete(fn);
    };
  }

  /**
   * Subscribe to live kline updates for symbol+interval.
   */
  subscribeKlines(symbol: string, interval: string, fn: KlineListener): () => void {
    if (!browser) return () => {};
    const sym = symbol.toUpperCase();
    const key = `${sym}:${interval}`;
    if (!this.klineListeners.has(key)) this.klineListeners.set(key, new Set());
    this.klineListeners.get(key)!.add(fn);
    this.addSubscription(sym, klineChannel(interval));
    return () => {
      this.klineListeners.get(key)?.delete(fn);
      if (this.klineListeners.get(key)?.size === 0) {
        this.klineListeners.delete(key);
        this.removeSubscription(sym, klineChannel(interval));
      }
    };
  }

  /**
   * Subscribe to live trades for a symbol.
   */
  subscribeTrades(symbol: string, fn: TradeListener): () => void {
    if (!browser) return () => {};
    const sym = symbol.toUpperCase();
    if (!this.tradeListeners.has(sym)) this.tradeListeners.set(sym, new Set());
    this.tradeListeners.get(sym)!.add(fn);
    this.addSubscription(sym, CHANNEL_TRADE);
    return () => {
      this.tradeListeners.get(sym)?.delete(fn);
      if (this.tradeListeners.get(sym)?.size === 0) {
        this.tradeListeners.delete(sym);
        this.removeSubscription(sym, CHANNEL_TRADE);
      }
    };
  }

  /**
   * Subscribe to live orderbook updates for a symbol.
   */
  subscribeOrderbook(symbol: string, fn: OrderbookListener): () => void {
    if (!browser) return () => {};
    const sym = symbol.toUpperCase();
    if (!this.orderbookListeners.has(sym)) this.orderbookListeners.set(sym, new Set());
    this.orderbookListeners.get(sym)!.add(fn);
    this.addSubscription(sym, CHANNEL_DEPTH);
    return () => {
      this.orderbookListeners.get(sym)?.delete(fn);
      if (this.orderbookListeners.get(sym)?.size === 0) {
        this.orderbookListeners.delete(sym);
        this.removeSubscription(sym, CHANNEL_DEPTH);
      }
    };
  }

  // ── Subscription book-keeping ────────────────────────────────────────

  private addSubscription(symbol: string, channel: string) {
    if (!this.desiredSubs.has(symbol)) this.desiredSubs.set(symbol, new Set());
    const wasNew = !this.desiredSubs.get(symbol)!.has(channel);
    this.desiredSubs.get(symbol)!.add(channel);
    if (wasNew) this.sendSubscriptionUpdate();
    this.ensureConnected();
  }

  private removeSubscription(symbol: string, channel: string) {
    const chans = this.desiredSubs.get(symbol);
    if (!chans) return;
    chans.delete(channel);
    if (chans.size === 0) this.desiredSubs.delete(symbol);
    this.sendSubscriptionUpdate();
    // If nothing left at all, close the socket
    if (this.desiredSubs.size === 0) this.disconnect();
  }

  private sendSubscriptionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const symbols = Array.from(this.desiredSubs.keys());
    if (symbols.length === 0) return;
    // Collect unique channels across all symbols
    const channelSet = new Set<string>();
    for (const chans of this.desiredSubs.values()) {
      for (const c of chans) channelSet.add(c);
    }
    const channels = Array.from(channelSet);
    try {
      this.ws.send(JSON.stringify({ action: 'subscribe', symbols, channels }));
    } catch {}
  }

  // ── Connection management ────────────────────────────────────────────

  private ensureConnected() {
    if (!browser) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.isConnecting) return;
    this.connect();
  }

  private connect() {
    if (!browser) return;
    this.isConnecting = true;
    try {
      this.ws?.close();
    } catch {}
    const wsBase = API_BASE.replace(/^http/, 'ws');
    try {
      // Pre-subscribe via query string so we get data immediately on open
      const symbols = Array.from(this.desiredSubs.keys());
      const channelSet = new Set<string>();
      for (const chans of this.desiredSubs.values()) {
        for (const c of chans) channelSet.add(c);
      }
      const params = new URLSearchParams();
      if (symbols.length > 0) {
        params.set('symbols', symbols.join(','));
        params.set('channels', Array.from(channelSet).join(','));
      }
      const url = `${wsBase}/ws/market${symbols.length > 0 ? `?${params.toString()}` : ''}`;
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        // Re-send all desired subscriptions (in case pre-subscribe was incomplete)
        this.sendSubscriptionUpdate();
      };
      this.ws.onmessage = (ev) => this.handleMessage(ev);
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        if (this.desiredSubs.size > 0) {
          const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 10000);
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
        }
      };
      this.ws.onerror = () => {
        // onclose handles reconnect
      };
    } catch {
      this.isConnecting = false;
    }
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }

  // ── Message routing ──────────────────────────────────────────────────

  private handleMessage(ev: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!msg || !msg.type) return;
    const symbol = (msg.symbol || msg.sym || '').toUpperCase();

    switch (msg.type) {
      case 'ticker': {
        const d = msg.data || {};
        if (!d.symbol || typeof d.price !== 'number') return;
        const tick: NexusTick = {
          symbol: d.symbol,
          price: d.price,
          change24h: d.change_24h ?? d.change24h ?? 0,
          high24h: d.high_24h ?? d.high24h ?? 0,
          low24h: d.low_24h ?? d.low24h ?? 0,
          volume24h: d.volume_24h ?? d.volume24h ?? 0,
          ts: d.ts ?? Date.now()
        };
        // Update shared store
        marketStore.updateTicker(tick.symbol, {
          symbol: tick.symbol,
          price: tick.price,
          change24h: tick.change24h,
          high24h: tick.high24h,
          low24h: tick.low24h,
          volume24h: tick.volume24h
        });
        // Notify specific listeners
        this.tickerListeners.get(tick.symbol)?.forEach((fn) => {
          try { fn(tick); } catch {}
        });
        // Notify global listeners
        this.globalTickerListeners.forEach((fn) => {
          try { fn(tick); } catch {}
        });
        break;
      }
      case 'kline': {
        const d = msg.data || {};
        if (!d.symbol) return;
        const k: NexusKline = {
          symbol: d.symbol,
          interval: d.interval,
          time: d.time,
          open: +d.open,
          high: +d.high,
          low: +d.low,
          close: +d.close,
          volume: +d.volume,
          closed: !!d.closed
        };
        const key = `${k.symbol}:${k.interval}`;
        this.klineListeners.get(key)?.forEach((fn) => {
          try { fn(k); } catch {}
        });
        break;
      }
      case 'trade': {
        const d = msg.data || {};
        if (!d.symbol) return;
        const t: NexusTrade = {
          symbol: d.symbol,
          id: d.id || d.time || Date.now(),
          price: +d.price,
          qty: +d.qty,
          side: d.side === 'SELL' ? 'SELL' : 'BUY',
          time: d.time || Date.now()
        };
        this.tradeListeners.get(t.symbol)?.forEach((fn) => {
          try { fn(t); } catch {}
        });
        break;
      }
      case 'trades_snapshot': {
        // Initial bootstrap of last N trades
        const trades = (msg.data || []) as NexusTrade[];
        if (trades.length === 0) return;
        // Replay oldest → newest
        trades
          .slice()
          .reverse()
          .forEach((t) => {
            this.tradeListeners.get(t.symbol)?.forEach((fn) => {
              try { fn(t); } catch {}
            });
          });
        break;
      }
      case 'depth': {
        const d = msg.data || {};
        if (!d.symbol) return;
        const ob: NexusOrderbook = {
          symbol: d.symbol,
          bids: (d.bids || []).map((b: any[]) => [+b[0], +b[1]]),
          asks: (d.asks || []).map((a: any[]) => [+a[0], +a[1]]),
          ts: d.ts || Date.now()
        };
        this.orderbookListeners.get(ob.symbol)?.forEach((fn) => {
          try { fn(ob); } catch {}
        });
        break;
      }
    }
  }

  // ── REST convenience methods (one-shot snapshots only) ───────────────

  /**
   * switchSymbol — DEPRECATED no-op kept for backwards compatibility.
   *
   * The new hub-based subscription model auto-subscribes per symbol when
   * you call `subscribe()` / `subscribeTrades()` / etc. There is no longer
   * a single "current symbol" — multiple symbols can be live at once.
   */
  switchSymbol(_symbol: string) {
    /* no-op — subscriptions are managed automatically */
  }

  /** Snapshot: fetch current price for a symbol via REST (no subscribe) */
  async getTicker(symbol: string): Promise<NexusTick | null> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/tickers`);
      if (!res.ok) return null;
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];
      const d = all.find((x: any) => x.symbol === symbol);
      if (!d) return null;
      return {
        symbol: d.symbol,
        price: d.price,
        change24h: d.change_24h ?? 0,
        high24h: d.high_24h ?? 0,
        low24h: d.low_24h ?? 0,
        volume24h: d.volume_24h ?? 0,
        ts: d.ts ?? Date.now()
      };
    } catch {
      return null;
    }
  }

  /** Snapshot: fetch all tickers via REST */
  async getAllTickers(): Promise<NexusTick[]> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/tickers`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((d: any) => ({
        symbol: d.symbol,
        price: d.price,
        change24h: d.change_24h ?? 0,
        high24h: d.high_24h ?? 0,
        low24h: d.low_24h ?? 0,
        volume24h: d.volume_24h ?? 0,
        ts: d.ts ?? Date.now()
      }));
    } catch {
      return [];
    }
  }

  /** Snapshot: orderbook via REST */
  async getOrderbook(symbol: string): Promise<NexusOrderbook | null> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/orderbook?symbol=${symbol}`);
      if (!res.ok) return null;
      const d = await res.json();
      return {
        symbol: d.symbol,
        bids: (d.bids || []).map((b: any[]) => [+b[0], +b[1]]),
        asks: (d.asks || []).map((a: any[]) => [+a[0], +a[1]]),
        ts: d.ts ?? Date.now()
      };
    } catch {
      return null;
    }
  }

  /** Snapshot: recent trades via REST */
  async getRecentTrades(symbol: string): Promise<NexusTrade[]> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/trades?symbol=${symbol}`);
      if (!res.ok) return [];
      const d = await res.json();
      return (d.trades || []).map((t: any) => ({
        symbol: t.symbol || symbol,
        id: t.id || t.time,
        price: +t.price,
        qty: +t.qty,
        side: t.side,
        time: t.time
      }));
    } catch {
      return [];
    }
  }

  /** Fetch historical klines (REST snapshot, then live updates via subscribeKlines) */
  async getKlines(symbol: string, interval: string, limit = 300) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      // Backend returns { success: true, data: [...] } OR a bare array
      const arr = Array.isArray(data) ? data : (data?.data || []);
      return arr.map((k: any) => ({
        time: k.time,
        open: +k.open,
        high: +k.high,
        low: +k.low,
        close: +k.close,
        volume: +k.volume
      }));
    } catch {
      return [];
    }
  }
}

const DEFAULT_BASKET = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT'
];

export const nexusMarket = new NexusMarketFeed();

// ── Legacy synthetic helpers — kept as graceful fallback only ────────────
// Real clients should now use subscribeOrderbook / subscribeTrades which
// deliver actual Binance L2 depth and tape prints. These synthetic
// generators are still exported so existing call sites keep working if
// the live feed hasn't pushed an update yet.

export function deriveOrderBook(
  midPrice: number,
  depth: number = 12,
  spreadBps: number = 8
): { bids: [number, number][]; asks: [number, number][] } {
  if (!midPrice || midPrice <= 0) return { bids: [], asks: [] };
  const halfSpread = midPrice * (spreadBps / 2 / 10000);
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];
  let seed = Math.floor(midPrice * 1000) % 100000;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let bidPrice = midPrice - halfSpread;
  let askPrice = midPrice + halfSpread;
  const stepPct = 0.0008;
  for (let i = 0; i < depth; i++) {
    const size = (0.5 + rng() * 4) * (midPrice > 1000 ? 0.1 : 10);
    bids.push([bidPrice, size]);
    asks.push([askPrice, size]);
    bidPrice -= bidPrice * stepPct * (1 + rng());
    askPrice += askPrice * stepPct * (1 + rng());
  }
  return { bids, asks };
}

let tradeSeq = 0;
export function deriveTrade(
  symbol: string,
  price: number
): { id: number; price: number; qty: number; side: 'BUY' | 'SELL'; time: number } | null {
  if (!price || price <= 0) return null;
  tradeSeq++;
  const r = (Math.sin(tradeSeq * 12.9898) * 43758.5453) % 1;
  const r2 = (Math.sin(tradeSeq * 78.233) * 43758.5453) % 1;
  const side: 'BUY' | 'SELL' = Math.abs(r) < 0.5 ? 'BUY' : 'SELL';
  const sizeMul = price > 1000 ? 0.01 : price > 10 ? 1 : 100;
  const qty = Math.abs(r2) * 5 * sizeMul + sizeMul * 0.1;
  return { id: tradeSeq, price, qty, side, time: Date.now() };
}
