"use client";

import { useMemo } from "react";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { formatPrice } from "./constants";
import type { TickerData, Wallet as WalletType } from "./types";

interface OpenPositionsProps {
  wallets: WalletType[];
  prices: Record<string, TickerData>;
  onClosePosition?: (currency: string) => void;
}

interface Position {
  currency: string;
  balance: number;
  usdtValue: number;
  /* For P&L calculation, we'd need avg buy price; here we use 24h change as proxy */
  change24h: number;
  pnl24h: number;
}

/**
 * Open Positions panel showing live P&L for held assets.
 *
 * Binance/Bybit feature: displays all non-zero balances with their current
 * USDT value, 24h change, and 24h P&L in USDT.
 *
 * Click "Close" to instantly convert back to USDT (calls onClosePosition).
 */
export default function OpenPositions({
  wallets,
  prices,
  onClosePosition,
}: OpenPositionsProps) {
  /* Build positions list from non-zero wallets */
  const positions = useMemo<Position[]>(() => {
    const list: Position[] = [];
    for (const w of wallets) {
      const bal = parseFloat(w.balance || "0");
      if (bal <= 0) continue;
      if (w.currency === "USDT") {
        list.push({
          currency: "USDT",
          balance: bal,
          usdtValue: bal,
          change24h: 0,
          pnl24h: 0,
        });
        continue;
      }
      const ticker = prices[`${w.currency}USDT`];
      const price = ticker?.price || 0;
      const change = ticker ? parseFloat(ticker.change) : 0;
      list.push({
        currency: w.currency,
        balance: bal,
        usdtValue: bal * price,
        change24h: change,
        pnl24h: (bal * price * change) / 100,
      });
    }
    /* Sort by USDT value descending */
    return list.sort((a, b) => b.usdtValue - a.usdtValue);
  }, [wallets, prices]);

  /* Total portfolio value */
  const totalValue = useMemo(
    () => positions.reduce((s, p) => s + p.usdtValue, 0),
    [positions]
  );
  const totalPnL = useMemo(
    () => positions.reduce((s, p) => s + p.pnl24h, 0),
    [positions]
  );
  const totalPnLPercent =
    totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;

  if (positions.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">المراكز المفتوحة</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-4">
          <Briefcase className="h-6 w-6 text-muted-foreground/30 mb-1" />
          <p className="text-[10px] text-muted-foreground">
            لا توجد مراكز مفتوحة
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20">
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">المراكز المفتوحة</h3>
          <span className="text-[9px] text-muted-foreground">
            ({positions.length})
          </span>
        </div>
        <div className="text-left">
          <div className="text-[10px] font-bold tabular-nums">
            {totalValue.toFixed(2)} USDT
          </div>
          <div
            className={`text-[9px] font-medium tabular-nums flex items-center gap-0.5 justify-end ${
              totalPnL >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {totalPnL >= 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {totalPnL >= 0 ? "+" : ""}
            {totalPnL.toFixed(2)} ({totalPnLPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Positions list */}
      <div className="max-h-[280px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-card/80 backdrop-blur">
            <tr className="text-muted-foreground/60 border-b border-border/10">
              <th className="text-right px-2 py-1 font-medium">الأصل</th>
              <th className="text-right px-2 py-1 font-medium">الرصيد</th>
              <th className="text-right px-2 py-1 font-medium">القيمة</th>
              <th className="text-right px-2 py-1 font-medium">24h</th>
              <th className="text-right px-2 py-1 font-medium">P&L</th>
              {onClosePosition && (
                <th className="text-right px-2 py-1 font-medium"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const isUp = pos.change24h >= 0;
              const pnlUp = pos.pnl24h >= 0;
              return (
                <tr
                  key={pos.currency}
                  className="border-b border-border/5 hover:bg-muted/5 transition-colors"
                >
                  <td className="px-2 py-1.5 font-bold">{pos.currency}</td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {pos.balance.toFixed(pos.currency === "USDT" ? 2 : 6)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-medium">
                    {pos.usdtValue.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5">
                    {pos.currency === "USDT" ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span
                        className={`tabular-nums font-medium ${
                          isUp ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isUp ? "+" : ""}
                        {pos.change24h.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {pos.currency === "USDT" ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span
                        className={`tabular-nums font-medium ${
                          pnlUp ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnlUp ? "+" : ""}
                        {pos.pnl24h.toFixed(2)}
                      </span>
                    )}
                  </td>
                  {onClosePosition && pos.currency !== "USDT" && (
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => onClosePosition(pos.currency)}
                        className="p-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/15"
                        title={`إغلاق مركز ${pos.currency}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </td>
                  )}
                  {onClosePosition && pos.currency === "USDT" && (
                    <td className="px-2 py-1.5"></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
