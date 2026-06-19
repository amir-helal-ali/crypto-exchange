"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, Plus, X, List, Trash2, Check } from "lucide-react";

interface WatchlistsPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectPair: (pair: string) => void;
  selectedPair: string;
  prices: Record<string, { price: number; change: string }>;
}

export interface Watchlist {
  id: string;
  name: string;
  pairs: string[];
}

const STORAGE_KEY = "exchange_watchlists";
const DEFAULT_WATCHLISTS: Watchlist[] = [
  { id: "default", name: "القائمة الرئيسية", pairs: ["BTCUSDT", "ETHUSDT"] },
];

/* Common pairs for the picker */
const ALL_PAIRS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT",
  "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT", "LTCUSDT",
  "TRXUSDT", "ATOMUSDT", "UNIUSDT", "SHIBUSDT",
];

/**
 * Multi-watchlist manager modal.
 *
 * Binance/Bybit feature that lets users organize pairs into multiple
 * named watchlists (e.g., "DeFi", "Layer 1", "Meme coins").
 *
 * - Create / rename / delete watchlists
 * - Add/remove pairs from each list
 * - Click a pair to switch the main chart
 * - Persisted to localStorage
 */
export default function WatchlistsPanel({
  open,
  onClose,
  onSelectPair,
  selectedPair,
  prices,
}: WatchlistsPanelProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(DEFAULT_WATCHLISTS);
  const [activeId, setActiveId] = useState<string>("default");
  const [newListName, setNewListName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPairs, setShowAddPairs] = useState(false);

  /* Load from localStorage on mount */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWatchlists(parsed);
          setActiveId(parsed[0].id);
        }
      }
    } catch {}
  }, []);

  /* Persist on change */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists));
    } catch {}
  }, [watchlists]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const activeList = watchlists.find((w) => w.id === activeId) || watchlists[0];

  /* Create new watchlist */
  const createWatchlist = useCallback(() => {
    if (!newListName.trim()) return;
    const newList: Watchlist = {
      id: `wl_${Date.now()}`,
      name: newListName.trim(),
      pairs: [],
    };
    setWatchlists((prev) => [...prev, newList]);
    setActiveId(newList.id);
    setNewListName("");
    setShowCreate(false);
  }, [newListName]);

  /* Delete watchlist */
  const deleteWatchlist = (id: string) => {
    if (watchlists.length <= 1) return;
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) {
      setActiveId(watchlists[0].id);
    }
  };

  /* Add pair to active watchlist */
  const addPair = (pair: string) => {
    setWatchlists((prev) =>
      prev.map((w) =>
        w.id === activeId && !w.pairs.includes(pair)
          ? { ...w, pairs: [...w.pairs, pair] }
          : w
      )
    );
  };

  /* Remove pair from active watchlist */
  const removePair = (pair: string) => {
    setWatchlists((prev) =>
      prev.map((w) =>
        w.id === activeId
          ? { ...w, pairs: w.pairs.filter((p) => p !== pair) }
          : w
      )
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden border-2 border-yellow-500/20 shadow-2xl animate-slide-in-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-yellow-500/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-yellow-500 flex items-center justify-center text-white">
              <List className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-yellow-400">قوائم المراقبة</h3>
              <p className="text-[10px] text-muted-foreground">
                نظّم أزواجك المفضلة في قوائم متعددة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Watchlist tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-border/20 overflow-x-auto">
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveId(wl.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                activeId === wl.id
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <Star className="h-3 w-3" />
              {wl.name}
              <span className="text-[9px] opacity-60">({wl.pairs.length})</span>
            </button>
          ))}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title="قائمة جديدة"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Create new watchlist (inline) */}
        {showCreate && (
          <div className="p-2 border-b border-border/20 bg-muted/5 flex items-center gap-1.5 animate-slide-in-down">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="اسم القائمة الجديدة"
              className="input-field text-[11px] py-1.5 px-2 flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") createWatchlist();
              }}
            />
            <button
              onClick={createWatchlist}
              className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active list content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeList && activeList.pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Star className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground mb-3">
                القائمة فارغة. أضف بعض الأزواج للبدء.
              </p>
              <button
                onClick={() => setShowAddPairs(true)}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-[11px] font-medium hover:bg-yellow-500/30 transition-all flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                إضافة أزواج
              </button>
            </div>
          ) : (
            activeList?.pairs.map((pair) => {
              const base = pair.replace("USDT", "");
              const p = prices[pair];
              const change = p ? parseFloat(p.change) : 0;
              const isUp = change >= 0;
              const isActive = pair === selectedPair;
              return (
                <div
                  key={pair}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                    isActive ? "bg-primary/10" : "hover:bg-muted/20"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectPair(pair);
                      onClose();
                    }}
                    className="flex-1 flex items-center justify-between text-right"
                  >
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-xs">{base}</span>
                      <span className="text-[9px] text-muted-foreground">/USDT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p && (
                        <>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {p.price.toFixed(2)}
                          </span>
                          <span
                            className={`text-[10px] font-bold tabular-nums w-14 text-left ${
                              isUp ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {isUp ? "+" : ""}
                            {change.toFixed(2)}%
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => removePair(pair)}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="إزالة من القائمة"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with add/delete buttons */}
        {activeList && (
          <div className="p-2 border-t border-border/20 flex items-center gap-1.5">
            <button
              onClick={() => setShowAddPairs(!showAddPairs)}
              className="flex-1 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-[11px] font-medium hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة أزواج
            </button>
            {watchlists.length > 1 && (
              <button
                onClick={() => deleteWatchlist(activeList.id)}
                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-all flex items-center gap-1"
                title="حذف القائمة"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Add pairs inline section */}
        {showAddPairs && (
          <div className="border-t border-border/20 p-2 max-h-48 overflow-y-auto bg-muted/5 animate-slide-in-down">
            <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
              أضف أزواجاً إلى "{activeList?.name}"
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ALL_PAIRS.filter(
                (p) => !activeList?.pairs.includes(p)
              ).map((pair) => {
                const base = pair.replace("USDT", "");
                return (
                  <button
                    key={pair}
                    onClick={() => addPair(pair)}
                    className="py-1.5 rounded-md text-[10px] font-medium bg-muted/20 hover:bg-yellow-500/15 hover:text-yellow-400 transition-all"
                  >
                    {base}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
