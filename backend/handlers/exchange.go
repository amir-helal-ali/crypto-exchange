package handlers

import (
        "fmt"
        "net/http"
        "strconv"
        "strings"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/matching"
        "crypto-exchange-backend/models"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

// PlaceOrder handles all order types with proper fund reservation and execution.
//
// Financial flow:
//   - MARKET orders: immediately execute at Binance market price (deduct source → credit destination)
//   - LIMIT orders: reserve funds (deduct from source) → wait for price match → fill via engine
//   - STOP_LIMIT orders: reserve funds → wait for trigger → create LIMIT order (funds already reserved)
//   - TAKE_PROFIT orders: reserve funds → wait for trigger → fill immediately at market price via engine
//
// Anti-double-spending: Funds are deducted from wallet at order creation time.
// This ensures the user cannot spend the same funds twice on different orders.
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

        input.Symbol = strings.ToUpper(strings.TrimSpace(input.Symbol))
        base, quote := matching.ParseSymbol(input.Symbol)

        // Use centralized validation for order input
        validationErrors := ValidateOrderInput(input.Symbol, input.Side, input.Type, input.Price, input.StopPrice, input.Quantity)
        if validationErrors.HasErrors() {
                for _, msg := range validationErrors {
                        c.JSON(http.StatusBadRequest, gin.H{"error": msg})
                        return
                }
        }

        // Validate price requirements based on order type
        if input.Type == "LIMIT" || input.Type == "STOP_LIMIT" {
                if input.Price <= 0 {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Price is required for limit/stop orders"})
                        return
                }
        }

        if input.Type == "STOP_LIMIT" || input.Type == "TAKE_PROFIT" {
                if input.StopPrice <= 0 {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Stop price is required for stop/take-profit orders"})
                        return
                }
        }

        if input.Quantity <= 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
                return
        }

        // ==================== MARKET ORDER ====================
        // Execute immediately at current Binance price with full fund transfer
        if input.Type == "MARKET" {
                marketPrice, err := matching.GetMarketPrice(input.Symbol)
                if err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "سعر السوق غير متاح حالياً، يرجى المحاولة لاحقاً"})
                        return
                }

                order := models.Order{
                        UserID:   userID,
                        Symbol:   input.Symbol,
                        Side:     input.Side,
                        Type:     "MARKET",
                        Price:    marketPrice,
                        Quantity: input.Quantity,
                        Status:   "PENDING", // Temporary, will be updated to FILLED in transaction
                }

                // Calculate reservation amount based on side
                if input.Side == "BUY" {
                        order.ReservedAmount = marketPrice * input.Quantity
                } else {
                        order.ReservedAmount = input.Quantity
                }

                err = database.DB.Transaction(func(dbTx *gorm.DB) error {
                        // Step 1: Reserve (deduct) funds from source wallet
                        if err := matching.ReserveFunds(dbTx, &order); err != nil {
                                return err
                        }

                        // Step 2: Create order record in DB (needed for ExecuteFill to have an ID)
                        if err := dbTx.Create(&order).Error; err != nil {
                                return err
                        }

                        // Step 3: Execute fill — credit destination wallet, refund excess (if any), update to FILLED
                        return matching.ExecuteFill(dbTx, &order, marketPrice)
                })

                if err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }

                database.DB.Create(&models.AuditLog{
                        UserID:    userID,
                        Action:    "PLACE_ORDER",
                        Details:   fmt.Sprintf("Executed MARKET %s %s: %.8f %s at %.2f %s", input.Side, input.Symbol, input.Quantity, base, marketPrice, quote),
                        IPAddress: c.ClientIP(),
                        CreatedAt: time.Now(),
                })

                c.JSON(http.StatusCreated, gin.H{
                        "success": true,
                        "message": fmt.Sprintf("تم تنفيذ الأمر السوقي بنجاح: %s %.8f %s بسعر %.2f %s", func() string { if input.Side == "BUY" { return "شراء" } else { return "بيع" } }(), input.Quantity, base, marketPrice, quote),
                        "data":    order,
                })

                // Send notification
                NotifyOrderFilled(userID, input.Symbol, input.Side, "MARKET", input.Quantity, marketPrice, order.ID)

                return
        }

        // ==================== LIMIT / STOP_LIMIT / TAKE_PROFIT ====================
        // Reserve funds and create PENDING order for the engine to process later

        order := models.Order{
                UserID:    userID,
                Symbol:    input.Symbol,
                Side:      input.Side,
                Type:      input.Type,
                Price:     input.Price,
                StopPrice: input.StopPrice,
                Quantity:  input.Quantity,
                Status:    "PENDING",
        }

        // Calculate reservation amount
        switch input.Side {
        case "BUY":
                // For BUY orders, reserve quote currency (USDT)
                if input.Type == "TAKE_PROFIT" {
                        // TAKE_PROFIT has no separate limit price, use stopPrice for reservation
                        order.ReservedAmount = input.StopPrice * input.Quantity
                        order.Price = input.StopPrice
                } else {
                        // LIMIT and STOP_LIMIT use the specified price
                        order.ReservedAmount = input.Price * input.Quantity
                }
        case "SELL":
                // For SELL orders, reserve base currency (BTC, ETH, etc.)
                order.ReservedAmount = input.Quantity
        }

        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                // Step 1: Reserve (deduct) funds from source wallet
                if err := matching.ReserveFunds(dbTx, &order); err != nil {
                        return err
                }

                // Step 2: Create order record in DB
                return dbTx.Create(&order).Error
        })

        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        reservedCurrency := quote
        if input.Side == "SELL" {
                reservedCurrency = base
        }

        database.DB.Create(&models.AuditLog{
                UserID:    userID,
                Action:    "PLACE_ORDER",
                Details:   fmt.Sprintf("Placed %s %s %s order: %.8f %s (reserved: %.8f %s)", input.Side, input.Type, input.Symbol, input.Quantity, base, order.ReservedAmount, reservedCurrency),
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        c.JSON(http.StatusCreated, gin.H{
                "success": true,
                "message": fmt.Sprintf("تم وضع الأمر بنجاح. تم حجز %.8f %s", order.ReservedAmount, reservedCurrency),
                "data":    order,
        })
}

// GetOrders returns the user's orders with pagination
func GetOrders(c *gin.Context) {
        userID := c.GetUint("user_id")
        page, limit := getPagination(c)
        offset := (page - 1) * limit

        // Allow filtering by status
        status := c.DefaultQuery("status", "")

        var total int64
        query := database.DB.Model(&models.Order{}).Where("user_id = ?", userID)
        if status != "" {
                query = query.Where("status = ?", status)
        }
        query.Count(&total)

        var orders []models.Order
        dbQuery := database.DB.Where("user_id = ?", userID)
        if status != "" {
                dbQuery = dbQuery.Where("status = ?", status)
        }
        dbQuery.Order("created_at DESC").Limit(limit).Offset(offset).Find(&orders)

        c.JSON(http.StatusOK, gin.H{"success": true, "data": orders, "total": total, "page": page, "limit": limit})
}

// getPagination extracts page and limit from query parameters
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

// CancelOrder cancels a pending order and returns the reserved funds to the user's wallet.
// Only PENDING orders can be cancelled. FILLED, CANCELLED, or TRIGGERED orders cannot.
func CancelOrder(c *gin.Context) {
        userID := c.GetUint("user_id")
        orderID := c.Param("id")

        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                var order models.Order
                if err := dbTx.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
                        return fmt.Errorf("الأمر غير موجود")
                }

                if order.Status != "PENDING" {
                        return fmt.Errorf("يمكن إلغاء الأوامر المعلقة فقط")
                }

                if order.ReservedAmount > 0 {
                        if err := matching.ReleaseFunds(dbTx, &order); err != nil {
                                return fmt.Errorf("فشل إعادة الرصيد المحجوز: %v", err)
                        }
                }

                order.Status = "CANCELLED"
                return dbTx.Save(&order).Error
        })

        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        database.DB.Create(&models.AuditLog{
                UserID:    userID,
                Action:    "CANCEL_ORDER",
                Details:   fmt.Sprintf("Cancelled order #%s, reserved funds returned", orderID),
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم إلغاء الأمر وإعادة الرصيد المحجوز بنجاح"})

        // Send notification - fetch the order details for the notification
        var cancelledOrder models.Order
        if err := database.DB.First(&cancelledOrder, orderID).Error; err == nil {
                NotifyOrderCancelled(userID, cancelledOrder.Symbol, cancelledOrder.Side, cancelledOrder.Quantity, cancelledOrder.ID)
        }
}
