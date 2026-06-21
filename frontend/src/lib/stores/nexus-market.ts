/**
 * NEXUS Market Data helper — single source of truth for all live market
 * data on the NEXUS Exchange frontend. Wraps the NEXUS backend's
 * /ws/market WebSocket endpoint and exposes a simple subscribe API.
 *
 * No Binance, no third-party feeds — only NEXUS's own market engine.
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

type Listener = (tick: NexusTick) => void;

class NexusMarketFeed {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>(); // symbol → listeners
  private globalListeners = new Set<Listener>();
  private currentSymbol = '';
  private reconnectTimer: any = null;
  private isConnecting = false;

  /**
   * Subscribe to live ticks for a specific symbol. The latest tick is also
   * pushed into the shared `marketStore` so any UI bound to it updates.
   *
   * Returns an unsubscribe function.
   */
  subscribe(symbol: string, fn: Listener): () => void {
    if (!browser) return () => {};
    if (!this.listeners.has(symbol)) this.listeners.set(symbol, new Set());
    this.listeners.get(symbol)!.add(fn);
    this.ensureConnected(symbol);
    return () => {
      this.listeners.get(symbol)?.delete(fn);
      // Switch to a different symbol if no listeners remain for current
      if (this.listeners.get(symbol)?.size === 0) {
        this.listeners.delete(symbol);
      }
      this.pickBestSymbol();
    };
  }

  /**
   * Subscribe to ALL ticks regardless of symbol.
   */
  subscribeAll(fn: Listener): () => void {
    if (!browser) return () => {};
    this.globalListeners.add(fn);
    this.ensureConnected(this.currentSymbol || 'BTCUSDT');
    return () => {
      this.globalListeners.delete(fn);
    };
  }

  private ensureConnected(symbol: string) {
    if (!browser) return;
    if (this.currentSymbol !== symbol && (this.listeners.has(symbol) || this.globalListeners.size > 0)) {
      this.currentSymbol = symbol;
      // (Re)connect with the new symbol
      this.connect();
    } else if (!this.ws && !this.isConnecting) {
      this.connect();
    }
  }

  private pickBestSymbol() {
    // Find any symbol that still has listeners, prefer the most recent
    const symbols = Array.from(this.listeners.keys());
    if (symbols.length === 0 && this.globalListeners.size === 0) {
      // No one is listening — disconnect
      this.disconnect();
      return;
    }
    const next = symbols[0] || this.currentSymbol || 'BTCUSDT';
    if (next !== this.currentSymbol) {
      this.currentSymbol = next;
      this.connect();
    }
  }

  private connect() {
    if (!browser) return;
    this.isConnecting = true;
    try {
      this.ws?.close();
    } catch {}
    const symbol = this.currentSymbol || 'BTCUSDT';
    const wsBase = API_BASE.replace(/^http/, 'ws');
    try {
      this.ws = new WebSocket(`${wsBase}/ws/market?symbol=${symbol}`);
      this.ws.onopen = () => {
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (!data.symbol || typeof data.price !== 'number') return;
          const tick: NexusTick = {
            symbol: data.symbol,
            price: data.price,
            change24h: data.change_24h ?? 0,
            high24h: data.high_24h ?? 0,
            low24h: data.low_24h ?? 0,
            volume24h: data.volume_24h ?? 0,
            ts: data.ts ?? Date.now()
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
          this.listeners.get(tick.symbol)?.forEach((fn) => {
            try {
              fn(tick);
            } catch {}
          });
          // Notify global listeners
          this.globalListeners.forEach((fn) => {
            try {
              fn(tick);
            } catch {}
          });
        } catch {}
      };
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        // Auto-reconnect with backoff if we still have listeners
        if (this.listeners.size > 0 || this.globalListeners.size > 0) {
          this.reconnectTimer = setTimeout(() => this.connect(), 1500);
        }
      };
      this.ws.onerror = () => {
        // onclose will handle reconnect
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

  /** Send a subscription switch message to the server */
  switchSymbol(symbol: string) {
    this.currentSymbol = symbol;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: 'subscribe', symbol }));
      } catch {}
    } else {
      this.connect();
    }
  }

  /** Snapshot: fetch current price for a symbol via REST (no subscribe) */
  async getTicker(symbol: string): Promise<NexusTick | null> {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/market/ticker?symbol=${symbol}`
      );
      if (!res.ok) return null;
      const d = await res.json();
      return {
        symbol: d.symbol,
        price: d.price,
        change24h: d.change_24h,
        high24h: d.high_24h,
        low24h: d.low_24h,
        volume24h: d.volume_24h,
        ts: Date.now()
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
        change24h: d.change_24h,
        high24h: d.high_24h,
        low24h: d.low_24h,
        volume24h: d.volume_24h,
        ts: Date.now()
      }));
    } catch {
      return [];
    }
  }

  /** Fetch historical klines */
  async getKlines(symbol: string, interval: string, limit = 300) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((k: any) => ({
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

export const nexusMarket = new NexusMarketFeed();

/**
 * Derive a realistic synthetic order book from a single mid-price.
 * Used by the OrderBook component since NEXUS's mock backend doesn't
 * yet have a dedicated depth endpoint — the derived book is stable
 * per-tick and looks like a real L2 book.
 */
export function deriveOrderBook(
  midPrice: number,
  depth: number = 12,
  spreadBps: number = 8
): { bids: [number, number][]; asks: [number, number][] } {
  if (!midPrice || midPrice <= 0) return { bids: [], asks: [] };
  const halfSpread = midPrice * (spreadBps / 2 / 10000);
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];
  // Deterministic pseudo-random sizes (seeded by price)
  let seed = Math.floor(midPrice * 1000) % 100000;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let bidPrice = midPrice - halfSpread;
  let askPrice = midPrice + halfSpread;
  const stepPct = 0.0008; // 8 bps between levels
  for (let i = 0; i < depth; i++) {
    const size = (0.5 + rng() * 4) * (midPrice > 1000 ? 0.1 : 10);
    bids.push([bidPrice, size]);
    asks.push([askPrice, size]);
    bidPrice -= bidPrice * stepPct * (1 + rng());
    askPrice += askPrice * stepPct * (1 + rng());
  }
  return { bids, asks };
}

/**
 * Derive a realistic synthetic trade feed from current price.
 * Each call returns 1-2 trades that look like real exchange prints.
 */
let tradeSeq = 0;
export function deriveTrade(
  symbol: string,
  price: number
): { id: number; price: number; qty: number; side: 'BUY' | 'SELL'; time: number } | null {
  if (!price || price <= 0) return null;
  tradeSeq++;
  // Pseudo-random side and size from a fast RNG
  const r = (Math.sin(tradeSeq * 12.9898) * 43758.5453) % 1;
  const r2 = (Math.sin(tradeSeq * 78.233) * 43758.5453) % 1;
  const side: 'BUY' | 'SELL' = Math.abs(r) < 0.5 ? 'BUY' : 'SELL';
  const sizeMul = price > 1000 ? 0.01 : price > 10 ? 1 : 100;
  const qty = Math.abs(r2) * 5 * sizeMul + sizeMul * 0.1;
  return {
    id: tradeSeq,
    price,
    qty,
    side,
    time: Date.now()
  };
}
