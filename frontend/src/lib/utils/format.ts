// ============================================================
// Formatting utilities — display numbers consistently
// ============================================================

export function formatPrice(value: number | string, decimals: number = 2): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (!isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCompact(value: number): string {
  if (!isFinite(value)) return '0';
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toFixed(2);
}

export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date, withTime: boolean = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = d.toLocaleDateString('en-GB');
  if (!withTime) return dateStr;
  const timeStr = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateStr} ${timeStr}`;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return formatDate(d, false);
}

export function formatSymbol(symbol: string): { base: string; quote: string } {
  // Most pairs end with USDT, USDC, BTC, ETH, BNB
  const quotes = ['USDT', 'USDC', 'BUSD', 'TUSD', 'FDUSD', 'BTC', 'ETH', 'BNB'];
  for (const q of quotes) {
    if (symbol.endsWith(q)) {
      return { base: symbol.slice(0, -q.length), quote: q };
    }
  }
  // fallback: assume last 3 chars are quote
  return { base: symbol.slice(0, -3), quote: symbol.slice(-3) };
}

export function shortenAddress(addr: string, prefix: number = 6, suffix: number = 4): string {
  if (!addr || addr.length <= prefix + suffix) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}

// ============================================================
// EGP-aware formatters — these wrap currency.ts so components
// can keep importing from a single utils module
// ============================================================

export {
  usdToEgp,
  egpToUsd,
  formatEGP,
  formatUsdAsEGP,
  egpWithSymbol,
  usdToEgpDisplay,
  egpCompact,
  usdToEgpCompact,
  priceToEgp,
  usdEgpRate
} from './currency';
