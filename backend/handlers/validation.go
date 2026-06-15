package handlers

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

// ValidationErrors maps field names to error messages.
type ValidationErrors map[string]string

// Error implements the error interface for ValidationErrors.
func (ve ValidationErrors) Error() string {
	var parts []string
	for field, msg := range ve {
		parts = append(parts, fmt.Sprintf("%s: %s", field, msg))
	}
	return strings.Join(parts, "; ")
}

// HasErrors returns true if there are any validation errors.
func (ve ValidationErrors) HasErrors() bool {
	return len(ve) > 0
}

// --- Email Validation ---

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ValidateEmail checks that an email address is valid.
// Rules: valid format, length 3-255 characters.
func ValidateEmail(email string) ValidationErrors {
	errors := make(ValidationErrors)
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" {
		errors["email"] = "البريد الإلكتروني مطلوب"
		return errors
	}

	if len(email) < 3 {
		errors["email"] = "البريد الإلكتروني قصير جداً"
	}

	if len(email) > 255 {
		errors["email"] = "البريد الإلكتروني طويل جداً"
	}

	if !emailRegex.MatchString(email) {
		errors["email"] = "صيغة البريد الإلكتروني غير صالحة"
	}

	return errors
}

// --- Username Validation ---

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// ValidateUsername checks that a username is valid.
// Rules: 3-30 characters, alphanumeric + underscore only.
func ValidateUsername(username string) ValidationErrors {
	errors := make(ValidationErrors)
	username = strings.TrimSpace(username)

	if username == "" {
		errors["username"] = "اسم المستخدم مطلوب"
		return errors
	}

	if len(username) < 3 {
		errors["username"] = "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"
	}

	if len(username) > 30 {
		errors["username"] = "اسم المستخدم يجب ألا يتجاوز 30 حرفاً"
	}

	if !usernameRegex.MatchString(username) {
		errors["username"] = "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط"
	}

	return errors
}

// --- Password Validation ---

// ValidatePasswordStrength checks that a password meets strength requirements.
// Rules: minimum 8 characters, at least one uppercase, one lowercase, one digit, one special character.
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
	}
	if len(password) > 128 {
		return fmt.Errorf("كلمة المرور طويلة جداً")
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return fmt.Errorf("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل")
	}
	if !hasLower {
		return fmt.Errorf("كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل")
	}
	if !hasDigit {
		return fmt.Errorf("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل")
	}
	if !hasSpecial {
		return fmt.Errorf("كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل")
	}

	return nil
}

// --- Order Validation ---

// ValidSymbols is the list of allowed trading pairs.
var ValidSymbols = []string{
	"BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
	"XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT",
}

// ValidateOrderInput validates all fields for placing an order.
func ValidateOrderInput(symbol, side, orderType string, price, stopPrice, quantity float64) ValidationErrors {
	errors := make(ValidationErrors)

	// Symbol validation
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	validSymbol := false
	for _, s := range ValidSymbols {
		if s == symbol {
			validSymbol = true
			break
		}
	}
	if !validSymbol {
		errors["symbol"] = fmt.Sprintf("زوج التداول غير مدعوم. الأزواج المدعومة: %s", strings.Join(ValidSymbols, ", "))
	}

	// Side validation
	side = strings.ToUpper(strings.TrimSpace(side))
	if side != "BUY" && side != "SELL" {
		errors["side"] = "الاتجاه يجب أن يكون BUY أو SELL"
	}

	// Order type validation
	orderType = strings.ToUpper(strings.TrimSpace(orderType))
	validTypes := map[string]bool{"MARKET": true, "LIMIT": true, "STOP_LIMIT": true, "TAKE_PROFIT": true}
	if !validTypes[orderType] {
		errors["type"] = "نوع الأمر غير صالح"
	}

	// Quantity validation
	if quantity <= 0 {
		errors["quantity"] = "الكمية يجب أن تكون أكبر من صفر"
	}
	if quantity > 1000000 {
		errors["quantity"] = "الكمية كبيرة جداً"
	}

	// Price validation for LIMIT and STOP_LIMIT orders
	if (orderType == "LIMIT" || orderType == "STOP_LIMIT") && price <= 0 {
		errors["price"] = "السعر مطلوب للأوامر المحددة ووقف محدد"
	}
	if price > 0 && price > 100000000 {
		errors["price"] = "السعر كبير جداً"
	}

	// Stop price validation for STOP_LIMIT and TAKE_PROFIT orders
	if (orderType == "STOP_LIMIT" || orderType == "TAKE_PROFIT") && stopPrice <= 0 {
		errors["stop_price"] = "سعر الإيقاف مطلوب لأوامر الوقف وجني الأرباح"
	}
	if stopPrice > 0 && stopPrice > 100000000 {
		errors["stop_price"] = "سعر الإيقاف كبير جداً"
	}

	return errors
}

// --- Withdrawal Validation ---

// ValidateWithdrawal validates withdrawal request fields.
func ValidateWithdrawal(currency string, amount float64, address string, balance float64) ValidationErrors {
	errors := make(ValidationErrors)

	// Currency validation
	currency = strings.ToUpper(strings.TrimSpace(currency))
	validCurrencies := map[string]bool{
		"BTC": true, "ETH": true, "USDT": true, "BNB": true,
		"SOL": true, "XRP": true, "ADA": true, "DOGE": true, "DOT": true,
	}
	if !validCurrencies[currency] {
		errors["currency"] = "العملة غير مدعومة"
	}

	// Amount validation
	if amount <= 0 {
		errors["amount"] = "المبلغ يجب أن يكون أكبر من صفر"
	}
	if amount < 0.001 {
		errors["amount"] = "الحد الأدنى للسحب هو 0.001"
	}
	if amount > balance {
		errors["amount"] = fmt.Sprintf("رصيد غير كافٍ (المطلوب: %.8f، المتاح: %.8f)", amount, balance)
	}

	// Address validation
	address = strings.TrimSpace(address)
	if len(address) < 10 {
		errors["address"] = "عنوان المحفظة غير صالح"
	}
	if len(address) > 500 {
		errors["address"] = "عنوان المحفظة طويل جداً"
	}

	return errors
}

// --- Deposit Validation ---

// ValidateDeposit validates deposit request fields.
func ValidateDeposit(currency string, amount float64, txID string) ValidationErrors {
	errors := make(ValidationErrors)

	currency = strings.ToUpper(strings.TrimSpace(currency))
	validCurrencies := map[string]bool{
		"BTC": true, "ETH": true, "USDT": true, "BNB": true,
		"SOL": true, "XRP": true, "ADA": true, "DOGE": true, "DOT": true,
	}
	if !validCurrencies[currency] {
		errors["currency"] = "العملة غير مدعومة"
	}

	if amount <= 0 {
		errors["amount"] = "المبلغ يجب أن يكون أكبر من صفر"
	}

	txID = strings.TrimSpace(txID)
	if txID == "" {
		errors["tx_id"] = "رقم المعاملة مطلوب"
	}
	if len(txID) > 255 {
		errors["tx_id"] = "رقم المعاملة طويل جداً"
	}

	return errors
}

// --- KYC Validation ---

// ValidateKYCSubmission validates KYC submission fields.
func ValidateKYCSubmission(fullName, documentType, documentNumber, documentURL string) ValidationErrors {
	errors := make(ValidationErrors)

	if strings.TrimSpace(fullName) == "" {
		errors["full_name"] = "الاسم الكامل مطلوب"
	}
	if len(strings.TrimSpace(fullName)) < 3 {
		errors["full_name"] = "الاسم الكامل قصير جداً"
	}

	validDocTypes := map[string]bool{"passport": true, "national_id": true, "driving_license": true}
	if !validDocTypes[documentType] {
		errors["document_type"] = "نوع المستند غير صالح"
	}

	if len(strings.TrimSpace(documentNumber)) < 5 {
		errors["document_number"] = "رقم المستند قصير جداً"
	}

	if !strings.HasPrefix(documentURL, "/uploads/kyc/") {
		errors["document_url"] = "يجب رفع المستند أولاً"
	}

	return errors
}
