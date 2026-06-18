/* ═══════════════════════════════════════════
   Shared types for the exchange trading page
   ═══════════════════════════════════════════ */

export interface TickerData {
  price: number;
  high: number;
  low: number;
  volume: string;
  change: string;
  quoteVolume: string;
  openPrice: string;
}

export interface OrderBookEntry {
  price: number;
  qty: number;
  total: number;
  cumulative: number;
  depthPercent: number;
}

export interface MarketTrade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface UserOrder {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT" | "TAKE_PROFIT";
  status: "PENDING" | "FILLED" | "CANCELLED" | "TRIGGERED";
  quantity: string;
  price?: string;
  stop_price?: string;
  avg_fill_price?: string;
  filled_quantity?: string;
  created_at?: string;
  CreatedAt?: string;
}

export interface Wallet {
  id?: number;
  currency: string;
  balance: string;
  locked_balance?: string;
  available_balance?: string;
}

export interface FeeSchedule {
  id?: number;
  user_type: string;
  order_type: string;
  maker_fee: number;
  taker_fee: number;
}

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP_LIMIT" | "TAKE_PROFIT";
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type BottomTab = "orders" | "trades" | "balance" | "history";
export type OrderFormTab = "LIMIT" | "MARKET" | "STOP_LIMIT" | "TAKE_PROFIT";
