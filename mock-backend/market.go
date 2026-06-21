package main

import (
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// ============================================================
// NEXUS Market Engine
// Generates deterministic-but-realistic OHLCV candles for any
// symbol so the chart is fed by NEXUS's own market (no Binance,
// no TradingView). A live tick simulator streams price updates
// over WebSocket for a true "exchange feel".
// ============================================================

// ---- Symbol base prices (USD) ----
var symbolBasePrice = map[string]float64{
	"BTCUSDT":  67000,
	"ETHUSDT":  3500,
	"BNBUSDT":  600,
	"SOLUSDT":  165,
	"XRPUSDT":  0.62,
	"ADAUSDT":  0.45,
	"DOGEUSDT": 0.16,
	"AVAXUSDT": 38,
	"DOTUSDT":  7.2,
	"LINKUSDT": 14.5,
	"MATICUSDT": 0.72,
	"TRXUSDT":  0.12,
	"LTCUSDT":  85,
	"ATOMUSDT": 9.1,
	"NEARUSDT": 5.4,
	"APTUSDT":  9.8,
	"ARBUSDT":  1.15,
	"OPUSDT":   2.35,
	"INJUSDT":  27,
	"SUIUSDT":  1.45,
}

// Timeframe → seconds
var tfSeconds = map[string]int64{
	"1m": 60,
	"5m": 300,
	"15m": 900,
	"1H": 3600,
	"4H": 14400,
	"1D": 86400,
	"1W": 604800,
}

// ---- Deterministic PRNG (xorshift) ----
type nexusRng struct{ state uint64 }

func newRng(seed uint64) *nexusRng {
	if seed == 0 {
		seed = 0x9E3779B97F4A7C15
	}
	return &nexusRng{state: seed}
}

func (r *nexusRng) next() uint64 {
	x := r.state
	x ^= x << 13
	x ^= x >> 7
	x ^= x << 17
	r.state = x
	return x
}

func (r *nexusRng) float() float64 {
	return float64(r.next()>>11) / float64(1<<53)
}

// hashStr produces a stable 64-bit seed from a string
func hashStr(s string) uint64 {
	var h uint64 = 1469598103934665603
	for i := 0; i < len(s); i++ {
		h ^= uint64(s[i])
		h *= 1099511628211
	}
	return h
}

// basePriceFor returns the seed price of a symbol
func basePriceFor(symbol string) float64 {
	if p, ok := symbolBasePrice[symbol]; ok {
		return p
	}
	// Fallback deterministic price for unknown symbols
	return 10 + float64(hashStr(symbol)%1000)/10
}

// volatilityFor returns a per-symbol volatility (fraction of price)
func volatilityFor(symbol string) float64 {
	v := 0.012 // ~1.2% per candle default
	switch {
	case len(symbol) >= 4 && symbol[:3] == "BTC":
		v = 0.008
	case len(symbol) >= 3 && symbol[:3] == "ETH":
		v = 0.011
	case len(symbol) >= 3 && symbol[:3] == "SOL":
		v = 0.018
	case len(symbol) >= 4 && symbol[:4] == "DOGE":
		v = 0.025
	}
	return v
}

// ---- Candle model ----
type nexusCandle struct {
	Time   int64   `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

// generateCandles builds a slice of candles ending at `now` for the given
// symbol + interval. Deterministic for a given (symbol, interval, now),
// so the same call always returns the same series — but with realistic
// geometric-Brownian-motion drift + occasional volatility clusters.
func generateCandles(symbol, interval string, limit int, now time.Time) []nexusCandle {
	step, ok := tfSeconds[interval]
	if !ok {
		step = 3600
	}
	// Align "now" to the latest closed candle
	nowUnix := now.Unix()
	nowUnix -= nowUnix % step
	nowUnix -= step // last *closed* candle

	base := basePriceFor(symbol)
	vol := volatilityFor(symbol)

	// Seed depends on symbol + interval so different pairs have different paths
	seed := hashStr(symbol + "|" + interval)
	rng := newRng(seed)

	// We need `limit` candles; the oldest is at index 0.
	// Build forward from oldest to newest, starting at base * (1 - drift_offset)
	startTime := nowUnix - int64(limit-1)*step
	drift := 0.0002 // slight upward drift per candle

	// Initialize close = base * small_offset so the chart starts a bit below base
	price := base * (1 - 0.05)
	candles := make([]nexusCandle, limit)

	// Walk forward `limit` candles; we advance the price by GBM-like steps.
	for i := 0; i < limit; i++ {
		t := startTime + int64(i)*step
		open := price

		// Volatility clustering: occasional spikes
		localVol := vol
		if rng.float() < 0.05 {
			localVol = vol * (2 + rng.float()*2) // spike
		}

		// Random shock ~ N(0,1) approx via Box-Muller
		u1 := rng.float()
		u2 := rng.float()
		if u1 < 1e-12 {
			u1 = 1e-12
		}
		z := math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)

		// ret = drift + vol * z
		ret := drift + localVol*z
		close := open * (1 + ret)

		// High/low for the candle
		// Intrabar range scales with localVol
		rangePct := localVol * (0.5 + rng.float()*0.8)
		high := math.Max(open, close) * (1 + rangePct*rng.float())
		low := math.Min(open, close) * (1 - rangePct*rng.float())

		// Volume: base volume scales with price * a random factor
		// Higher on volatile candles (spike days)
		baseVol := base * 1000 // arbitrary normalization
		volMult := 1.0 + math.Abs(z)*0.6 + rng.float()*0.5
		if localVol > vol*1.5 {
			volMult += 1.5
		}
		volume := baseVol * volMult

		candles[i] = nexusCandle{
			Time:   t * 1000, // ms
			Open:   open,
			High:   high,
			Low:    low,
			Close:  close,
			Volume: volume,
		}
		price = close
	}

	// For the most recent candle (the one currently forming), we DO NOT
	// regenerate on every request — we want continuity. But since this is
	// a deterministic engine, the latest candle's close stays fixed until
	// the next interval boundary. Live updates come via the WebSocket
	// tick simulator.
	return candles
}

// ---- Ticker (24h stats) ----
type nexusTicker struct {
	Symbol     string  `json:"symbol"`
	Price      float64 `json:"price"`
	Change24h  float64 `json:"change_24h"`
	High24h    float64 `json:"high_24h"`
	Low24h     float64 `json:"low_24h"`
	Volume24h  float64 `json:"volume_24h"`
	QuoteVol   float64 `json:"quote_volume"`
	OpenPrice  float64 `json:"open_price"`
}

func computeTicker(symbol string) nexusTicker {
	candles := generateCandles(symbol, "1H", 25, time.Now())
	if len(candles) == 0 {
		return nexusTicker{Symbol: symbol}
	}
	last := candles[len(candles)-1]
	// 24h ago = ~24 candles back
	idx := len(candles) - 25
	if idx < 0 {
		idx = 0
	}
	open24 := candles[idx].Open
	var high24, low24, vol24 float64
	for i := idx; i < len(candles); i++ {
		if candles[i].High > high24 {
			high24 = candles[i].High
		}
		if low24 == 0 || candles[i].Low < low24 {
			low24 = candles[i].Low
		}
		vol24 += candles[i].Volume
	}
	change := 0.0
	if open24 > 0 {
		change = (last.Close - open24) / open24 * 100
	}
	return nexusTicker{
		Symbol:    symbol,
		Price:     last.Close,
		Change24h: change,
		High24h:   high24,
		Low24h:    low24,
		Volume24h: vol24,
		QuoteVol:  vol24 * last.Close,
		OpenPrice: open24,
	}
}

// ============================================================
// HTTP handlers
// ============================================================

func handleKlines(c *gin.Context) {
	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	interval := c.DefaultQuery("interval", "1H")
	limitStr := c.DefaultQuery("limit", "300")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 1000 {
		limit = 300
	}
	candles := generateCandles(symbol, interval, limit, time.Now())
	c.JSON(http.StatusOK, candles)
}

func handleTicker(c *gin.Context) {
	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	c.JSON(http.StatusOK, computeTicker(symbol))
}

func handleAllTickers(c *gin.Context) {
	out := make([]nexusTicker, 0, len(symbolBasePrice))
	for sym := range symbolBasePrice {
		out = append(out, computeTicker(sym))
	}
	c.JSON(http.StatusOK, out)
}

// ============================================================
// WebSocket: live tick simulator
// ============================================================

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// livePriceState tracks the "current" price per symbol with a smooth random walk
type livePriceState struct {
	mu      sync.Mutex
	prices  map[string]float64
	rng     *nexusRng
}

var liveState = &livePriceState{
	prices: make(map[string]float64),
	rng:    newRng(uint64(time.Now().UnixNano())),
}

func (l *livePriceState) get(symbol string) float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	if p, ok := l.prices[symbol]; ok {
		return p
	}
	// Initialize from the deterministic last close
	t := computeTicker(symbol)
	l.prices[symbol] = t.Price
	return t.Price
}

func (l *livePriceState) tick(symbol string) (price float64, changePct float64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	cur, ok := l.prices[symbol]
	if !ok {
		t := computeTicker(symbol)
		cur = t.Price
	}
	// Random walk with mean reversion to base price
	base := basePriceFor(symbol)
	vol := volatilityFor(symbol)

	u1 := l.rng.float()
	u2 := l.rng.float()
	if u1 < 1e-12 {
		u1 = 1e-12
	}
	z := math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)

	// Mean reversion + noise
	meanRev := (base - cur) / base * 0.0015
	ret := meanRev + vol*0.3*z
	newPrice := cur * (1 + ret)

	// Clamp to ±25% of base to avoid drift runaway
	lo := base * 0.75
	hi := base * 1.25
	if newPrice < lo {
		newPrice = lo
	}
	if newPrice > hi {
		newPrice = hi
	}
	l.prices[symbol] = newPrice

	t := computeTicker(symbol)
	changePct = t.Change24h
	// Adjust change to reflect the live price vs 24h-open
	if t.OpenPrice > 0 {
		changePct = (newPrice - t.OpenPrice) / t.OpenPrice * 100
	}
	return newPrice, changePct
}

// handleMarketWS streams live ticks for a single symbol (or all)
// Protocol: server sends JSON frames like:
//   { "symbol":"BTCUSDT", "price":67234.55, "change_24h":1.42,
//     "high_24h":..., "low_24h":..., "volume_24h":..., "ts":1719000000000 }
//
// Client can send `{"action":"subscribe","symbol":"ETHUSDT"}` to switch.
func handleMarketWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	if _, ok := symbolBasePrice[symbol]; !ok {
		symbol = "BTCUSDT"
	}

	// Read pump: handle subscribe/unsubscribe messages
	go func() {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			// Minimal parse: look for "symbol":"XXX"
			s := string(msg)
			// Crude but works for the simple client we ship
			if i := indexOf(s, `"symbol":"`); i >= 0 {
				start := i + len(`"symbol":"`)
				end := start
				for end < len(s) && s[end] != '"' {
					end++
				}
				if end > start {
					sym := s[start:end]
					if _, ok := symbolBasePrice[sym]; ok {
						symbol = sym
					}
				}
			}
		}
	}()

	// Send an initial snapshot immediately
	p, ch := liveState.tick(symbol)
	t := computeTicker(symbol)
	_ = conn.WriteJSON(map[string]any{
		"symbol":     symbol,
		"price":      p,
		"change_24h": ch,
		"high_24h":   t.High24h,
		"low_24h":    t.Low24h,
		"volume_24h": t.Volume24h,
		"ts":         time.Now().UnixMilli(),
	})

	// Tick loop: 2-3 random intervals per second
	ticker := time.NewTicker(700 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			// Add a sub-tick randomization so updates feel organic
			p, ch := liveState.tick(symbol)
			t := computeTicker(symbol)
			err := conn.WriteJSON(map[string]any{
				"symbol":     symbol,
				"price":      p,
				"change_24h": ch,
				"high_24h":   t.High24h,
				"low_24h":    t.Low24h,
				"volume_24h": t.Volume24h,
				"ts":         time.Now().UnixMilli(),
			})
			if err != nil {
				return
			}
		}
	}
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// ============================================================
// WebSocket: live kline (candle) stream
// ============================================================

// handleKlineWS streams the latest forming candle for a symbol+interval.
// It updates ~every 700ms with the current OHLCV of the in-progress candle.
func handleKlineWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	interval := c.DefaultQuery("interval", "1H")
	if _, ok := symbolBasePrice[symbol]; !ok {
		symbol = "BTCUSDT"
	}
	if _, ok := tfSeconds[interval]; !ok {
		interval = "1H"
	}
	step := tfSeconds[interval]

	// Current candle state — reset on interval boundary
	var candleStart int64
	var openP, highP, lowP, closeP, volP float64

	resetCandle := func() {
		now := time.Now().Unix()
		candleStart = now - (now % step)
		p := liveState.get(symbol)
		openP = p
		highP = p
		lowP = p
		closeP = p
		volP = 0
	}
	resetCandle()

	ticker := time.NewTicker(700 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			now := time.Now().Unix()
			if now-candleStart >= step {
				// Candle closed → start a new one with the current price as open
				resetCandle()
			}
			// Get the latest live price
			p, _ := liveState.tick(symbol)
			if p > highP {
				highP = p
			}
			if p < lowP {
				lowP = p
			}
			closeP = p
			// Incremental volume per tick
			volP += p * (0.1 + 0.4*liveState.rng.float())

			err := conn.WriteJSON(map[string]any{
				"symbol":  symbol,
				"interval": interval,
				"kline": map[string]any{
					"time":   candleStart * 1000,
					"open":   openP,
					"high":   highP,
					"low":    lowP,
					"close":  closeP,
					"volume": volP,
					"closed": false,
				},
				"ts": time.Now().UnixMilli(),
			})
			if err != nil {
				return
			}
		}
	}
}
