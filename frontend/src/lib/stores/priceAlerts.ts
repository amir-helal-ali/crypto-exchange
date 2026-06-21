import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { marketStore, type MarketTicker } from './market';
import { toasts } from './toast';

export type AlertDirection = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'dismissed';

export interface PriceAlert {
  id: string;
  symbol: string;          // e.g. "BTCUSDT"
  baseAsset: string;       // e.g. "BTC"
  quoteAsset: string;      // e.g. "USDT"
  direction: AlertDirection;
  targetPrice: number;     // in USD
  createdAt: number;
  triggeredAt?: number;
  status: AlertStatus;
  note?: string;
}

const STORAGE_KEY = 'nexus-price-alerts';
const MAX_ALERTS = 50;

function loadAlerts(): PriceAlert[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a && a.id && a.symbol && typeof a.targetPrice === 'number');
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // localStorage might be full — silently drop
  }
}

function genId(): string {
  return `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createAlertsStore() {
  const { subscribe, set, update } = writable<PriceAlert[]>(loadAlerts());

  // Subscribe to market updates and check alerts
  let marketUnsub: (() => void) | null = null;
  let lastCheckedPrices: Record<string, number> = {};

  function checkAlerts(tickers: Record<string, MarketTicker>) {
    const alerts = get({ subscribe });
    if (alerts.length === 0) return;

    let triggered: PriceAlert[] = [];
    const newAlerts = alerts.map((alert) => {
      if (alert.status !== 'active') return alert;
      const ticker = tickers[alert.symbol];
      if (!ticker) return alert;

      const price = ticker.price;
      const lastPrice = lastCheckedPrices[alert.symbol];

      // Only check if we have a previous price (prevents triggering on first load)
      if (lastPrice === undefined) {
        lastCheckedPrices[alert.symbol] = price;
        return alert;
      }

      let isTriggered = false;
      if (alert.direction === 'above' && lastPrice < alert.targetPrice && price >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.direction === 'below' && lastPrice > alert.targetPrice && price <= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.direction === 'above' && price >= alert.targetPrice && lastPrice === price) {
        // Also trigger if price is already above target on alert creation
        // (but only once - mark as triggered)
        isTriggered = true;
      } else if (alert.direction === 'below' && price <= alert.targetPrice && lastPrice === price) {
        isTriggered = true;
      }

      lastCheckedPrices[alert.symbol] = price;

      if (isTriggered) {
        const triggeredAlert: PriceAlert = {
          ...alert,
          status: 'triggered',
          triggeredAt: Date.now()
        };
        triggered.push(triggeredAlert);
        return triggeredAlert;
      }

      return alert;
    });

    if (triggered.length > 0) {
      set(newAlerts);
      saveAlerts(newAlerts);

      // Fire toasts + browser notifications
      for (const a of triggered) {
        const dir = a.direction === 'above' ? 'تجاوز' : 'انخفض تحت';
        const msg = `${a.baseAsset} ${dir} ${a.targetPrice}$`;
        toasts.success(`تنبيه سعر: ${msg}`);

        if (browser && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('تنبيه سعر — NEXUS', {
              body: msg,
              icon: '/icons/icon-192.png',
              tag: a.id
            });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  function startWatching() {
    if (!browser) return;
    if (marketUnsub) return;
    marketUnsub = marketStore.subscribe((tickers) => {
      checkAlerts(tickers);
    });
  }

  function stopWatching() {
    if (marketUnsub) {
      marketUnsub();
      marketUnsub = null;
    }
  }

  // Auto-start on browser
  if (browser) {
    startWatching();
  }

  return {
    subscribe,

    add(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>): PriceAlert {
      const newAlert: PriceAlert = {
        ...alert,
        id: genId(),
        createdAt: Date.now(),
        status: 'active'
      };
      let added: PriceAlert | null = null;
      update((alerts) => {
        const next = [newAlert, ...alerts].slice(0, MAX_ALERTS);
        added = newAlert;
        saveAlerts(next);
        return next;
      });
      // Request notification permission on first alert creation
      if (browser && 'Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission();
        } catch {
          // ignore
        }
      }
      return added!;
    },

    dismiss(id: string) {
      update((alerts) => {
        const next = alerts.filter((a) => a.id !== id);
        saveAlerts(next);
        return next;
      });
    },

    remove(id: string) {
      update((alerts) => {
        const next = alerts.filter((a) => a.id !== id);
        saveAlerts(next);
        return next;
      });
    },

    clearTriggered() {
      update((alerts) => {
        const next = alerts.filter((a) => a.status !== 'triggered');
        saveAlerts(next);
        return next;
      });
    },

    reactivate(id: string) {
      update((alerts) => {
        const next = alerts.map((a) =>
          a.id === id
            ? { ...a, status: 'active' as const, triggeredAt: undefined, createdAt: Date.now() }
            : a
        );
        saveAlerts(next);
        return next;
      });
    },

    requestNotificationPermission() {
      if (!browser || !('Notification' in window)) return Promise.resolve('unsupported' as NotificationPermission);
      return Notification.requestPermission();
    },

    startWatching,
    stopWatching
  };
}

export const priceAlerts = createAlertsStore();
