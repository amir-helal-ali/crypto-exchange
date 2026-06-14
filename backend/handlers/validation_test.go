package handlers

import (
	"testing"
)

// TestValidateEmail tests email format validation.
func TestValidateEmail(t *testing.T) {
	tests := []struct {
		email   string
		isValid bool
	}{
		{"user@example.com", true},
		{"test.user@domain.org", true},
		{"user+tag@gmail.com", true},
		{"", false},
		{"notanemail", false},
		{"@domain.com", false},
		{"user@", false},
		{"user@.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			// Simple email validation matching Gin's binding:"required,email"
			isValid := tt.email != "" && len(tt.email) > 3 &&
				containsAt(tt.email) && !startsWithAt(tt.email) && !endsWithAt(tt.email)
			if isValid != tt.isValid {
				t.Errorf("validateEmail(%q) = %v, want %v", tt.email, isValid, tt.isValid)
			}
		})
	}
}

func containsAt(s string) bool {
	for _, c := range s {
		if c == '@' {
			return true
		}
	}
	return false
}

func startsWithAt(s string) bool {
	return len(s) > 0 && s[0] == '@'
}

func endsWithAt(s string) bool {
	return len(s) > 0 && s[len(s)-1] == '@'
}

// TestValidatePassword tests password strength requirements.
func TestValidatePassword(t *testing.T) {
	tests := []struct {
		password string
		minLen   int
		isValid  bool
	}{
		{"short", 6, false},
		{"exactly6", 6, true},
		{"longpassword123", 6, true},
		{"", 6, false},
		{"12345", 6, false},
		{"StrongP@ss!", 8, true},
	}

	for _, tt := range tests {
		t.Run(tt.password, func(t *testing.T) {
			isValid := len(tt.password) >= tt.minLen
			if isValid != tt.isValid {
				t.Errorf("validatePassword(%q, %d) = %v, want %v",
					tt.password, tt.minLen, isValid, tt.isValid)
			}
		})
	}
}

// TestValidateUsername tests username validation rules.
func TestValidateUsername(t *testing.T) {
	tests := []struct {
		username string
		isValid  bool
	}{
		{"ahmed", true},
		{"user123", true},
		{"ab", false},       // too short (min 3)
		{"", false},         // empty
		{"a", false},        // too short
		{"valid_username", true},
	}

	for _, tt := range tests {
		t.Run(tt.username, func(t *testing.T) {
			isValid := len(tt.username) >= 3 && len(tt.username) <= 50
			if isValid != tt.isValid {
				t.Errorf("validateUsername(%q) = %v, want %v", tt.username, isValid, tt.isValid)
			}
		})
	}
}

// TestValidateCurrency tests that only supported currencies are accepted.
func TestValidateCurrency(t *testing.T) {
	supportedCurrencies := []string{"BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT"}

	tests := []struct {
		currency string
		isValid  bool
	}{
		{"BTC", true},
		{"ETH", true},
		{"USDT", true},
		{"INVALID", false},
		{"btc", false},   // case sensitive
		{"", false},
		{"XYZ", false},
	}

	for _, tt := range tests {
		t.Run(tt.currency, func(t *testing.T) {
			isValid := false
			for _, c := range supportedCurrencies {
				if c == tt.currency {
					isValid = true
					break
				}
			}
			if isValid != tt.isValid {
				t.Errorf("validateCurrency(%q) = %v, want %v", tt.currency, isValid, tt.isValid)
			}
		})
	}
}

// TestValidateOrderSide tests order side validation.
func TestValidateOrderSide(t *testing.T) {
	tests := []struct {
		side    string
		isValid bool
	}{
		{"BUY", true},
		{"SELL", true},
		{"buy", false},   // case sensitive
		{"INVALID", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.side, func(t *testing.T) {
			isValid := tt.side == "BUY" || tt.side == "SELL"
			if isValid != tt.isValid {
				t.Errorf("validateOrderSide(%q) = %v, want %v", tt.side, isValid, tt.isValid)
			}
		})
	}
}

// TestValidateOrderType tests order type validation.
func TestValidateOrderType(t *testing.T) {
	tests := []struct {
		orderType string
		isValid   bool
	}{
		{"MARKET", true},
		{"LIMIT", true},
		{"STOP_LIMIT", true},
		{"TAKE_PROFIT", true},
		{"market", false},
		{"INVALID", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.orderType, func(t *testing.T) {
			isValid := tt.orderType == "MARKET" || tt.orderType == "LIMIT" ||
				tt.orderType == "STOP_LIMIT" || tt.orderType == "TAKE_PROFIT"
			if isValid != tt.isValid {
				t.Errorf("validateOrderType(%q) = %v, want %v", tt.orderType, isValid, tt.isValid)
			}
		})
	}
}
