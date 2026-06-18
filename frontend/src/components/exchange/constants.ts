/* ═══════════════════════════════════════════
   Shared constants for the exchange trading page
   ═══════════════════════════════════════════ */

import type { OrderType, Timeframe } from "./types";

/* Top-traded pairs (kept in sync with backend seed data) */
export const PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "TRXUSDT",
  "ATOMUSDT",
  "UNIUSDT",
  "SHIBUSDT",
];

export const CURRENCY_NAMES: Record<string, string> = {
  BTC: "بيتكوين",
  ETH: "إيثريوم",
  BNB: "بي إن بي",
  SOL: "سولانا",
  XRP: "إكس آر بي",
  ADA: "كاردانو",
  DOGE: "دوجكوين",
  DOT: "بولكادوت",
  AVAX: "أفالانش",
  LINK: "تشين لينك",
  MATIC: "ماتيك",
  LTC: "لايتكوين",
  TRX: "ترون",
  ATOM: "كوسموس",
  UNI: "يوني سواب",
  SHIB: "شيباإينو",
};

export const CURRENCY_ICONS: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  BNB: "◆",
  SOL: "◎",
  XRP: "✕",
  ADA: "₳",
  DOGE: "Ð",
  DOT: "●",
  AVAX: "▲",
  LINK: "⬡",
  MATIC: "⬢",
  LTC: "Ł",
  TRX: "Τ",
  ATOM: "⚛",
  UNI: "✦",
  SHIB: "❀",
};

/* Status labels (Arabic) */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  FILLED: "منفذ",
  CANCELLED: "ملغي",
  TRIGGERED: "مفعّل",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FILLED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  TRIGGERED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1د" },
  { value: "5m", label: "5د" },
  { value: "15m", label: "15د" },
  { value: "1h", label: "1س" },
  { value: "4h", label: "4س" },
  { value: "1d", label: "يومي" },
];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  MARKET: "سوقي",
  LIMIT: "محدد",
  STOP_LIMIT: "وقف محدد",
  TAKE_PROFIT: "جني أرباح",
};

/* Formatting helpers */
export function formatPrice(price: number): string {
  if (!isFinite(price)) return "—";
  if (price >= 10000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 100) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(5);
  return price.toFixed(8);
}

export function formatVolume(vol: number | string): string {
  const v = typeof vol === "string" ? parseFloat(vol) : vol;
  if (!isFinite(v)) return "0";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(2);
}

export function formatQty(qty: number): string {
  if (!isFinite(qty)) return "0";
  if (qty >= 1000) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(4);
  if (qty >= 0.001) return qty.toFixed(6);
  return qty.toFixed(8);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(ts: number | string): string {
  const d = new Date(ts);
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Get display precision based on price level */
export function pricePrecision(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 5;
  return 8;
}

export function qtyPrecision(qty: number): number {
  if (qty >= 100) return 2;
  if (qty >= 1) return 4;
  return 6;
}
