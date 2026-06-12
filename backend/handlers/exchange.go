package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

func GetPrices(c *gin.Context) {
	res, err := http.Get("https://api.binance.com/api/v3/ticker/24hr?symbols=[\"BTCUSDT\",\"ETHUSDT\",\"SOLUSDT\",\"BNBUSDT\",\"XRPUSDT\",\"ADAUSDT\",\"DOGEUSDT\",\"DOTUSDT\"]")
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

func PlaceOrder(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		Symbol    string  `json:"symbol" binding:"required"`
		Side      string  `json:"side" binding:"required,oneof=BUY SELL"`
		Type      string  `json:"type" binding:"required,oneof=MARKET LIMIT STOP_LIMIT TAKE_PROFIT"`
		Price     float64 `json:"price"`
		StopPrice float64 `json:"stop_price"`
		Quantity  float64 `json:"quantity" binding:"required,gt=0"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if (input.Type == "LIMIT" || input.Type == "STOP_LIMIT" || input.Type == "TAKE_PROFIT") && input.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Price is required for limit/stop orders"})
		return
	}

	if (input.Type == "STOP_LIMIT" || input.Type == "TAKE_PROFIT") && input.StopPrice <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stop price is required for stop/take-profit orders"})
		return
	}

	status := "PENDING"
	filledQty := 0.0
	if input.Type == "MARKET" {
		status = "FILLED"
		filledQty = input.Quantity
	}

	order := models.Order{
		UserID:         userID,
		Symbol:         input.Symbol,
		Side:           input.Side,
		Type:           input.Type,
		Price:          input.Price,
		StopPrice:      input.StopPrice,
		Quantity:       input.Quantity,
		FilledQuantity: filledQty,
		Status:         status,
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to place order"})
		return
	}

	database.DB.Create(&models.AuditLog{
		UserID:    userID,
		Action:    "PLACE_ORDER",
		Details:   fmt.Sprintf("Placed %s %s order for %s (Qty: %.4f)", input.Side, input.Type, input.Symbol, input.Quantity),
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Order placed successfully",
		"data":    order,
	})
}

func GetOrders(c *gin.Context) {
	userID := c.GetUint("user_id")
	page, limit := getPagination(c)
	offset := (page - 1) * limit

	var total int64
	database.DB.Model(&models.Order{}).Where("user_id = ?", userID).Count(&total)

	var orders []models.Order
	database.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Offset(offset).Find(&orders)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": orders, "total": total, "page": page, "limit": limit})
}

func getPagination(c *gin.Context) (int, int) {
	page := 1
	limit := 50
	if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "50")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	return page, limit
}

func CancelOrder(c *gin.Context) {
	userID := c.GetUint("user_id")
	orderID := c.Param("id")

	var order models.Order
	if err := database.DB.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending orders can be cancelled"})
		return
	}

	order.Status = "CANCELLED"
	database.DB.Save(&order)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Order cancelled successfully"})
}
