package matching

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "strings"
        "sync"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/models"
        "crypto-exchange-backend/notifications"

        "gorm.io/gorm"
)

// ──────────────────────────────────────────────────────────────────────
// Matching engine price source
// ──────────────────────────────────────────────────────────────────────
// Previously, the matching engine polled Binance's REST price endpoint
// every 10 seconds (fetchPrices + processOrders in a ticker loop). This
// was the LAST piece of true polling in the project — and it was a
// correctness problem, not just a style problem: between ticks an order
// could briefly be fillable and then unfillable, and a STOP_LIMIT could
// trigger late by up to 10 seconds.
//
// The engine now consumes prices from the MarketHub's live Binance
// WebSocket stream via a price-provider function (injected by main.go
// at startup to avoid an import cycle with the websocket package).
// Two coexisting mechanisms:
//
//   1. Event-driven path (preferred, zero latency):
//      main.go wires websocket.SetTickerHook(matching.OnTickerUpdate)
//      so MarketHub calls OnTickerUpdate on every live tick. The
//      matching engine immediately evaluates pending orders for the
//      updated symbol.
//
//   2. Periodic safety-net path (10s ticker):
//      In case an event is dropped or arrives out-of-order,
//      processOrders() still runs on a 10s timer — but it reads from
//      the injected price provider (no HTTP requests). This is a
//      *consistency check*, not a *data fetch*.
//
// The REST fetcher (fetchPricesBootstrap) is kept ONLY as a one-shot
// bootstrap at startup so the engine can fill orders immediately if
// the MarketHub's WebSocket hasn't connected yet. It runs ONCE, never
// on a timer.
// ──────────────────────────────────────────────────────────────────────

type priceCache struct {
        prices map[string]float64
        mu     sync.RWMutex
}

var (
        binanceClient = &http.Client{Timeout: 10 * time.Second}
        cache         = &priceCache{prices: make(map[string]float64)}
        symbols       = []string{"BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT"}

        // priceProvider is injected by main.go via SetPriceProvider.
        // Returns the live price for a symbol and whether it's available.
        // Defaults to a no-op that always returns false (no live source),
        // in which case the local bootstrap cache is used.
        priceProviderMu sync.RWMutex
        priceProvider   func(symbol string) (float64, bool)
)

// SetPriceProvider injects a function that returns live prices.
// Called from main.go after both packages are imported, breaking
// what would otherwise be an import cycle between matching ↔ websocket.
func SetPriceProvider(fn func(symbol string) (float64, bool)) {
        priceProviderMu.Lock()
        defer priceProviderMu.Unlock()
        priceProvider = fn
}

type binancePrice struct {
        Symbol string `json:"symbol"`
        Price  string `json:"price"`
}

func symbolsJSON() string {
        q := make([]string, len(symbols))
        for i, s := range symbols {
                q[i] = `"` + s + `"`
        }
        return "[" + strings.Join(q, ",") + "]"
}

// fetchPricesBootstrap performs a ONE-SHOT fetch of Binance REST prices
// at startup. This is not polling — it runs exactly once so the matching
// engine has prices to work with before the MarketHub's WebSocket stream
// connects. After the WebSocket is live, all price updates flow through
// OnTickerUpdate.
func fetchPricesBootstrap() {
        url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/price?symbols=%s", symbolsJSON())

        res, err := binanceClient.Get(url)
        if err != nil {
                log.Printf("MatchingEngine: bootstrap price fetch failed (will rely on MarketHub WS): %v", err)
                return
        }
        defer res.Body.Close()

        var raw []binancePrice
        if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
                log.Printf("MatchingEngine: bootstrap decode failed: %v", err)
                return
        }

        cache.mu.Lock()
        for _, p := range raw {
                price := 0.0
                if _, err := fmt.Sscanf(p.Price, "%f", &price); err == nil {
                        cache.prices[p.Symbol] = price
                }
        }
        cache.mu.Unlock()
        log.Printf("MatchingEngine: bootstrap prices loaded for %d symbols", len(raw))
}

// getPrice returns the cached price for a symbol, preferring the
// injected live price provider (set by main.go to read from MarketHub's
// WebSocket-driven cache) and falling back to the local bootstrap
// cache if the provider is unavailable or hasn't received a tick yet.
func getPrice(symbol string) (float64, bool) {
        // Prefer injected live provider (MarketHub cache via WebSocket)
        priceProviderMu.RLock()
        provider := priceProvider
        priceProviderMu.RUnlock()
        if provider != nil {
                if p, ok := provider(symbol); ok && p > 0 {
                        // Mirror into local cache so other code paths see the same value
                        cache.mu.Lock()
                        cache.prices[symbol] = p
                        cache.mu.Unlock()
                        return p, true
                }
        }
        // Fallback to bootstrap cache
        cache.mu.RLock()
        defer cache.mu.RUnlock()
        p, ok := cache.prices[symbol]
        return p, ok
}

// OnTickerUpdate is called by MarketHub on every live Binance tick.
// This is the event-driven entry point that REPLACES the old REST
// polling loop. It updates the local cache and immediately evaluates
// any pending orders for the updated symbol.
//
// Must be fast (called ~10x/sec per symbol) — we hand the actual
// matching work to a goroutine to avoid blocking MarketHub's broadcast.
func OnTickerUpdate(symbol string, price float64) {
        if price <= 0 {
                return
        }
        cache.mu.Lock()
        cache.prices[symbol] = price
        cache.mu.Unlock()

        // Spawn matching for this symbol — non-blocking so MarketHub
        // isn't held up by DB transactions.
        go processOrdersForSymbol(symbol, price)
}

// processOrdersForSymbol evaluates only pending orders for a single
// symbol. Called from OnTickerUpdate (event-driven) and from
// processOrders (safety-net sweep).
func processOrdersForSymbol(symbol string, price float64) {
        if price <= 0 {
                var ok bool
                price, ok = getPrice(symbol)
                if !ok {
                        return
                }
        }

        var orders []models.Order
        if err := database.DB.Where(
                "status = ? AND symbol = ?",
                "PENDING", symbol,
        ).Find(&orders).Error; err != nil {
                return
        }

        for i := range orders {
                switch orders[i].Type {
                case "STOP_LIMIT", "TAKE_PROFIT":
                        processTriggerOrder(&orders[i])
                case "LIMIT":
                        processLimitOrder(&orders[i])
                }
        }
}

// processOrders processes all pending orders: STOP_LIMIT, TAKE_PROFIT, and LIMIT
// Safety-net sweep — runs on a 10s timer in case event-driven
// updates are missed. Reads from MarketHub cache (no HTTP polling).
func processOrders() {
        // Process conditional trigger orders (STOP_LIMIT and TAKE_PROFIT)
        var triggerOrders []models.Order
        database.DB.Where("status = ? AND type IN ?", "PENDING", []string{"STOP_LIMIT", "TAKE_PROFIT"}).Find(&triggerOrders)
        for i := range triggerOrders {
                processTriggerOrder(&triggerOrders[i])
        }

        // Process LIMIT orders (fill when price condition is met)
        var limitOrders []models.Order
        database.DB.Where("status = ? AND type = ?", "PENDING", "LIMIT").Find(&limitOrders)
        for i := range limitOrders {
                processLimitOrder(&limitOrders[i])
        }
}

// processTriggerOrder handles STOP_LIMIT and TAKE_PROFIT orders.
// STOP_LIMIT: triggers when price crosses stopPrice → creates a new LIMIT order
// TAKE_PROFIT: triggers when price crosses stopPrice → fills immediately at market price
func processTriggerOrder(order *models.Order) {
        price, ok := getPrice(order.Symbol)
        if !ok {
                return
        }

        triggered := false
        if order.Type == "STOP_LIMIT" {
                if order.Side == "BUY" && price >= order.StopPrice {
                        triggered = true
                } else if order.Side == "SELL" && price <= order.StopPrice {
                        triggered = true
                }
        } else if order.Type == "TAKE_PROFIT" {
                if order.Side == "BUY" && price <= order.StopPrice {
                        triggered = true
                } else if order.Side == "SELL" && price >= order.StopPrice {
                        triggered = true
                }
        }

        if !triggered {
                return
        }

        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                var locked models.Order
                if err := dbTx.Where("id = ? AND status = ?", order.ID, "PENDING").First(&locked).Error; err != nil {
                        return err // Order already processed or not found
                }

                if locked.Type == "STOP_LIMIT" {
                        // Mark original order as TRIGGERED
                        locked.Status = "TRIGGERED"
                        if err := dbTx.Save(&locked).Error; err != nil {
                                return err
                        }

                        // Create new LIMIT order with inherited reservation
                        newOrder := models.Order{
                                UserID:         locked.UserID,
                                Symbol:         locked.Symbol,
                                Side:           locked.Side,
                                Type:           "LIMIT",
                                Price:          locked.Price,
                                Quantity:       locked.Quantity,
                                ReservedAmount: locked.ReservedAmount,
                                Status:         "PENDING",
                        }
                        if err := dbTx.Create(&newOrder).Error; err != nil {
                                return err
                        }

                } else if locked.Type == "TAKE_PROFIT" {
                        // Fill immediately at current market price with fund transfer
                        return ExecuteFill(dbTx, &locked, price)
                }

                return nil
        })

        if err != nil {
                log.Printf("MatchingEngine: failed to process trigger order #%d: %v", order.ID, err)
                return
        }

        action := "STOP_LIMIT_TRIGGERED"
        if order.Type == "TAKE_PROFIT" {
                action = "TAKE_PROFIT_FILLED"
        }

        database.DB.Create(&models.AuditLog{
                UserID:    order.UserID,
                Action:    action,
                Details:   fmt.Sprintf("Order #%d %s %s triggered at price %.2f (stop: %.2f)", order.ID, order.Side, order.Symbol, price, order.StopPrice),
                IPAddress: "system",
                CreatedAt: time.Now(),
        })

        log.Printf("MatchingEngine: order #%d %s %s %s triggered at %.2f", order.ID, order.Side, order.Symbol, order.Type, price)

        // Send notification to user
        if order.Type == "TAKE_PROFIT" {
                notifications.NotifyOrderFilled(order.UserID, order.Symbol, order.Side, "TAKE_PROFIT", order.Quantity, price, order.ID)
        } else {
                notifications.NotifyOrderTriggered(order.UserID, order.Symbol, order.Side, order.Type, price, order.ID)
        }
}

// processLimitOrder handles LIMIT orders.
// LIMIT BUY:  fills when market price <= order.Price
// LIMIT SELL: fills when market price >= order.Price
// When filled, funds are transferred between wallets via ExecuteFill.
func processLimitOrder(order *models.Order) {
        price, ok := getPrice(order.Symbol)
        if !ok {
                return
        }

        shouldFill := false
        if order.Side == "BUY" && price <= order.Price {
                shouldFill = true
        } else if order.Side == "SELL" && price >= order.Price {
                shouldFill = true
        }

        if !shouldFill {
                return
        }

        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                var locked models.Order
                if err := dbTx.Where("id = ? AND status = ?", order.ID, "PENDING").First(&locked).Error; err != nil {
                        return err // Order already processed or not found
                }

                // Execute fill with fund transfer at current market price
                return ExecuteFill(dbTx, &locked, price)
        })

        if err != nil {
                log.Printf("MatchingEngine: failed to fill LIMIT order #%d: %v", order.ID, err)
                return
        }

        database.DB.Create(&models.AuditLog{
                UserID:    order.UserID,
                Action:    "LIMIT_ORDER_FILLED",
                Details:   fmt.Sprintf("LIMIT %s %s filled at market price %.2f (limit: %.2f, reserved: %.8f)", order.Side, order.Symbol, price, order.Price, order.ReservedAmount),
                IPAddress: "system",
                CreatedAt: time.Now(),
        })

        log.Printf("MatchingEngine: LIMIT order #%d %s %s filled at %.2f (limit was %.2f)", order.ID, order.Side, order.Symbol, price, order.Price)

        // Send notification to user
        notifications.NotifyOrderFilled(order.UserID, order.Symbol, order.Side, "LIMIT", order.Quantity, price, order.ID)
}

func Start(interval time.Duration) {
        log.Printf("MatchingEngine: starting with interval %v (event-driven primary, ticker safety-net)", interval)

        // Run initial bootstrap + processing in a goroutine so the HTTP server
        // can start immediately. Without this, if Binance is slow/unreachable
        // or DB is busy during AutoMigrate, the health check fails because
        // the HTTP server hasn't started yet.
        go func() {
                // ONE-SHOT REST bootstrap — populates the local cache so the
                // matching engine can fill orders immediately if MarketHub's
                // WebSocket hasn't connected yet. NOT polling — runs once only.
                fetchPricesBootstrap()
                processOrders()

                // Safety-net ticker — runs every `interval` (10s by default)
                // to catch any events the event-driven path might have missed.
                // This is NOT polling: it reads from the MarketHub cache (no
                // HTTP requests) and only scans pending orders.
                ticker := time.NewTicker(interval)
                for range ticker.C {
                        processOrders()
                }
        }()

        log.Printf("MatchingEngine: started successfully (live price source: MarketHub WebSocket)")
}
