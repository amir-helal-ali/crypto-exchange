<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatPrice, formatCompact, formatSymbol } from '$lib/utils/format';
  import { favorites } from '$lib/stores/market';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { Star, Search, ChevronLeft } from 'lucide-svelte';

  interface Props {
    selectedSymbol: string;
    onSelect: (symbol: string) => void;
  }

  let { selectedSymbol, onSelect }: Props = $props();

  let tab = $state<'all' | 'favorites' | 'usdt' | 'btc'>('all');
  let search = $state('');
  let tickers = $state<Record<string, MarketTicker>>({});

  const unsubscribe = marketStore.subscribe((t) => {
    tickers = t;
  });

  // All tradable symbols
  const ALL_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
    'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'LTCUSDT', 'TRXUSDT', 'ATOMUSDT',
    'UNIUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT',
    'SEIUSDT', 'TIAUSDT', 'FILUSDT', 'RNDRUSDT', 'FETUSDT', 'GRTUSDT', 'AAVEUSDT'
  ];

  const SYMBOL_NAMES: Record<string, string> = {
    BTCUSDT: 'Bitcoin', ETHUSDT: 'Ethereum', BNBUSDT: 'BNB', SOLUSDT: 'Solana',
    XRPUSDT: 'XRP', ADAUSDT: 'Cardano', DOGEUSDT: 'Dogecoin', AVAXUSDT: 'Avalanche',
    DOTUSDT: 'Polkadot', LINKUSDT: 'Chainlink', MATICUSDT: 'Polygon', LTCUSDT: 'Litecoin',
    TRXUSDT: 'TRON', ATOMUSDT: 'Cosmos', UNIUSDT: 'Uniswap', APTUSDT: 'Aptos',
    NEARUSDT: 'NEAR', ARBUSDT: 'Arbitrum', OPUSDT: 'Optimism', INJUSDT: 'Injective',
    SUIUSDT: 'Sui', SEIUSDT: 'Sei', TIAUSDT: 'Celestia', FILUSDT: 'Filecoin',
    RNDRUSDT: 'Render', FETUSDT: 'Fetch.ai', GRTUSDT: 'The Graph', AAVEUSDT: 'Aave'
  };

  let unsubNexus: (() => void) | null = null;

  onMount(() => {
    // Bootstrap with REST snapshot of all tickers, then subscribe globally
    (async () => {
      const all = await nexusMarket.getAllTickers();
      for (const t of all) {
        marketStore.updateTicker(t.symbol, {
          symbol: t.symbol,
          price: t.price,
          change24h: t.change24h,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: t.volume24h
        });
      }
    })();

    // Subscribe globally — the feed will fire for whichever symbol is active
    unsubNexus = nexusMarket.subscribeAll((tick) => {
      // The store is already updated inside nexusMarket; nothing else to do
    });

    return () => {
      unsubscribe();
      unsubNexus?.();
    };
  });

  onDestroy(() => {
    unsubscribe();
    unsubNexus?.();
  });

  const filteredSymbols = $derived.by(() => {
    let list = ALL_SYMBOLS;
    if (tab === 'favorites') {
      list = list.filter((s) => $favorites.includes(s));
    } else if (tab === 'usdt') {
      list = list.filter((s) => s.endsWith('USDT'));
    } else if (tab === 'btc') {
      list = list.filter((s) => s.endsWith('BTC'));
    }
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((s) => s.includes(q) || (SYMBOL_NAMES[s] || '').toUpperCase().includes(q));
    }
    return list;
  });
</script>

<div class="h-full flex flex-col">
  <div class="px-3 pt-2 pb-3 border-b border-white/5">
    <h3 class="text-xs font-bold text-white mb-2">الأسواق</h3>
    <div class="relative mb-2">
      <Search size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        bind:value={search}
        type="text"
        placeholder="بحث..."
        class="w-full bg-ink-950/60 border border-white/5 rounded-lg pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-accent-gold/30"
      />
    </div>
    <div class="flex gap-1">
      {#each [{ k: 'all', l: 'الكل' }, { k: 'favorites', l: 'المفضلة' }, { k: 'usdt', l: 'USDT' }] as t}
        <button
          class="flex-1 text-[10px] py-1 rounded-md font-medium transition-colors {tab === t.k ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400 hover:bg-white/5'}"
          onclick={() => (tab = t.k as any)}
        >
          {t.l}
        </button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
    <span class="col-span-1 text-right">الزوج</span>
    <span class="text-left">السعر</span>
    <span class="text-left">24h%</span>
    <span class="text-left">الحجم</span>
  </div>

  <div class="flex-1 overflow-y-auto scrollbar-none">
    {#each filteredSymbols as sym}
      {@const t = tickers[sym]}
      {@const { base } = formatSymbol(sym)}
      {@const isFav = $favorites.includes(sym)}
      <div
        role="button"
        tabindex="0"
        onclick={() => onSelect(sym)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sym); } }}
        class="w-full grid grid-cols-4 gap-2 px-3 py-2 text-xs hover:bg-white/[0.03] transition-colors border-b border-white/[0.02] cursor-pointer {selectedSymbol === sym ? 'bg-accent-gold/[0.04]' : ''}"
      >
        <div class="col-span-1 flex items-center gap-1.5 min-w-0">
          <button
            onclick={(e) => {
              e.stopPropagation();
              favorites.toggle(sym);
            }}
            class="shrink-0 hover:scale-110 transition-transform"
            aria-label="إضافة للمفضلة"
          >
            <Star
              size={11}
              class={isFav ? 'text-accent-gold fill-accent-gold' : 'text-slate-600'}
            />
          </button>
          <div class="min-w-0">
            <div class="font-semibold text-white text-[11px] truncate">{base}</div>
            <div class="text-[9px] text-slate-500 truncate">{SYMBOL_NAMES[sym] || ''}</div>
          </div>
        </div>
        <span class="text-left font-mono text-slate-200 tabular-nums self-center">
          {t ? formatPrice(t.price) : '--'}
        </span>
        <span class="text-left font-mono self-center tabular-nums {t && t.change24h >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
          {t ? `${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(1)}%` : '--'}
        </span>
        <span class="text-left font-mono text-slate-400 self-center tabular-nums text-[10px]">
          {t ? formatCompact(t.volume24h) : '--'}
        </span>
      </div>
    {/each}
    {#if filteredSymbols.length === 0}
      <div class="py-8 text-center text-slate-500 text-xs">
        <Star size={24} class="mx-auto mb-2 opacity-30" />
        لا توجد رموز
      </div>
    {/if}
  </div>
</div>
