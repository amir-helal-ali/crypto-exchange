package matching

import (
        "fmt"

        "crypto-exchange-backend/models"
        "gorm.io/gorm"
)

// GetMarketPrice returns the current market price for a symbol from the Binance cache.
// Returns an error if the price is not available.
func GetMarketPrice(symbol string) (float64, error) {
        price, ok := getPrice(symbol)
        if !ok {
                return 0, fmt.Errorf("market price not available for %s", symbol)
        }
        return price, nil
}

// ParseSymbol extracts base and quote currencies from a trading pair symbol.
// Example: "BTCUSDT" -> base="BTC", quote="USDT"
func ParseSymbol(symbol string) (base string, quote string) {
        if len(symbol) > 4 && symbol[len(symbol)-4:] == "USDT" {
                return symbol[:len(symbol)-4], "USDT"
        }
        return symbol, "USDT"
}

// ReserveFunds deducts the required funds (including estimated fee) from the user's source wallet when placing an order.
// This prevents double spending by immediately removing funds from the available balance.
//
// For BUY orders:  deducts (ReservedAmount + estimatedFee) from the quote wallet (USDT)
// For SELL orders: deducts (ReservedAmount) from the base wallet (BTC, ETH, etc.)
//
// The caller must set order.ReservedAmount before calling this function:
//   - MARKET BUY:   ReservedAmount = marketPrice * quantity
//   - LIMIT BUY:    ReservedAmount = limitPrice * quantity
//   - STOP_LIMIT:   ReservedAmount = limitPrice * quantity
//   - TAKE_PROFIT:  ReservedAmount = stopPrice * quantity
//   - Any SELL:     ReservedAmount = quantity (of base currency)
func ReserveFunds(dbTx *gorm.DB, order *models.Order) error {
        base, quote := ParseSymbol(order.Symbol)

        // Look up user's role for fee estimation — use dbTx for transaction consistency
        var user models.User
        if err := dbTx.First(&user, order.UserID).Error; err != nil {
                return fmt.Errorf("user not found for fee estimation")
        }

        switch order.Side {
        case "BUY":
                // Estimate the fee for reservation
                estimatedFee := EstimateFeeForReservation(user.Role, order.Type, order.Side, order.ReservedAmount, order.Price, order.Quantity)
                if order.Type == "MARKET" {
                        // For MARKET orders, use the market price for estimation
                        if mp, err := GetMarketPrice(order.Symbol); err == nil {
                                estimatedFee = EstimateFeeForReservation(user.Role, order.Type, order.Side, order.ReservedAmount, mp, order.Quantity)
                        }
                }
                totalReserve := order.ReservedAmount + estimatedFee

                // Lock wallet row with FOR UPDATE to prevent race conditions
                var wallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, quote).First(&wallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found", quote)
                }
                if wallet.Balance < totalReserve {
                        return fmt.Errorf("رصيد %s غير كافٍ (المطلوب مع الرسوم: %.8f، المتاح: %.8f)", quote, totalReserve, wallet.Balance)
                }
                wallet.Balance -= totalReserve
                if err := dbTx.Save(&wallet).Error; err != nil {
                        return fmt.Errorf("failed to deduct %s from wallet: %v", quote, err)
                }
                // Store the total reserved amount (including fee estimate) so it's all returned on cancel
                order.ReservedAmount = totalReserve

        case "SELL":
                // Lock wallet row with FOR UPDATE to prevent race conditions
                var wallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, base).First(&wallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found", base)
                }
                if wallet.Balance < order.ReservedAmount {
                        return fmt.Errorf("رصيد %s غير كافٍ (المطلوب: %.8f، المتاح: %.8f)", base, order.ReservedAmount, wallet.Balance)
                }
                wallet.Balance -= order.ReservedAmount
                if err := dbTx.Save(&wallet).Error; err != nil {
                        return fmt.Errorf("failed to deduct %s from wallet: %v", base, err)
                }
        }

        return nil
}

// ExecuteFill transfers funds to the destination wallet when an order is filled.
// It also deducts trading fees and refunds any excess reserved amount for BUY orders.
//
// Fee calculation:
//   - Fee is computed as: fillValue * feeRate, where fillValue = fillPrice * quantity.
//   - For BUY: fee is deducted from the base currency received (buyer gets slightly less).
//   - For SELL: fee is deducted from the quote currency proceeds (seller gets slightly less USDT).
//
// For BUY orders:
//   - Credit base currency (e.g., BTC) minus fee to buyer's wallet
//   - Refund (ReservedAmount - fillPrice * quantity - fee) to quote wallet if excess
//
// For SELL orders:
//   - Credit quote currency (e.g., USDT) minus fee to seller's wallet
//
// This function also updates the order status to FILLED and sets FilledQuantity, AvgFillPrice, Fee, and FeeCurrency.
// The order MUST have a valid ID (already created in DB) before calling this function.
func ExecuteFill(dbTx *gorm.DB, order *models.Order, fillPrice float64) error {
        base, quote := ParseSymbol(order.Symbol)

        // Look up user's role for fee calculation — use dbTx for transaction consistency
        var user models.User
        if err := dbTx.First(&user, order.UserID).Error; err != nil {
                return fmt.Errorf("user not found for fee calculation")
        }

        // Calculate trading fee
        fee, feeCurrency := CalculateFee(user.Role, order.Type, order.Side, fillPrice, order.Quantity)
        order.Fee = fee
        order.FeeCurrency = feeCurrency

        switch order.Side {
        case "BUY":
                // Credit base currency to buyer (minus fee if fee is in base currency)
                // Fee for BUY is in USDT (quote), so buyer receives full base amount
                // Lock wallet row with FOR UPDATE
                var baseWallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, base).First(&baseWallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found for buyer", base)
                }
                baseWallet.Balance += order.Quantity
                if err := dbTx.Save(&baseWallet).Error; err != nil {
                        return fmt.Errorf("failed to credit %s to wallet: %v", base, err)
                }

                // Refund excess quote currency (reserved at higher price, filled at lower price)
                // Also account for the fee which is deducted from the quote currency
                actualCost := fillPrice * order.Quantity
                refundAmount := order.ReservedAmount - actualCost - fee
                if refundAmount > 0 {
                        // Lock quote wallet row with FOR UPDATE
                        var quoteWallet models.Wallet
                        if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                                Where("user_id = ? AND currency = ?", order.UserID, quote).First(&quoteWallet).Error; err != nil {
                                return fmt.Errorf("%s wallet not found for refund", quote)
                        }
                        quoteWallet.Balance += refundAmount
                        if err := dbTx.Save(&quoteWallet).Error; err != nil {
                                return fmt.Errorf("failed to refund excess %s: %v", quote, err)
                        }
                } else if refundAmount < 0 {
                        // If reserved amount wasn't enough to cover cost + fee, deduct the difference
                        var quoteWallet models.Wallet
                        if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                                Where("user_id = ? AND currency = ?", order.UserID, quote).First(&quoteWallet).Error; err != nil {
                                return fmt.Errorf("%s wallet not found for fee deduction", quote)
                        }
                        if quoteWallet.Balance < -refundAmount {
                                // Shouldn't happen if reservation was correct, but handle gracefully
                                // Deduct what we can
                                quoteWallet.Balance = 0
                        } else {
                                quoteWallet.Balance += refundAmount // refundAmount is negative, so this deducts
                        }
                        if err := dbTx.Save(&quoteWallet).Error; err != nil {
                                return fmt.Errorf("failed to deduct fee from %s: %v", quote, err)
                        }
                }

        case "SELL":
                // Credit quote currency to seller minus fee
                proceeds := fillPrice * order.Quantity
                netProceeds := proceeds - fee
                if netProceeds < 0 {
                        netProceeds = 0
                }
                // Lock wallet row with FOR UPDATE
                var quoteWallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, quote).First(&quoteWallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found for seller", quote)
                }
                quoteWallet.Balance += netProceeds
                if err := dbTx.Save(&quoteWallet).Error; err != nil {
                        return fmt.Errorf("failed to credit %s to wallet: %v", quote, err)
                }
        }

        // Update order status to FILLED
        order.Status = "FILLED"
        order.FilledQuantity = order.Quantity
        order.AvgFillPrice = fillPrice

        return dbTx.Save(order).Error
}

// ReleaseFunds returns reserved funds to the user's source wallet when an order is cancelled.
//
// For BUY orders:  returns (ReservedAmount) to the quote wallet (USDT)
// For SELL orders: returns (ReservedAmount) to the base wallet (BTC, ETH, etc.)
func ReleaseFunds(dbTx *gorm.DB, order *models.Order) error {
        base, quote := ParseSymbol(order.Symbol)

        switch order.Side {
        case "BUY":
                // Lock wallet row with FOR UPDATE to prevent race conditions
                var wallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, quote).First(&wallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found for refund", quote)
                }
                wallet.Balance += order.ReservedAmount
                if err := dbTx.Save(&wallet).Error; err != nil {
                        return fmt.Errorf("failed to return reserved %s: %v", quote, err)
                }

        case "SELL":
                // Lock wallet row with FOR UPDATE to prevent race conditions
                var wallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", order.UserID, base).First(&wallet).Error; err != nil {
                        return fmt.Errorf("%s wallet not found for refund", base)
                }
                wallet.Balance += order.ReservedAmount
                if err := dbTx.Save(&wallet).Error; err != nil {
                        return fmt.Errorf("failed to return reserved %s: %v", base, err)
                }
        }

        return nil
}
