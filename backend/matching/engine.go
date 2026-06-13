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

func processOrders() {
	var orders []models.Order
	database.DB.Where("status = ? AND type IN ?", "PENDING", []string{"STOP_LIMIT", "TAKE_PROFIT"}).Find(&orders)

	if len(orders) == 0 {
		return
	}

	for _, order := range orders {
		processOrder(&order)
	}
}

func processOrder(order *models.Order) {
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
			return err
		}

		if order.Type == "STOP_LIMIT" {
			locked.Status = "TRIGGERED"
			if err := dbTx.Save(&locked).Error; err != nil {
				return err
			}

			newOrder := models.Order{
				UserID:   locked.UserID,
				Symbol:   locked.Symbol,
				Side:     locked.Side,
				Type:     "LIMIT",
				Price:    locked.Price,
				Quantity: locked.Quantity,
				Status:   "PENDING",
			}
			if err := dbTx.Create(&newOrder).Error; err != nil {
				return err
			}
		} else if order.Type == "TAKE_PROFIT" {
			locked.Status = "FILLED"
			locked.FilledQuantity = locked.Quantity
			locked.Price = price
			if err := dbTx.Save(&locked).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		log.Printf("MatchingEngine: failed to process order #%d: %v", order.ID, err)
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
		CreatedAt: time.Now(),
	})

	log.Printf("MatchingEngine: order #%d %s %s %s triggered at %.2f", order.ID, order.Side, order.Symbol, order.Type, price)
}

func Start(interval time.Duration) {
	log.Printf("MatchingEngine: starting with interval %v", interval)

	fetchPrices()
	processOrders()

	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			fetchPrices()
			processOrders()
		}
	}()

	log.Printf("MatchingEngine: started successfully")
}
