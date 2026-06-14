package matching

import (
	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"
	"log"
)

// Default fee rates used when no FeeSchedule row exists in the database.
// These mirror the FeeSchedule rows seeded at startup.
var defaultFees = map[string]map[string]struct {
	MakerFee float64
	TakerFee float64
	MinFee   float64
}{
	"USER": {
		"MARKET":       {MakerFee: 0, TakerFee: 0.0025, MinFee: 0},
		"LIMIT":        {MakerFee: 0.0015, TakerFee: 0.0020, MinFee: 0},
		"STOP_LIMIT":   {MakerFee: 0.0015, TakerFee: 0.0025, MinFee: 0},
		"TAKE_PROFIT":  {MakerFee: 0, TakerFee: 0.0025, MinFee: 0},
	},
	"VERIFIED_USER": {
		"MARKET":       {MakerFee: 0, TakerFee: 0.0015, MinFee: 0},
		"LIMIT":        {MakerFee: 0.0010, TakerFee: 0.0012, MinFee: 0},
		"STOP_LIMIT":   {MakerFee: 0.0010, TakerFee: 0.0015, MinFee: 0},
		"TAKE_PROFIT":  {MakerFee: 0, TakerFee: 0.0015, MinFee: 0},
	},
	"ADMIN": { // Same as VERIFIED_USER
		"MARKET":       {MakerFee: 0, TakerFee: 0.0015, MinFee: 0},
		"LIMIT":        {MakerFee: 0.0010, TakerFee: 0.0012, MinFee: 0},
		"STOP_LIMIT":   {MakerFee: 0.0010, TakerFee: 0.0015, MinFee: 0},
		"TAKE_PROFIT":  {MakerFee: 0, TakerFee: 0.0015, MinFee: 0},
	},
}

// feeLookupResult holds the resolved fee rates for a specific trade.
type FeeLookupResult struct {
	MakerFee float64
	TakerFee float64
	MinFee   float64
}

// lookupFee looks up the fee schedule for a given user type and order type.
// It first checks the database (FeeSchedule table), then falls back to hardcoded defaults.
func lookupFee(userType string, orderType string) FeeLookupResult {
	// Try database lookup first
	var schedule models.FeeSchedule
	if err := database.DB.Where("user_type = ? AND order_type = ?", userType, orderType).First(&schedule).Error; err == nil {
		return FeeLookupResult{
			MakerFee: schedule.MakerFee,
			TakerFee: schedule.TakerFee,
			MinFee:   schedule.MinFee,
		}
	}

	// Fallback to defaults
	if userTypeMap, ok := defaultFees[userType]; ok {
		if fee, ok := userTypeMap[orderType]; ok {
			return FeeLookupResult{
				MakerFee: fee.MakerFee,
				TakerFee: fee.TakerFee,
				MinFee:   fee.MinFee,
			}
		}
	}

	// Ultimate fallback: USER taker rate
	return FeeLookupResult{MakerFee: 0, TakerFee: 0.0025, MinFee: 0}
}

// CalculateFee computes the trading fee for an order execution.
//
// For MARKET and TAKE_PROFIT orders: always use taker fee (immediate execution).
// For LIMIT and STOP_LIMIT (when triggered as LIMIT): use maker fee if the order
// added liquidity, otherwise taker fee. For simplicity, LIMIT fills from the
// matching engine are treated as taker since there is no order book depth yet.
//
// Fee is calculated as: fillValue * feeRate, where fillValue = fillPrice * quantity.
// The fee is deducted from the received currency.
func CalculateFee(userType string, orderType string, orderSide string, fillPrice float64, quantity float64) (fee float64, feeCurrency string) {
	base, quote := ParseSymbol("") // unused here
	_ = base
	_ = quote

	feeLookup := lookupFee(userType, orderType)

	// Determine fee rate: taker for market/TP orders, maker for limit orders
	feeRate := feeLookup.TakerFee
	if orderType == "LIMIT" || orderType == "STOP_LIMIT" {
		// When LIMIT orders fill, they could be maker or taker depending on
		// whether they provided or took liquidity. Since we don't have a full
		// order book, we use maker rate for LIMIT as they typically provide liquidity.
		feeRate = feeLookup.MakerFee
		if feeRate == 0 {
			feeRate = feeLookup.TakerFee
		}
	}

	// Calculate fill value
	fillValue := fillPrice * quantity
	fee = fillValue * feeRate

	// Apply minimum fee
	if fee < feeLookup.MinFee {
		fee = feeLookup.MinFee
	}

	// Fee currency: for BUY orders, fee is in quote (USDT); for SELL, fee is in quote (USDT)
	// We charge fees in the quote currency (USDT) for consistency.
	if orderSide == "BUY" {
		feeCurrency = quote
	} else {
		feeCurrency = quote
	}

	return fee, "USDT"
}

// EstimateFeeForReservation estimates the fee that will be charged when an order fills.
// This is used by ReserveFunds to reserve additional funds to cover the expected fee.
//
// For BUY orders: we need to reserve extra USDT to cover the fee.
// For SELL orders: we deduct the fee from the USDT proceeds, so no extra reservation needed.
func EstimateFeeForReservation(userType string, orderType string, orderSide string, reservedAmount float64, price float64, quantity float64) float64 {
	if orderSide == "SELL" {
		// For SELL orders, fee is deducted from the USDT proceeds received.
		// No additional reservation needed beyond the base currency.
		return 0
	}

	// For BUY orders, we need extra USDT to cover the fee.
	feeLookup := lookupFee(userType, orderType)
	feeRate := feeLookup.TakerFee
	if orderType == "LIMIT" || orderType == "STOP_LIMIT" {
		feeRate = feeLookup.MakerFee
		if feeRate == 0 {
			feeRate = feeLookup.TakerFee
		}
	}

	// Estimated fee = orderCost * feeRate
	fillValue := price * quantity
	return fillValue * feeRate
}

// SeedDefaultFees creates the default fee schedule rows in the database if they don't exist.
// Called once at startup.
func SeedDefaultFees() {
	for userType, orderTypes := range defaultFees {
		for orderType, fee := range orderTypes {
			var count int64
			database.DB.Model(&models.FeeSchedule{}).
				Where("user_type = ? AND order_type = ?", userType, orderType).
				Count(&count)
			if count == 0 {
				database.DB.Create(&models.FeeSchedule{
					UserType:  userType,
					OrderType: orderType,
					MakerFee:  fee.MakerFee,
					TakerFee:  fee.TakerFee,
					MinFee:    fee.MinFee,
				})
			}
		}
	}
	log.Println("Fee schedules seeded")
}
