package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Kline struct {
	Time   float64 `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

type BinanceKline []interface{}

var binanceClient = &http.Client{Timeout: 10 * time.Second}

func GetPrices(c *gin.Context) {
	res, err := binanceClient.Get("https://api.binance.com/api/v3/ticker/24hr?symbols=[\"BTCUSDT\",\"ETHUSDT\",\"SOLUSDT\",\"BNBUSDT\",\"XRPUSDT\",\"ADAUSDT\",\"DOGEUSDT\",\"DOTUSDT\"]")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch prices from Binance"})
		return
	}
	defer res.Body.Close()

	var raw []struct {
		Symbol string `json:"symbol"`
		Price  string `json:"lastPrice"`
		Change string `json:"priceChangePercent"`
		Volume string `json:"volume"`
	}
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Binance response"})
		return
	}

	data := make([]gin.H, 0, len(raw))
	for _, t := range raw {
		data = append(data, gin.H{"pair": t.Symbol, "price": t.Price, "change24h": t.Change, "volume24h": t.Volume})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func GetKlines(c *gin.Context) {
	symbol := c.DefaultQuery("symbol", "BTCUSDT")
	interval := c.DefaultQuery("interval", "1h")
	limitStr := c.DefaultQuery("limit", "168")

	symbol = sanitizeSymbol(symbol)
	interval = sanitizeInterval(interval)

	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 || limit > 500 {
		limit = 168
	}

	url := fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d", symbol, interval, limit)

	resp, err := binanceClient.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch klines from Binance", "detail": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Binance API returned status %d", resp.StatusCode)})
		return
	}

	var binanceData []BinanceKline
	if err := json.NewDecoder(resp.Body).Decode(&binanceData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Binance response"})
		return
	}

	klines := make([]Kline, len(binanceData))
	for i, k := range binanceData {
		ts := k[0].(float64) / 1000
		open, _ := strconv.ParseFloat(k[1].(string), 64)
		high, _ := strconv.ParseFloat(k[2].(string), 64)
		low, _ := strconv.ParseFloat(k[3].(string), 64)
		close_, _ := strconv.ParseFloat(k[4].(string), 64)
		volume, _ := strconv.ParseFloat(k[5].(string), 64)
		klines[i] = Kline{Time: ts, Open: open, High: high, Low: low, Close: close_, Volume: volume}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": klines, "source": "binance"})
}

var validSymbols = map[string]bool{
	"BTCUSDT": true, "ETHUSDT": true, "BNBUSDT": true, "SOLUSDT": true,
	"XRPUSDT": true, "ADAUSDT": true, "DOGEUSDT": true, "DOTUSDT": true,
}

var validIntervals = map[string]bool{
	"1m": true, "3m": true, "5m": true, "15m": true, "30m": true,
	"1h": true, "2h": true, "4h": true, "6h": true, "8h": true,
	"12h": true, "1d": true, "3d": true, "1w": true, "1M": true,
}

func sanitizeSymbol(s string) string {
	if validSymbols[s] {
		return s
	}
	return "BTCUSDT"
}

func sanitizeInterval(s string) string {
	if validIntervals[s] {
		return s
	}
	return "1h"
}
