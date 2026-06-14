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

// ReserveFunds deducts the required funds from the user's source wallet when placing an order.
// This prevents double spending by immediately removing funds from the available balance.
//
// For BUY orders:  deducts (ReservedAmount) from the quote wallet (USDT)
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

	switch order.Side {
	case "BUY":
		var wallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, quote).First(&wallet).Error; err != nil {
			return fmt.Errorf("%s wallet not found", quote)
		}
		if wallet.Balance < order.ReservedAmount {
			return fmt.Errorf("رصيد %s غير كافٍ (المطلوب: %.8f، المتاح: %.8f)", quote, order.ReservedAmount, wallet.Balance)
		}
		wallet.Balance -= order.ReservedAmount
		if err := dbTx.Save(&wallet).Error; err != nil {
			return fmt.Errorf("failed to deduct %s from wallet: %v", quote, err)
		}

	case "SELL":
		var wallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, base).First(&wallet).Error; err != nil {
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
// It also refunds any excess reserved amount for BUY orders.
//
// For BUY orders:
//   - Credit base currency (e.g., BTC) to buyer's wallet
//   - Refund (ReservedAmount - fillPrice * quantity) to quote wallet if fill price < reserved price
//
// For SELL orders:
//   - Credit quote currency (e.g., USDT) to seller's wallet at fillPrice * quantity
//
// This function also updates the order status to FILLED and sets FilledQuantity and AvgFillPrice.
// The order MUST have a valid ID (already created in DB) before calling this function.
func ExecuteFill(dbTx *gorm.DB, order *models.Order, fillPrice float64) error {
	base, quote := ParseSymbol(order.Symbol)

	switch order.Side {
	case "BUY":
		// Credit base currency to buyer
		var baseWallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, base).First(&baseWallet).Error; err != nil {
			return fmt.Errorf("%s wallet not found for buyer", base)
		}
		baseWallet.Balance += order.Quantity
		if err := dbTx.Save(&baseWallet).Error; err != nil {
			return fmt.Errorf("failed to credit %s to wallet: %v", base, err)
		}

		// Refund excess quote currency (reserved at higher price, filled at lower price)
		actualCost := fillPrice * order.Quantity
		refundAmount := order.ReservedAmount - actualCost
		if refundAmount > 0 {
			var quoteWallet models.Wallet
			if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, quote).First(&quoteWallet).Error; err != nil {
				return fmt.Errorf("%s wallet not found for refund", quote)
			}
			quoteWallet.Balance += refundAmount
			if err := dbTx.Save(&quoteWallet).Error; err != nil {
				return fmt.Errorf("failed to refund excess %s: %v", quote, err)
			}
		}

	case "SELL":
		// Credit quote currency to seller
		proceeds := fillPrice * order.Quantity
		var quoteWallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, quote).First(&quoteWallet).Error; err != nil {
			return fmt.Errorf("%s wallet not found for seller", quote)
		}
		quoteWallet.Balance += proceeds
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
		var wallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, quote).First(&wallet).Error; err != nil {
			return fmt.Errorf("%s wallet not found for refund", quote)
		}
		wallet.Balance += order.ReservedAmount
		if err := dbTx.Save(&wallet).Error; err != nil {
			return fmt.Errorf("failed to return reserved %s: %v", quote, err)
		}

	case "SELL":
		var wallet models.Wallet
		if err := dbTx.Where("user_id = ? AND currency = ?", order.UserID, base).First(&wallet).Error; err != nil {
			return fmt.Errorf("%s wallet not found for refund", base)
		}
		wallet.Balance += order.ReservedAmount
		if err := dbTx.Save(&wallet).Error; err != nil {
			return fmt.Errorf("failed to return reserved %s: %v", base, err)
		}
	}

	return nil
}
