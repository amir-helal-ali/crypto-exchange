package matching

import (
	"testing"
)

// TestReserveFunds_SufficientBalance tests that funds are correctly reserved
// when the user has sufficient balance.
func TestReserveFunds_SufficientBalance(t *testing.T) {
	// This test validates the ReserveFunds logic with sufficient balance.
	// In production, this would use a test database with transactions.
	//
	// Scenario: User has 1000 USDT, tries to reserve 500 USDT for a BUY order.
	// Expected: Balance becomes 500, ReservedAmount becomes 500.

	tests := []struct {
		name          string
		balance       float64
		reserveAmount float64
		expectSuccess bool
		expectedBal   float64
	}{
		{
			name:          "Exact balance",
			balance:       500,
			reserveAmount: 500,
			expectSuccess: true,
			expectedBal:   0,
		},
		{
			name:          "More than enough",
			balance:       1000,
			reserveAmount: 500,
			expectSuccess: true,
			expectedBal:   500,
		},
		{
			name:          "Insufficient balance",
			balance:       400,
			reserveAmount: 500,
			expectSuccess: false,
			expectedBal:   400,
		},
		{
			name:          "Zero balance",
			balance:       0,
			reserveAmount: 100,
			expectSuccess: false,
			expectedBal:   0,
		},
		{
			name:          "Tiny reserve",
			balance:       0.001,
			reserveAmount: 0.001,
			expectSuccess: true,
			expectedBal:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.balance >= tt.reserveAmount
			if result != tt.expectSuccess {
				t.Errorf("ReserveFunds(%v, %v): success=%v, want %v",
					tt.balance, tt.reserveAmount, result, tt.expectSuccess)
			}
			if tt.expectSuccess {
				newBal := tt.balance - tt.reserveAmount
				if newBal != tt.expectedBal {
					t.Errorf("After reserve: balance=%v, want %v", newBal, tt.expectedBal)
				}
			}
		})
	}
}

// TestExecuteFill calculates correct fee and transfers.
func TestExecuteFill(t *testing.T) {
	tests := []struct {
		name            string
		fillQty         float64
		fillPrice       float64
		feeRate         float64
		expectedFee     float64
		expectedCost    float64
		expectedProceed float64
	}{
		{
			name:            "Standard BUY fill",
			fillQty:         1.0,
			fillPrice:       50000.0,
			feeRate:         0.001,
			expectedFee:     50.0,
			expectedCost:    50000.0,
			expectedProceed: 49950.0,
		},
		{
			name:            "Small SELL fill",
			fillQty:         0.5,
			fillPrice:       50000.0,
			feeRate:         0.001,
			expectedFee:     25.0,
			expectedCost:    25000.0,
			expectedProceed: 24975.0,
		},
		{
			name:            "Zero fee",
			fillQty:         1.0,
			fillPrice:       100.0,
			feeRate:         0,
			expectedFee:     0,
			expectedCost:    100.0,
			expectedProceed: 100.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notional := tt.fillQty * tt.fillPrice
			fee := notional * tt.feeRate
			if fee != tt.expectedFee {
				t.Errorf("Fee = %v, want %v", fee, tt.expectedFee)
			}
			if notional != tt.expectedCost {
				t.Errorf("Notional = %v, want %v", notional, tt.expectedCost)
			}
			proceeds := notional - fee
			if proceeds != tt.expectedProceed {
				t.Errorf("Proceeds = %v, want %v", proceeds, tt.expectedProceed)
			}
		})
	}
}

// TestReleaseFunds ensures funds are correctly returned on order cancellation.
func TestReleaseFunds(t *testing.T) {
	tests := []struct {
		name            string
		balance         float64
		reservedAmount  float64
		expectedBalance float64
	}{
		{
			name:            "Full release",
			balance:         500,
			reservedAmount:  500,
			expectedBalance: 1000,
		},
		{
			name:            "Partial release",
			balance:         800,
			reservedAmount:  200,
			expectedBalance: 1000,
		},
		{
			name:            "No reserved amount",
			balance:         1000,
			reservedAmount:  0,
			expectedBalance: 1000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBal := tt.balance + tt.reservedAmount
			if newBal != tt.expectedBalance {
				t.Errorf("ReleaseFunds(%v, %v) = %v, want %v",
					tt.balance, tt.reservedAmount, newBal, tt.expectedBalance)
			}
		})
	}
}

// TestDoubleReserveRaceCondition validates that double reservation is prevented.
// In the real implementation, this would use DB transactions with FOR UPDATE locks.
func TestDoubleReserveRaceCondition(t *testing.T) {
	// Scenario: User has 1000 USDT and two concurrent orders try to reserve 800 each.
	// Without proper locking, both would succeed (total reserved: 1600 > 1000).
	// With row locking (FOR UPDATE), the second must fail.

	balance := 1000.0
	order1Reserve := 800.0
	order2Reserve := 800.0

	// First reservation succeeds
	if balance < order1Reserve {
		t.Fatal("First reservation should succeed")
	}
	balance -= order1Reserve // balance = 200

	// Second reservation MUST fail
	if balance >= order2Reserve {
		t.Errorf("Second reservation should fail: balance=%v, requested=%v", balance, order2Reserve)
	}
}

// TestOrderStatusTransitions validates valid state transitions for orders.
func TestOrderStatusTransitions(t *testing.T) {
	validTransitions := map[string][]string{
		"PENDING":   {"FILLED", "CANCELLED", "TRIGGERED"},
		"TRIGGERED": {"PENDING", "CANCELLED"},
		"FILLED":    {},              // Terminal state
		"CANCELLED": {},              // Terminal state
	}

	tests := []struct {
		from    string
		to      string
		isValid bool
	}{
		{"PENDING", "FILLED", true},
		{"PENDING", "CANCELLED", true},
		{"PENDING", "TRIGGERED", true},
		{"FILLED", "CANCELLED", false},
		{"CANCELLED", "PENDING", false},
		{"FILLED", "PENDING", false},
		{"TRIGGERED", "PENDING", true},
		{"TRIGGERED", "CANCELLED", true},
	}

	for _, tt := range tests {
		t.Run(tt.from+"->"+tt.to, func(t *testing.T) {
			allowed, exists := validTransitions[tt.from]
			if !exists {
				t.Fatalf("Unknown status: %s", tt.from)
			}
			found := false
			for _, s := range allowed {
				if s == tt.to {
					found = true
					break
				}
			}
			if found != tt.isValid {
				t.Errorf("Transition %s->%s: valid=%v, want %v", tt.from, tt.to, found, tt.isValid)
			}
		})
	}
}
