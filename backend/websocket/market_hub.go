package websocket

import (
        "encoding/json"
        "log"
        "net/http"
        "strconv"
        "strings"
        "sync"
        "time"

        "github.com/gin-gonic/gin"
        gorillaws "github.com/gorilla/websocket"
)

// ──────────────────────────────────────────────────────────────────────────
// Ticker hook — breaks the import cycle with the matching package.
//
// The matching engine needs to be notified on every live ticker update
// (so it can evaluate STOP_LIMIT / TAKE_PROFIT / LIMIT orders with
// zero polling latency), but the matching package also needs to read
// ticker prices from MarketHub — which would create an import cycle.
//
// Solution: MarketHub exposes a SetTickerHook(fn) setter. The matching
// engine registers its OnTickerUpdate function via this setter at
// startup (from main.go, which can import both packages). MarketHub
// calls the hook on every tick without importing matching.
// ──────────────────────────────────────────────────────────────────────────

var (
        tickerHookMu sync.RWMutex
        tickerHook   func(symbol string, price float64)
)

// SetTickerHook registers a callback invoked on every live ticker
// update received from Binance. Pass nil to unregister.
//
// The hook is called in a goroutine (non-blocking) so the MarketHub
// broadcast loop is never held up by the matching engine's DB work.
func SetTickerHook(fn func(symbol string, price float64)) {
        tickerHookMu.Lock()
        defer tickerHookMu.Unlock()
        tickerHook = fn
}

func callTickerHook(symbol string, price float64) {
        tickerHookMu.RLock()
        fn := tickerHook
        tickerHookMu.RUnlock()
        if fn == nil {
                return
        }
        go fn(symbol, price)
}

// ──────────────────────────────────────────────────────────────────────────
// MarketHub — single source of truth for all live market data.
//
// Maintains ONE persistent combined stream to Binance that carries every
// channel we need (miniTicker, kline, trade, depth) for every supported
// symbol.  Incoming messages are routed to interested client connections
// based on their subscriptions.
//
// Clients can either:
//   • Open a dedicated single-purpose socket  →  /ws/kline, /ws/trades,
//     /ws/orderbook  (backwards-compatible, simple)
//   • Open a single multiplexed socket        →  /ws/market
//     and send {"action":"subscribe","symbols":[...],"channels":[...]}
//     messages to dynamically select what they want.
// ──────────────────────────────────────────────────────────────────────────

// Supported Binance symbols (lowercase for stream URLs).
var supportedSymbols = []string{
        "btcusdt", "ethusdt", "bnbusdt", "solusdt",
        "xrpusdt", "adausdt", "dogeusdt", "dotusdt",
}

// Supported kline intervals.
var supportedIntervals = []string{"1m", "5m", "15m", "1h", "4h", "1d"}

// ── Incoming Binance message shapes ───────────────────────────────────────

type binanceMiniTicker struct {
        Symbol       string `json:"s"`
        Price        string `json:"c"`
        High         string `json:"h"`
        Low          string `json:"l"`
        Volume       string `json:"v"`    // base volume
        QuoteVolume  string `json:"q"`    // quote volume (USDT)
        PriceChange  string `json:"P"`    // 24h change %
}

type binanceKlineEvent struct {
        Symbol string `json:"s"`
        Kline  struct {
                StartTime       int64  `json:"t"`
                EndTime         int64  `json:"T"`
                Open            string `json:"o"`
                High            string `json:"h"`
                Low             string `json:"l"`
                Close           string `json:"c"`
                Volume          string `json:"v"`
                QuoteVolume     string `json:"q"`
                IsClosed        bool   `json:"x"`
                Interval        string `json:"i"`
        } `json:"k"`
}

type binanceTrade struct {
        Symbol    string `json:"s"`
        Price     string `json:"p"`
        Qty       string `json:"q"`
        TradeTime int64  `json:"T"`
        IsBuyer   bool   `json:"m"` // true = buyer is market maker → SELL side aggressor
        TradeID   int64  `json:"t"`
}

type binanceDepth struct {
        LastUpdateID int64        `json:"lastUpdateId"`
        Bids         [][2]string  `json:"bids"`
        Asks         [][2]string  `json:"asks"`
}

type binanceCombinedMsg struct {
        Stream string          `json:"stream"`
        Data   json.RawMessage `json:"data"`
}

// ── Outgoing client message shapes (what we send to browsers) ─────────────

type ClientMsg struct {
        Type string      `json:"type"` // "ticker" | "kline" | "trade" | "depth" | "snapshot" | "error"
        Sym  string      `json:"symbol,omitempty"`
        Data interface{} `json:"data,omitempty"`
        Msg  string      `json:"message,omitempty"`
}

// ── Per-symbol caches ─────────────────────────────────────────────────────

type TickerCache struct {
        Symbol     string  `json:"symbol"`
        Price      float64 `json:"price"`
        Change24h  float64 `json:"change_24h"`
        High24h    float64 `json:"high_24h"`
        Low24h     float64 `json:"low_24h"`
        Volume24h  float64 `json:"volume_24h"`
        QuoteVol   float64 `json:"quote_volume_24h"`
        UpdatedAt  int64   `json:"ts"`
}

type OrderbookCache struct {
        Bids       [][2]float64 `json:"bids"`
        Asks       [][2]float64 `json:"asks"`
        UpdatedAt  int64        `json:"ts"`
}

type TradeCache struct {
        ID     int64   `json:"id"`
        Price  float64 `json:"price"`
        Qty    float64 `json:"qty"`
        Side   string  `json:"side"` // "BUY" | "SELL"
        Time   int64   `json:"time"`
}

// ── Hub state ─────────────────────────────────────────────────────────────

type MarketHub struct {
        mu sync.RWMutex

        // Per-symbol caches (uppercase symbol keys)
        tickers    map[string]*TickerCache
        orderbooks map[string]*OrderbookCache
        trades     map[string][]TradeCache // last N trades per symbol

        // Per-symbol per-interval last kline (for snapshot bootstrapping)
        klines map[string]map[string]binanceKlineEvent // sym → interval → last kline

        // Client subscriptions
        clients    map[*MarketClient]bool
        register   chan *MarketClient
        unregister chan *MarketClient

        // Binance reconnect signal
        binanceReconnect chan struct{}
}

type MarketClient struct {
        conn     *gorillaws.Conn
        send     chan []byte
        subs     map[string]map[string]bool // symbol → set of channels ("ticker","trade","depth","kline_1m",...)
        subsMu   sync.RWMutex
        hub      *MarketHub
        closed   bool
        closeMu  sync.Mutex
}

const (
        clientSendBufSize = 512
        maxTradesPerSym   = 30
)

var GlobalMarketHub = &MarketHub{
        tickers:          make(map[string]*TickerCache),
        orderbooks:       make(map[string]*OrderbookCache),
        trades:           make(map[string][]TradeCache),
        klines:           make(map[string]map[string]binanceKlineEvent),
        clients:          make(map[*MarketClient]bool),
        register:         make(chan *MarketClient, 64),
        unregister:       make(chan *MarketClient, 64),
        binanceReconnect: make(chan struct{}, 1),
}

func init() {
        go GlobalMarketHub.run()
        go GlobalMarketHub.connectBinance()
}

// ── Hub main loop ─────────────────────────────────────────────────────────

func (h *MarketHub) run() {
        ticker := time.NewTicker(2 * time.Second)
        defer ticker.Stop()
        for {
                select {
                case c := <-h.register:
                        h.mu.Lock()
                        h.clients[c] = true
                        h.mu.Unlock()
                        log.Printf("[MarketHub] client connected (%d total)", len(h.clients))
                        // Send bootstrap snapshots for any symbols this client is interested in
                        h.sendBootstrap(c)
                case c := <-h.unregister:
                        h.mu.Lock()
                        if _, ok := h.clients[c]; ok {
                                delete(h.clients, c)
                        }
                        h.mu.Unlock()
                        c.safeClose()
                        log.Printf("[MarketHub] client disconnected (%d total)", len(h.clients))
                case <-ticker.C:
                        // periodic noop — placeholder for future stats
                }
        }
}

// ── Binance combined stream ───────────────────────────────────────────────

func (h *MarketHub) connectBinance() {
        // Build a single combined stream URL carrying every channel/symbol we need.
        streams := []string{}
        for _, s := range supportedSymbols {
                streams = append(streams, s+"@miniTicker")
                streams = append(streams, s+"@trade")
                streams = append(streams, s+"@depth20@100ms")
        }
        for _, s := range supportedSymbols {
                for _, iv := range supportedIntervals {
                        streams = append(streams, s+"@kline_"+iv)
                }
        }
        url := "wss://stream.binance.com:9443/stream?streams=" + strings.Join(streams, "/")

        for {
                log.Printf("[MarketHub] connecting to Binance combined stream (%d sub-streams)", len(streams))
                conn, _, err := gorillaws.DefaultDialer.Dial(url, nil)
                if err != nil {
                        log.Printf("[MarketHub] Binance dial failed: %v — retrying in 5s", err)
                        time.Sleep(5 * time.Second)
                        continue
                }
                log.Printf("[MarketHub] Binance combined stream connected")

                for {
                        _, raw, err := conn.ReadMessage()
                        if err != nil {
                                log.Printf("[MarketHub] Binance read error: %v — reconnecting", err)
                                conn.Close()
                                break
                        }
                        h.handleBinanceMessage(raw)
                }
        }
}

func (h *MarketHub) handleBinanceMessage(raw []byte) {
        var combined binanceCombinedMsg
        if err := json.Unmarshal(raw, &combined); err != nil {
                return
        }
        parts := strings.Split(combined.Stream, "@")
        if len(parts) < 2 {
                return
        }
        symLower := parts[0]
        channel := parts[1]
        symUpper := strings.ToUpper(symLower)

        switch {
        case channel == "miniticker":
                var t binanceMiniTicker
                if err := json.Unmarshal(combined.Data, &t); err != nil {
                        return
                }
                h.cacheTicker(symUpper, &t)
                h.broadcastTicker(symUpper)
        case strings.HasPrefix(channel, "kline_"):
                interval := strings.TrimPrefix(channel, "kline_")
                var k binanceKlineEvent
                if err := json.Unmarshal(combined.Data, &k); err != nil {
                        return
                }
                h.cacheKline(symUpper, interval, &k)
                h.broadcastKline(symUpper, interval, &k)
        case channel == "trade":
                var tr binanceTrade
                if err := json.Unmarshal(combined.Data, &tr); err != nil {
                        return
                }
                h.cacheTrade(symUpper, &tr)
                h.broadcastTrade(symUpper, &tr)
        case strings.HasPrefix(channel, "depth"):
                // Binance partial book depth stream payload (top-20 levels @ 100ms)
                var d binanceDepth
                if err := json.Unmarshal(combined.Data, &d); err != nil {
                        return
                }
                h.cacheOrderbook(symUpper, &d)
                h.broadcastDepth(symUpper, &d)
        }
}

// ── Cache updaters ────────────────────────────────────────────────────────

func parseFloat(s string) float64 {
        f, _ := strconv.ParseFloat(s, 64)
        return f
}

func (h *MarketHub) cacheTicker(sym string, t *binanceMiniTicker) {
        h.mu.Lock()
        price := parseFloat(t.Price)
        h.tickers[sym] = &TickerCache{
                Symbol:    sym,
                Price:     price,
                Change24h: parseFloat(t.PriceChange),
                High24h:   parseFloat(t.High),
                Low24h:    parseFloat(t.Low),
                Volume24h: parseFloat(t.Volume),
                QuoteVol:  parseFloat(t.QuoteVolume),
                UpdatedAt: time.Now().UnixMilli(),
        }
        h.mu.Unlock()

        // Event-driven matching: invoke the registered ticker hook (set by
        // the matching package via SetTickerHook at startup). Runs in a
        // goroutine so the MarketHub broadcast loop is never blocked by
        // the matching engine's DB transactions.
        callTickerHook(sym, price)
}

func (h *MarketHub) cacheKline(sym, interval string, k *binanceKlineEvent) {
        h.mu.Lock()
        defer h.mu.Unlock()
        if h.klines[sym] == nil {
                h.klines[sym] = make(map[string]binanceKlineEvent)
        }
        h.klines[sym][interval] = *k
}

func (h *MarketHub) cacheTrade(sym string, tr *binanceTrade) {
        h.mu.Lock()
        defer h.mu.Unlock()
        side := "BUY"
        if tr.IsBuyer {
                side = "SELL" // buyer is maker → aggressor is seller
        }
        t := TradeCache{
                ID:    tr.TradeID,
                Price: parseFloat(tr.Price),
                Qty:   parseFloat(tr.Qty),
                Side:  side,
                Time:  tr.TradeTime,
        }
        trades := h.trades[sym]
        trades = append([]TradeCache{t}, trades...)
        if len(trades) > maxTradesPerSym {
                trades = trades[:maxTradesPerSym]
        }
        h.trades[sym] = trades
}

func (h *MarketHub) cacheOrderbook(sym string, d *binanceDepth) {
        h.mu.Lock()
        defer h.mu.Unlock()
        bids := make([][2]float64, 0, len(d.Bids))
        for _, b := range d.Bids {
                bids = append(bids, [2]float64{parseFloat(b[0]), parseFloat(b[1])})
        }
        asks := make([][2]float64, 0, len(d.Asks))
        for _, a := range d.Asks {
                asks = append(asks, [2]float64{parseFloat(a[0]), parseFloat(a[1])})
        }
        h.orderbooks[sym] = &OrderbookCache{
                Bids:      bids,
                Asks:      asks,
                UpdatedAt: time.Now().UnixMilli(),
        }
}

// ── Broadcasters ──────────────────────────────────────────────────────────

func (h *MarketHub) broadcastTicker(sym string) {
        h.mu.RLock()
        tc, ok := h.tickers[sym]
        clients := make([]*MarketClient, 0, len(h.clients))
        for c := range h.clients {
                clients = append(clients, c)
        }
        h.mu.RUnlock()
        if !ok {
                return
        }
        msg, _ := json.Marshal(ClientMsg{
                Type: "ticker", Sym: sym, Data: tc,
        })
        for _, c := range clients {
                if c.isSubscribed(sym, "ticker") {
                        c.trySend(msg)
                }
        }
}

func (h *MarketHub) broadcastKline(sym, interval string, k *binanceKlineEvent) {
        h.mu.RLock()
        clients := make([]*MarketClient, 0, len(h.clients))
        for c := range h.clients {
                clients = append(clients, c)
        }
        h.mu.RUnlock()
        out := map[string]interface{}{
                "symbol":    sym,
                "interval":  interval,
                "time":      k.Kline.StartTime / 1000,
                "open":      parseFloat(k.Kline.Open),
                "high":      parseFloat(k.Kline.High),
                "low":       parseFloat(k.Kline.Low),
                "close":     parseFloat(k.Kline.Close),
                "volume":    parseFloat(k.Kline.Volume),
                "closed":    k.Kline.IsClosed,
        }
        msg, _ := json.Marshal(ClientMsg{
                Type: "kline", Sym: sym, Data: out,
        })
        ch := "kline_" + interval
        for _, c := range clients {
                if c.isSubscribed(sym, ch) {
                        c.trySend(msg)
                }
        }
}

func (h *MarketHub) broadcastTrade(sym string, tr *binanceTrade) {
        h.mu.RLock()
        clients := make([]*MarketClient, 0, len(h.clients))
        for c := range h.clients {
                clients = append(clients, c)
        }
        h.mu.RUnlock()
        side := "BUY"
        if tr.IsBuyer {
                side = "SELL"
        }
        out := map[string]interface{}{
                "symbol": sym,
                "id":     tr.TradeTime,
                "price":  parseFloat(tr.Price),
                "qty":    parseFloat(tr.Qty),
                "side":   side,
                "time":   tr.TradeTime,
        }
        msg, _ := json.Marshal(ClientMsg{
                Type: "trade", Sym: sym, Data: out,
        })
        for _, c := range clients {
                if c.isSubscribed(sym, "trade") {
                        c.trySend(msg)
                }
        }
}

func (h *MarketHub) broadcastDepth(sym string, d *binanceDepth) {
        h.mu.RLock()
        clients := make([]*MarketClient, 0, len(h.clients))
        for c := range h.clients {
                clients = append(clients, c)
        }
        h.mu.RUnlock()
        bids := make([][2]float64, 0, len(d.Bids))
        for _, b := range d.Bids {
                bids = append(bids, [2]float64{parseFloat(b[0]), parseFloat(b[1])})
        }
        asks := make([][2]float64, 0, len(d.Asks))
        for _, a := range d.Asks {
                asks = append(asks, [2]float64{parseFloat(a[0]), parseFloat(a[1])})
        }
        out := map[string]interface{}{
                "symbol": sym,
                "bids":   bids,
                "asks":   asks,
                "ts":     time.Now().UnixMilli(),
        }
        msg, _ := json.Marshal(ClientMsg{
                Type: "depth", Sym: sym, Data: out,
        })
        for _, c := range clients {
                if c.isSubscribed(sym, "depth") {
                        c.trySend(msg)
                }
        }
}

// ── Bootstrap snapshots (sent on client connect) ──────────────────────────

func (h *MarketHub) sendBootstrap(c *MarketClient) {
        c.subsMu.RLock()
        symbols := make([]string, 0, len(c.subs))
        for sym := range c.subs {
                symbols = append(symbols, sym)
        }
        c.subsMu.RUnlock()

        if len(symbols) == 0 {
                return
        }

        h.mu.RLock()
        defer h.mu.RUnlock()

        for _, sym := range symbols {
                if tc, ok := h.tickers[sym]; ok && c.isSubscribed(sym, "ticker") {
                        msg, _ := json.Marshal(ClientMsg{Type: "ticker", Sym: sym, Data: tc})
                        c.trySend(msg)
                }
                if c.isSubscribed(sym, "depth") {
                        if ob, ok := h.orderbooks[sym]; ok {
                                msg, _ := json.Marshal(ClientMsg{
                                        Type: "depth", Sym: sym,
                                        Data: map[string]interface{}{
                                                "symbol": sym,
                                                "bids":   ob.Bids,
                                                "asks":   ob.Asks,
                                                "ts":     ob.UpdatedAt,
                                        },
                                })
                                c.trySend(msg)
                        }
                }
                if c.isSubscribed(sym, "trade") {
                        if trades, ok := h.trades[sym]; ok && len(trades) > 0 {
                                msg, _ := json.Marshal(ClientMsg{
                                        Type: "trades_snapshot", Sym: sym,
                                        Data: trades,
                                })
                                c.trySend(msg)
                        }
                }
        }
}

// ── Public accessors (for REST endpoints) ─────────────────────────────────

func (h *MarketHub) GetAllTickers() []*TickerCache {
        h.mu.RLock()
        defer h.mu.RUnlock()
        out := make([]*TickerCache, 0, len(h.tickers))
        for _, t := range h.tickers {
                cp := *t
                out = append(out, &cp)
        }
        return out
}

func (h *MarketHub) GetTicker(sym string) *TickerCache {
        h.mu.RLock()
        defer h.mu.RUnlock()
        if t, ok := h.tickers[strings.ToUpper(sym)]; ok {
                cp := *t
                return &cp
        }
        return nil
}

func (h *MarketHub) GetOrderbook(sym string) *OrderbookCache {
        h.mu.RLock()
        defer h.mu.RUnlock()
        if ob, ok := h.orderbooks[strings.ToUpper(sym)]; ok {
                cp := *ob
                return &cp
        }
        return nil
}

func (h *MarketHub) GetRecentTrades(sym string) []TradeCache {
        h.mu.RLock()
        defer h.mu.RUnlock()
        src := h.trades[strings.ToUpper(sym)]
        out := make([]TradeCache, len(src))
        copy(out, src)
        return out
}

// ── Client helpers ────────────────────────────────────────────────────────

func (c *MarketClient) isSubscribed(sym, channel string) bool {
        c.subsMu.RLock()
        defer c.subsMu.RUnlock()
        chans, ok := c.subs[strings.ToUpper(sym)]
        if !ok {
                return false
        }
        return chans[channel]
}

func (c *MarketClient) trySend(msg []byte) {
        defer func() {
                _ = recover()
        }()
        select {
        case c.send <- msg:
        default:
                // buffer full — drop, don't block the hub
        }
}

func (c *MarketClient) safeClose() {
        c.closeMu.Lock()
        defer c.closeMu.Unlock()
        if c.closed {
                return
        }
        c.closed = true
        close(c.send)
        _ = c.conn.Close()
}

// ── Subscription message handling ─────────────────────────────────────────

type subAction struct {
        Action   string   `json:"action"`   // "subscribe" | "unsubscribe"
        Symbols  []string `json:"symbols"`
        Channels []string `json:"channels"` // "ticker","trade","depth","kline_1m","kline_5m",...
}

func (c *MarketClient) handleSubAction(payload []byte) {
        var a subAction
        if err := json.Unmarshal(payload, &a); err != nil {
                return
        }
        c.subsMu.Lock()
        for _, raw := range a.Symbols {
                sym := strings.ToUpper(raw)
                if a.Action == "subscribe" || a.Action == "sub" {
                        if c.subs[sym] == nil {
                                c.subs[sym] = make(map[string]bool)
                        }
                        for _, ch := range a.Channels {
                                c.subs[sym][ch] = true
                        }
                } else if a.Action == "unsubscribe" || a.Action == "unsub" {
                        if c.subs[sym] == nil {
                                continue
                        }
                        if len(a.Channels) == 0 {
                                delete(c.subs, sym)
                        } else {
                                for _, ch := range a.Channels {
                                        delete(c.subs[sym], ch)
                                }
                                if len(c.subs[sym]) == 0 {
                                        delete(c.subs, sym)
                                }
                        }
                }
        }
        c.subsMu.Unlock()
        // Send bootstrap for newly-subscribed symbols
        if a.Action == "subscribe" || a.Action == "sub" {
                c.hub.sendBootstrap(c)
        }
}

// ── HTTP Handlers ─────────────────────────────────────────────────────────

// HandleMarketWebSocket — multiplexed market data socket.
// Clients may pass ?symbols=BTCUSDT,ETHUSDT&channels=ticker,trade,depth,kline_1m
// for an initial subscription, then send JSON messages to dynamically update.
func HandleMarketWebSocket(c *gin.Context) {
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                log.Printf("[MarketHub] upgrade error: %v", err)
                return
        }

        client := &MarketClient{
                conn: conn,
                send: make(chan []byte, clientSendBufSize),
                subs: make(map[string]map[string]bool),
                hub:  GlobalMarketHub,
        }

        // Parse initial subscription from query string
        if syms := c.Query("symbols"); syms != "" {
                channels := []string{"ticker"}
                if ch := c.Query("channels"); ch != "" {
                        channels = strings.Split(ch, ",")
                }
                client.subsMu.Lock()
                for _, raw := range strings.Split(syms, ",") {
                        sym := strings.ToUpper(strings.TrimSpace(raw))
                        if sym == "" {
                                continue
                        }
                        if client.subs[sym] == nil {
                                client.subs[sym] = make(map[string]bool)
                        }
                        for _, ch := range channels {
                                client.subs[sym][strings.TrimSpace(ch)] = true
                        }
                }
                client.subsMu.Unlock()
        }

        GlobalMarketHub.register <- client

        go client.writePump()
        go client.readPump()
}

// HandleKlineWebSocket — backwards-compatible single-symbol kline stream.
// URL: /ws/kline?symbol=BTCUSDT&interval=1m
func HandleKlineWebSocket(c *gin.Context) {
        sym := strings.ToUpper(c.DefaultQuery("symbol", "BTCUSDT"))
        interval := c.DefaultQuery("interval", "1m")
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                return
        }
        client := &MarketClient{
                conn: conn,
                send: make(chan []byte, clientSendBufSize),
                subs: map[string]map[string]bool{
                        sym: {"kline_" + interval: true},
                },
                hub: GlobalMarketHub,
        }
        GlobalMarketHub.register <- client
        go client.writePump()
        go client.readPump()
}

// HandleTradesWebSocket — backwards-compatible single-symbol trades stream.
// URL: /ws/trades?symbol=BTCUSDT
func HandleTradesWebSocket(c *gin.Context) {
        sym := strings.ToUpper(c.DefaultQuery("symbol", "BTCUSDT"))
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                return
        }
        client := &MarketClient{
                conn: conn,
                send: make(chan []byte, clientSendBufSize),
                subs: map[string]map[string]bool{
                        sym: {"trade": true, "ticker": true},
                },
                hub: GlobalMarketHub,
        }
        GlobalMarketHub.register <- client
        go client.writePump()
        go client.readPump()
}

// HandleOrderbookWebSocket — backwards-compatible single-symbol depth stream.
// URL: /ws/orderbook?symbol=BTCUSDT
func HandleOrderbookWebSocket(c *gin.Context) {
        sym := strings.ToUpper(c.DefaultQuery("symbol", "BTCUSDT"))
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                return
        }
        client := &MarketClient{
                conn: conn,
                send: make(chan []byte, clientSendBufSize),
                subs: map[string]map[string]bool{
                        sym: {"depth": true, "ticker": true},
                },
                hub: GlobalMarketHub,
        }
        GlobalMarketHub.register <- client
        go client.writePump()
        go client.readPump()
}

// ── Client read/write pumps ───────────────────────────────────────────────

func (c *MarketClient) readPump() {
        defer func() {
                c.hub.unregister <- c
        }()
        c.conn.SetReadLimit(4096)
        c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
        c.conn.SetPongHandler(func(string) error {
                c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
                return nil
        })
        for {
                _, payload, err := c.conn.ReadMessage()
                if err != nil {
                        return
                }
                // Payload may be a subscribe/unsubscribe JSON action
                c.handleSubAction(payload)
        }
}

func (c *MarketClient) writePump() {
        pingTicker := time.NewTicker(30 * time.Second)
        defer func() {
                pingTicker.Stop()
                c.safeClose()
        }()
        for {
                select {
                case msg, ok := <-c.send:
                        c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if !ok {
                                _ = c.conn.WriteMessage(gorillaws.CloseMessage, []byte{})
                                return
                        }
                        if err := c.conn.WriteMessage(gorillaws.TextMessage, msg); err != nil {
                                return
                        }
                case <-pingTicker.C:
                        c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if err := c.conn.WriteMessage(gorillaws.PingMessage, nil); err != nil {
                                return
                        }
                }
        }
}

// ── HTTP helpers for fallback REST snapshot ───────────────────────────────

// ServeAllTickersJSON writes a JSON array of all cached tickers (REST bootstrap).
func ServeAllTickersJSON(c *gin.Context) {
        c.JSON(http.StatusOK, GlobalMarketHub.GetAllTickers())
}

// ServeOrderbookJSON writes the cached orderbook snapshot for a symbol.
func ServeOrderbookJSON(c *gin.Context) {
        sym := strings.ToUpper(c.DefaultQuery("symbol", "BTCUSDT"))
        ob := GlobalMarketHub.GetOrderbook(sym)
        if ob == nil {
                c.JSON(http.StatusOK, gin.H{"symbol": sym, "bids": [][2]float64{}, "asks": [][2]float64{}})
                return
        }
        c.JSON(http.StatusOK, gin.H{
                "symbol": sym,
                "bids":   ob.Bids,
                "asks":   ob.Asks,
                "ts":     ob.UpdatedAt,
        })
}

// ServeRecentTradesJSON writes the cached recent trades for a symbol.
func ServeRecentTradesJSON(c *gin.Context) {
        sym := strings.ToUpper(c.DefaultQuery("symbol", "BTCUSDT"))
        c.JSON(http.StatusOK, gin.H{
                "symbol": sym,
                "trades": GlobalMarketHub.GetRecentTrades(sym),
        })
}
