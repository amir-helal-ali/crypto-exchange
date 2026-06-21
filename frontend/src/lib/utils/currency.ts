// ============================================================
// Currency utilities — EGP (Egyptian Pound) as the MAIN currency
// All portfolio values, balances, and trade totals are shown in
// EGP first, with USD as a secondary reference.
// ============================================================

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Live-ish USD → EGP rate. Default ~48.5 (June 2025 estimate).
// In production this would be fetched from an FX endpoint.
const DEFAULT_USD_EGP_RATE = 48.5;

// Persisted rate so user can refresh periodically
function loadRate(): number {
  if (!browser) return DEFAULT_USD_EGP_RATE;
  const raw = localStorage.getItem('usd_egp_rate');
  if (raw) {
    const n = parseFloat(raw);
    if (isFinite(n) && n > 0) return n;
  }
  return DEFAULT_USD_EGP_RATE;
}

function createRateStore() {
  const { subscribe, set } = writable<number>(loadRate());
  return {
    subscribe,
    setRate: (r: number) => {
      if (!browser) return;
      if (isFinite(r) && r > 0) {
        localStorage.setItem('usd_egp_rate', String(r));
        set(r);
      }
    },
    reset: () => {
      if (browser) localStorage.setItem('usd_egp_rate', String(DEFAULT_USD_EGP_RATE));
      set(DEFAULT_USD_EGP_RATE);
    }
  };
}

export const usdEgpRate = createRateStore();

// ============================================================
// Conversion helpers
// ============================================================

/** Convert a USD amount to EGP at the current rate */
export function usdToEgp(usd: number, rate: number = DEFAULT_USD_EGP_RATE): number {
  if (!isFinite(usd)) return 0;
  return usd * rate;
}

/** Convert EGP back to USD */
export function egpToUsd(egp: number, rate: number = DEFAULT_USD_EGP_RATE): number {
  if (!isFinite(egp) || rate === 0) return 0;
  return egp / rate;
}

// ============================================================
// Formatters — produce human-readable strings
// ============================================================

/** Format an EGP amount with proper grouping and currency suffix */
export function formatEGP(egp: number, decimals: number = 2): string {
  if (!isFinite(egp)) egp = 0;
  return egp.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/** Format a USD value but render it as EGP — convenience for showing prices */
export function formatUsdAsEGP(usd: number, rate: number = DEFAULT_USD_EGP_RATE, decimals: number = 2): string {
  return formatEGP(usdToEgp(usd, rate), decimals);
}

/** Format with the EGP symbol (ج.م) prefix */
export function egpWithSymbol(egp: number, decimals: number = 2): string {
  return `${formatEGP(egp, decimals)} ج.م`;
}

/** Convert USD to EGP and append the EGP symbol */
export function usdToEgpDisplay(usd: number, rate: number = DEFAULT_USD_EGP_RATE, decimals: number = 2): string {
  return egpWithSymbol(usdToEgp(usd, rate), decimals);
}

/** Compact EGP for tight spaces — e.g. 1.2M ج.م */
export function egpCompact(egp: number): string {
  if (!isFinite(egp)) egp = 0;
  const abs = Math.abs(egp);
  if (abs >= 1e9) return (egp / 1e9).toFixed(2) + 'B ج.م';
  if (abs >= 1e6) return (egp / 1e6).toFixed(2) + 'M ج.م';
  if (abs >= 1e3) return (egp / 1e3).toFixed(2) + 'K ج.م';
  return egp.toFixed(2) + ' ج.م';
}

/** Convert a USD value to a compact EGP display */
export function usdToEgpCompact(usd: number, rate: number = DEFAULT_USD_EGP_RATE): string {
  return egpCompact(usdToEgp(usd, rate));
}

// ============================================================
// Pair price → EGP
// ============================================================

/**
 * Convert a crypto price (quoted in USDT) to its EGP equivalent.
 * Pass the live USD→EGP rate as the second argument.
 */
export function priceToEgp(usdPrice: number, rate: number = DEFAULT_USD_EGP_RATE): number {
  return usdToEgp(usdPrice, rate);
}
