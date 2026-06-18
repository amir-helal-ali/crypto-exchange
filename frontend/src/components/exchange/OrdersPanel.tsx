"use client";

import { useState, useMemo } from "react";
import {
  RefreshCw,
  X,
  Minus,
  History,
  ListOrdered,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ORDER_TYPE_LABELS,
  formatDateTime,
  pricePrecision,
} from "./constants";
import type { UserOrder, Wallet as WalletType } from "./types";

interface OrdersPanelProps {
  orders: UserOrder[];
  wallets: WalletType[];
  onCancel: (orderId: number) => void;
  onRefresh: () => void;
  base: string;
}

type Tab = "open" | "history" | "balance";

/**
 * Bottom panel with three tabs:
 * - Open Orders: pending orders that can be cancelled
 * - Order History: filled/cancelled orders
 * - Asset Balance: current wallet balances for current pair + summary
 */
export default function OrdersPanel({
  orders,
  wallets,
  onCancel,
  onRefresh,
  base,
}: OrdersPanelProps) {
  const [tab, setTab] = useState<Tab>("open");

  /* Filter orders */
  const openOrders = useMemo(
    () => orders.filter((o) => o.status === "PENDING"),
    [orders]
  );
  const orderHistory = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "PENDING")
        .sort((a, b) => {
          const aT = new Date(a.created_at || a.CreatedAt || 0).getTime();
          const bT = new Date(b.created_at || b.CreatedAt || 0).getTime();
          return bT - aT;
        }),
    [orders]
  );

  const baseWallet = wallets.find((w) => w.currency === base);
  const quoteWallet = wallets.find((w) => w.currency === "USDT");

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-border/20 px-2 shrink-0">
        <button
          onClick={() => setTab("open")}
          className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            tab === "open"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListOrdered className="h-3 w-3" />
          الطلبات المفتوحة ({openOrders.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3 w-3" />
          السجل ({orderHistory.length})
        </button>
        <button
          onClick={() => setTab("balance")}
          className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            tab === "balance"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <WalletIcon className="h-3 w-3" />
          الأصول
        </button>
        <div className="flex-1" />
        {tab !== "balance" && (
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all mr-1"
            title="تحديث"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "open" && (
          <OpenOrdersTable
            orders={openOrders}
            onCancel={onCancel}
          />
        )}
        {tab === "history" && (
          <HistoryTable orders={orderHistory} />
        )}
        {tab === "balance" && (
          <BalanceView
            base={base}
            baseWallet={baseWallet}
            quoteWallet={quoteWallet}
            wallets={wallets}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────── Open Orders Table ─────────────── */
function OpenOrdersTable({
  orders,
  onCancel,
}: {
  orders: UserOrder[];
  onCancel: (id: number) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="h-10 w-10 rounded-xl bg-muted/20 flex items-center justify-center mb-2">
          <Minus className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          لا توجد طلبات مفتوحة حالياً
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-card/80 backdrop-blur">
        <tr className="text-muted-foreground/60 border-b border-border/10">
          <th className="text-right px-3 py-1.5 font-medium">الوقت</th>
          <th className="text-right px-3 py-1.5 font-medium">الزوج</th>
          <th className="text-right px-3 py-1.5 font-medium">النوع</th>
          <th className="text-right px-3 py-1.5 font-medium">الجانب</th>
          <th className="text-right px-3 py-1.5 font-medium">السعر</th>
          <th className="text-right px-3 py-1.5 font-medium">الكمية</th>
          <th className="text-right px-3 py-1.5 font-medium">المنفذ</th>
          <th className="text-right px-3 py-1.5 font-medium">الحالة</th>
          <th className="text-right px-3 py-1.5 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr
            key={order.id}
            className="border-b border-border/5 hover:bg-muted/5 transition-colors"
          >
            <td className="px-3 py-1.5 text-muted-foreground tabular-nums text-[10px]">
              {formatDateTime(order.created_at || order.CreatedAt || "")}
            </td>
            <td className="px-3 py-1.5 font-medium">
              {order.symbol?.replace("USDT", "")}/USDT
            </td>
            <td className="px-3 py-1.5 text-muted-foreground">
              {ORDER_TYPE_LABELS[order.type] || order.type}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={`text-[10px] font-bold ${
                  order.side === "BUY" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {order.side === "BUY" ? "شراء" : "بيع"}
              </span>
            </td>
            <td className="px-3 py-1.5 tabular-nums">
              {order.price
                ? parseFloat(order.price).toFixed(pricePrecision(parseFloat(order.price)))
                : order.stop_price
                  ? `وقف ${parseFloat(order.stop_price).toFixed(2)}`
                  : "سوقي"}
            </td>
            <td className="px-3 py-1.5 tabular-nums">
              {parseFloat(order.quantity || "0").toFixed(6)}
            </td>
            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
              {order.filled_quantity
                ? parseFloat(order.filled_quantity).toFixed(6)
                : "0.000000"}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                  STATUS_COLORS[order.status] ||
                  "bg-muted/20 text-muted-foreground border-border/30"
                }`}
              >
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </td>
            <td className="px-3 py-1.5">
              <button
                onClick={() => onCancel(order.id)}
                className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/15"
                title="إلغاء الأمر"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─────────────── History Table ─────────────── */
function HistoryTable({ orders }: { orders: UserOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="h-10 w-10 rounded-xl bg-muted/20 flex items-center justify-center mb-2">
          <History className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          لا يوجد سجل طلبات بعد
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-card/80 backdrop-blur">
        <tr className="text-muted-foreground/60 border-b border-border/10">
          <th className="text-right px-3 py-1.5 font-medium">الوقت</th>
          <th className="text-right px-3 py-1.5 font-medium">الزوج</th>
          <th className="text-right px-3 py-1.5 font-medium">النوع</th>
          <th className="text-right px-3 py-1.5 font-medium">الجانب</th>
          <th className="text-right px-3 py-1.5 font-medium">السعر</th>
          <th className="text-right px-3 py-1.5 font-medium">الكمية</th>
          <th className="text-right px-3 py-1.5 font-medium">الحالة</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr
            key={order.id}
            className="border-b border-border/5 hover:bg-muted/5 transition-colors"
          >
            <td className="px-3 py-1.5 text-muted-foreground tabular-nums text-[10px]">
              {formatDateTime(order.created_at || order.CreatedAt || "")}
            </td>
            <td className="px-3 py-1.5 font-medium">
              {order.symbol?.replace("USDT", "")}/USDT
            </td>
            <td className="px-3 py-1.5 text-muted-foreground">
              {ORDER_TYPE_LABELS[order.type] || order.type}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={`text-[10px] font-bold ${
                  order.side === "BUY" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {order.side === "BUY" ? "شراء" : "بيع"}
              </span>
            </td>
            <td className="px-3 py-1.5 tabular-nums">
              {order.avg_fill_price && parseFloat(order.avg_fill_price) > 0
                ? parseFloat(order.avg_fill_price).toFixed(2)
                : order.price
                  ? parseFloat(order.price).toFixed(2)
                  : "سوقي"}
            </td>
            <td className="px-3 py-1.5 tabular-nums">
              {parseFloat(order.quantity || "0").toFixed(6)}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                  STATUS_COLORS[order.status] ||
                  "bg-muted/20 text-muted-foreground border-border/30"
                }`}
              >
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─────────────── Balance View ─────────────── */
function BalanceView({
  base,
  baseWallet,
  quoteWallet,
  wallets,
}: {
  base: string;
  baseWallet?: WalletType;
  quoteWallet?: WalletType;
  wallets: WalletType[];
}) {
  /* Show base, quote, and any non-zero wallets */
  const otherWallets = wallets.filter(
    (w) =>
      w.currency !== base &&
      w.currency !== "USDT" &&
      parseFloat(w.balance || "0") > 0
  );

  return (
    <div className="p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Base currency wallet */}
        <div className="glass-panel rounded-lg p-3 border border-primary/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground">رصيد</span>
            <span className="text-[10px] font-bold text-primary">{base}</span>
          </div>
          <div className="text-xl font-bold tabular-nums">
            {baseWallet?.balance
              ? parseFloat(baseWallet.balance).toFixed(8)
              : "0.00000000"}
          </div>
          {baseWallet?.locked_balance &&
            parseFloat(baseWallet.locked_balance) > 0 && (
              <div className="text-[9px] text-muted-foreground mt-1">
                مجمد: {parseFloat(baseWallet.locked_balance).toFixed(8)} {base}
              </div>
            )}
        </div>

        {/* Quote currency wallet */}
        <div className="glass-panel rounded-lg p-3 border border-emerald-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground">رصيد</span>
            <span className="text-[10px] font-bold text-emerald-400">USDT</span>
          </div>
          <div className="text-xl font-bold tabular-nums">
            {quoteWallet?.balance
              ? parseFloat(quoteWallet.balance).toFixed(2)
              : "0.00"}
          </div>
          {quoteWallet?.locked_balance &&
            parseFloat(quoteWallet.locked_balance) > 0 && (
              <div className="text-[9px] text-muted-foreground mt-1">
                مجمد: {parseFloat(quoteWallet.locked_balance).toFixed(2)} USDT
              </div>
            )}
        </div>
      </div>

      {otherWallets.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
            أصول أخرى
          </div>
          <div className="space-y-1">
            {otherWallets.map((w) => (
              <div
                key={w.currency}
                className="flex items-center justify-between px-2.5 py-1.5 bg-muted/10 rounded text-[11px]"
              >
                <span className="font-medium">{w.currency}</span>
                <span className="tabular-nums">
                  {parseFloat(w.balance).toFixed(8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherWallets.length === 0 &&
        !baseWallet?.balance &&
        !quoteWallet?.balance && (
          <div className="text-center py-6 text-[11px] text-muted-foreground">
            لا توجد أصول في محفظتك
          </div>
        )}
    </div>
  );
}
