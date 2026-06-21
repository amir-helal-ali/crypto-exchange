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

type priceCache struct {
        prices map[string]float64
        mu     sync.RWMutex
}

var (
        binanceClient = &http.Client{Timeout: 10 * time.Second}
        cache         = &priceCache{prices: make(map[string]float64)}
        symbols       = []string{"BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT"}
)

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

func fetchPrices() {
        url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/price?symbols=%s", symbolsJSON())

        res, err := binanceClient.Get(url)
        if err != nil {
                log.Printf("MatchingEngine: failed to fetch prices: %v", err)
                return
        }
        defer res.Body.Close()

        var raw []binancePrice
        if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
                log.Printf("MatchingEngine: failed to decode prices: %v", err)
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
}

func getPrice(symbol string) (float64, bool) {
        cache.mu.RLock()
        defer cache.mu.RUnlock()
        p, ok := cache.prices[symbol]
        return p, ok
}

// processOrders processes all pending orders: STOP_LIMIT, TAKE_PROFIT, and LIMIT
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
        log.Printf("MatchingEngine: starting with interval %v", interval)

        // Run initial fetch + processing in a goroutine so the HTTP server
        // can start immediately. Without this, if Binance is slow/unreachable
        // or DB is busy during AutoMigrate, the health check fails because
        // the HTTP server hasn't started yet.
        go func() {
                fetchPrices()
                processOrders()

                ticker := time.NewTicker(interval)
                for range ticker.C {
                        fetchPrices()
                        processOrders()
                }
        }()

        log.Printf("MatchingEngine: started successfully")
}
