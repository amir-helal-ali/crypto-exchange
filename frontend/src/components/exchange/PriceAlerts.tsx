"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
  Check,
} from "lucide-react";
import { pricePrecision } from "./constants";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface PriceAlert {
  id: string;
  pair: string;
  condition: "above" | "below";
  targetPrice: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  active: boolean;
}

interface PriceAlertsProps {
  pair: string;
  currentPrice?: number;
  /* Compact mode for inline display (e.g. icon button that opens a popover) */
  compact?: boolean;
}

/* ═══════════════════════════════════════════
   Storage helpers
   ═══════════════════════════════════════════ */

const STORAGE_KEY = "exchange_price_alerts";

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
}

function genId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ═══════════════════════════════════════════
   Notification helpers
   ═══════════════════════════════════════════ */

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

function fireNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.svg",
      tag: title,
      requireInteraction: false,
    });
    setTimeout(() => n.close(), 8000);
  } catch {}
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function PriceAlerts({
  pair,
  currentPrice,
  compact = false,
}: PriceAlertsProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newCondition, setNewCondition] = useState<"above" | "below">("above");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const prevPricesRef = useRef<Record<string, number>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* Load alerts on mount */
  useEffect(() => {
    setAlerts(loadAlerts());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionGranted(Notification.permission === "granted");
    }
  }, []);

  /* Persist whenever alerts change */
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  /* Check alerts when current price changes */
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const prevPrice = prevPricesRef.current[pair];
    prevPricesRef.current[pair] = currentPrice;

    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((a) => {
        if (!a.active || a.triggered) return a;
        if (a.pair !== pair) return a;

        let isTriggered = false;
        if (a.condition === "above") {
          // Fire when price crosses above target
          if (prevPrice != null && currentPrice >= a.targetPrice && prevPrice < a.targetPrice) {
            isTriggered = true;
          } else if (prevPrice == null && currentPrice >= a.targetPrice) {
            // Initial check - if already above, fire immediately
            isTriggered = true;
          }
        } else {
          // below
          if (prevPrice != null && currentPrice <= a.targetPrice && prevPrice > a.targetPrice) {
            isTriggered = true;
          } else if (prevPrice == null && currentPrice <= a.targetPrice) {
            isTriggered = true;
          }
        }

        if (isTriggered) {
          changed = true;
          const title = `تنبيه سعر: ${a.pair}`;
          const body =
            a.condition === "above"
              ? `السعر تجاوز ${a.targetPrice.toFixed(pricePrecision(a.targetPrice))} (الحالي: ${currentPrice.toFixed(pricePrecision(currentPrice))})`
              : `السعر انخفض تحت ${a.targetPrice.toFixed(pricePrecision(a.targetPrice))} (الحالي: ${currentPrice.toFixed(pricePrecision(currentPrice))})`;
          fireNotification(title, body);
          playAlertSound();
          return { ...a, triggered: true, triggeredAt: Date.now(), active: false };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [currentPrice, pair]);

  /* Alert sound using Web Audio API */
  const playAlertSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      // 3-tone alert: C5 → E5 → G5 (rising triad)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.2);
      });
    } catch {}
  }, []);

  /* Add a new alert */
  const handleAddAlert = async () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    // Ensure we have notification permission
    if (!permissionGranted) {
      const granted = await requestNotificationPermission();
      setPermissionGranted(granted);
    }

    const alert: PriceAlert = {
      id: genId(),
      pair,
      condition: newCondition,
      targetPrice: price,
      createdAt: Date.now(),
      triggered: false,
      active: true,
    };
    setAlerts((prev) => [...prev, alert]);
    setNewPrice("");
  };

  /* Delete alert */
  const handleDelete = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  /* Toggle alert active state */
  const handleToggle = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, active: !a.active, triggered: a.active ? a.triggered : false }
          : a
      )
    );
  };

  /* Clear triggered alerts */
  const handleClearTriggered = () => {
    setAlerts((prev) => prev.filter((a) => !a.triggered));
  };

  /* Filter alerts for current pair */
  const pairAlerts = alerts.filter((a) => a.pair === pair);
  const activeCount = pairAlerts.filter((a) => a.active).length;
  const triggeredCount = pairAlerts.filter((a) => a.triggered).length;

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`glass-panel rounded-lg p-2 transition-all relative ${
            activeCount > 0
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
          title="تنبيهات الأسعار"
        >
          {activeCount > 0 ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold flex items-center justify-center text-white">
              {activeCount}
            </span>
          )}
        </button>

        {isOpen && (
          <PriceAlertsPopover
            alerts={pairAlerts}
            newPrice={newPrice}
            onNewPriceChange={setNewPrice}
            newCondition={newCondition}
            onNewConditionChange={setNewCondition}
            onAdd={handleAddAlert}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onClearTriggered={handleClearTriggered}
            permissionGranted={permissionGranted}
            onRequestPermission={async () => {
              const g = await requestNotificationPermission();
              setPermissionGranted(g);
            }}
            currentPrice={currentPrice}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  }

  /* Full panel mode */
  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <BellRing className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-xs">تنبيهات الأسعار</h3>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold">
              {activeCount} نشط
            </span>
          )}
        </div>
        {triggeredCount > 0 && (
          <button
            onClick={handleClearTriggered}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            مسح المنفذة
          </button>
        )}
      </div>

      <PriceAlertsContent
        alerts={pairAlerts}
        newPrice={newPrice}
        onNewPriceChange={setNewPrice}
        newCondition={newCondition}
        onNewConditionChange={setNewCondition}
        onAdd={handleAddAlert}
        onDelete={handleDelete}
        onToggle={handleToggle}
        permissionGranted={permissionGranted}
        onRequestPermission={async () => {
          const g = await requestNotificationPermission();
          setPermissionGranted(g);
        }}
        currentPrice={currentPrice}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Popover (for compact mode)
   ═══════════════════════════════════════════ */

function PriceAlertsPopover({
  alerts,
  newPrice,
  onNewPriceChange,
  newCondition,
  onNewConditionChange,
  onAdd,
  onDelete,
  onToggle,
  onClearTriggered,
  permissionGranted,
  onRequestPermission,
  currentPrice,
  onClose,
}: {
  alerts: PriceAlert[];
  newPrice: string;
  onNewPriceChange: (s: string) => void;
  newCondition: "above" | "below";
  onNewConditionChange: (c: "above" | "below") => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onClearTriggered: () => void;
  permissionGranted: boolean;
  onRequestPermission: () => void;
  currentPrice?: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-full mt-1 left-0 z-50 w-80 glass-panel-strong rounded-xl shadow-2xl border border-border/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <h3 className="font-bold text-xs">تنبيهات الأسعار</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <PriceAlertsContent
          alerts={alerts}
          newPrice={newPrice}
          onNewPriceChange={onNewPriceChange}
          newCondition={newCondition}
          onNewConditionChange={onNewConditionChange}
          onAdd={onAdd}
          onDelete={onDelete}
          onToggle={onToggle}
          permissionGranted={permissionGranted}
          onRequestPermission={onRequestPermission}
          currentPrice={currentPrice}
        />
      </div>
      {alerts.some((a) => a.triggered) && (
        <div className="border-t border-border/20 p-2">
          <button
            onClick={onClearTriggered}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
          >
            مسح التنبيهات المنفذة
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Shared content (used by both modes)
   ═══════════════════════════════════════════ */

function PriceAlertsContent({
  alerts,
  newPrice,
  onNewPriceChange,
  newCondition,
  onNewConditionChange,
  onAdd,
  onDelete,
  onToggle,
  permissionGranted,
  onRequestPermission,
  currentPrice,
}: {
  alerts: PriceAlert[];
  newPrice: string;
  onNewPriceChange: (s: string) => void;
  newCondition: "above" | "below";
  onNewConditionChange: (c: "above" | "below") => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  permissionGranted: boolean;
  onRequestPermission: () => void;
  currentPrice?: number;
}) {
  return (
    <div className="flex flex-col">
      {/* Notification permission banner */}
      {!permissionGranted && (
        <button
          onClick={onRequestPermission}
          className="m-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          فعّل إشعارات المتصفح لاستقبال التنبيهات
        </button>
      )}

      {/* Add new alert form */}
      <div className="p-2 border-b border-border/20">
        <div className="flex items-center gap-1 mb-1.5">
          <button
            onClick={() => onNewConditionChange("above")}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
              newCondition === "above"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            <TrendingUp className="h-3 w-3" /> أعلى من
          </button>
          <button
            onClick={() => onNewConditionChange("below")}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
              newCondition === "below"
                ? "bg-red-500/20 text-red-400"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            <TrendingDown className="h-3 w-3" /> أقل من
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={newPrice}
            onChange={(e) => onNewPriceChange(e.target.value)}
            placeholder="السعر المستهدف"
            step="any"
            className="input-field text-xs py-1.5 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
          />
          <button
            onClick={onAdd}
            disabled={!newPrice || parseFloat(newPrice) <= 0}
            className="btn-primary text-xs py-1.5 px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {currentPrice != null && currentPrice > 0 && (
          <div className="text-[9px] text-muted-foreground mt-1">
            السعر الحالي: {currentPrice.toFixed(pricePrecision(currentPrice))}
          </div>
        )}
      </div>

      {/* Alerts list */}
      <div className="max-h-64 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-[10px] text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
            لا توجد تنبيهات بعد
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
                  a.triggered
                    ? "bg-amber-500/5"
                    : a.active
                    ? "hover:bg-muted/20"
                    : "opacity-50"
                }`}
              >
                <button
                  onClick={() => onToggle(a.id)}
                  className={`shrink-0 w-6 h-3.5 rounded-full transition-colors relative ${
                    a.active ? "bg-primary" : "bg-muted/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                      a.active ? "left-0.5" : "right-0.5"
                    }`}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {a.condition === "above" ? (
                      <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-mono font-semibold ${
                        a.triggered ? "text-amber-400" : "text-foreground"
                      }`}
                    >
                      {a.targetPrice.toFixed(pricePrecision(a.targetPrice))}
                    </span>
                    {a.triggered && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                        تم التنفيذ
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {a.condition === "above" ? "أعلى من" : "أقل من"} •{" "}
                    {new Date(a.createdAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <button
                  onClick={() => onDelete(a.id)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
                  title="حذف"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
