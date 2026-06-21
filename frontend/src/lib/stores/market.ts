import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface MarketTicker {
  symbol: string;
  price: number;
  prevPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

function createMarketStore() {
  const { subscribe, update, set } = writable<Record<string, MarketTicker>>({});

  return {
    subscribe,
    set,
    updateTicker: (symbol: string, data: Partial<MarketTicker>) => {
      update((tickers) => {
        const prev = tickers[symbol];
        const newPrice = data.price ?? prev?.price ?? 0;
        return {
          ...tickers,
          [symbol]: {
            symbol,
            price: newPrice,
            prevPrice: prev?.price ?? newPrice,
            change24h: data.change24h ?? prev?.change24h ?? 0,
            high24h: data.high24h ?? prev?.high24h ?? 0,
            low24h: data.low24h ?? prev?.low24h ?? 0,
            volume24h: data.volume24h ?? prev?.volume24h ?? 0
          }
        };
      });
    }
  };
}

export const marketStore = createMarketStore();

// Favorites — persisted to localStorage
function createFavoritesStore() {
  let initial: string[] = [];
  if (browser) {
    const raw = localStorage.getItem('favorites');
    if (raw) {
      try {
        initial = JSON.parse(raw);
      } catch {
        initial = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      }
    } else {
      initial = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    }
  }

  const { subscribe, update, set } = writable<string[]>(initial);

  return {
    subscribe,
    toggle: (symbol: string) => {
      update((list) => {
        const next = list.includes(symbol)
          ? list.filter((s) => s !== symbol)
          : [...list, symbol];
        if (browser) localStorage.setItem('favorites', JSON.stringify(next));
        return next;
      });
    },
    set,
    add: (symbol: string) => {
      update((list) => {
        if (list.includes(symbol)) return list;
        const next = [...list, symbol];
        if (browser) localStorage.setItem('favorites', JSON.stringify(next));
        return next;
      });
    },
    remove: (symbol: string) => {
      update((list) => {
        const next = list.filter((s) => s !== symbol);
        if (browser) localStorage.setItem('favorites', JSON.stringify(next));
        return next;
      });
    }
  };
}

export const favorites = createFavoritesStore();
