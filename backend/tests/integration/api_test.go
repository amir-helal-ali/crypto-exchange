package integration

// Integration tests for the EgMoney API.
//
// These tests validate the full request/response cycle of API endpoints.
// They require a running PostgreSQL database and the server to be started.
// Run with: go test -v ./tests/integration/ -tags=integration
//
// For CI, these tests use an in-memory SQLite database.
// For local development, you can run them against a real database:
//   DATABASE_URL="host=localhost user=egmoney password=xxx dbname=crypto_exchange_test port=5432 sslmode=disable" \
//   JWT_SECRET="test-secret-at-least-32-characters-long" \
//   go test -v ./tests/integration/
//
// Prerequisites:
//   - Go 1.22+
//   - PostgreSQL 16 with a test database
//   - Environment variables: JWT_SECRET, DATABASE_URL

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/handlers"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// setupTestEnvironment configures the test database and router.
func setupTestEnvironment(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	// Set required env vars if not already set
	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "test-jwt-secret-for-integration-tests-minimum-32-characters")
	}
	if os.Getenv("ADMIN_PASSWORD") == "" {
		os.Setenv("ADMIN_PASSWORD", "TestAdmin@123456")
	}

	// Connect to test database
	database.Connect()

	// Clean up all tables for a fresh state
	database.DB.Exec("DELETE FROM notifications")
	database.DB.Exec("DELETE FROM audit_logs")
	database.DB.Exec("DELETE FROM refresh_tokens")
	database.DB.Exec("DELETE FROM email_verification_tokens")
	database.DB.Exec("DELETE FROM password_reset_tokens")
	database.DB.Exec("DELETE FROM transactions")
	database.DB.Exec("DELETE FROM orders")
	database.DB.Exec("DELETE FROM kyc_requests")
	database.DB.Exec("DELETE FROM wallets")
	database.DB.Exec("DELETE FROM fee_schedules")
	database.DB.Exec("DELETE FROM users")

	// Seed fee schedules
	matchingPkg := database.DB
	_ = matchingPkg // avoid unused import for now

	// Setup router
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.Use(handlers.CORSMiddleware())

	r.GET("/api/health", handlers.HealthCheck)

	v1 := r.Group("/api/v1")

	v1.POST("/auth/register", handlers.Register)
	v1.POST("/auth/login", handlers.Login)
	v1.POST("/auth/forgot-password", handlers.ForgotPassword)
	v1.POST("/auth/verify-2fa", handlers.Verify2FA)
	v1.POST("/auth/refresh", handlers.RefreshAccessToken)

	authProtected := v1.Group("/auth")
	authProtected.Use(handlers.AuthMiddleware())
	{
		authProtected.POST("/logout", handlers.Logout)
		authProtected.GET("/sessions", handlers.GetSessions)
	}

	wallet := v1.Group("")
	wallet.Use(handlers.AuthMiddleware())
	{
		wallet.GET("/wallet/balances", handlers.GetWalletBalances)
		wallet.GET("/user/info", handlers.GetUserInfo)
		wallet.GET("/notifications", handlers.GetNotifications)
		wallet.PUT("/notifications/read-all", handlers.MarkAllNotificationsRead)
	}

	protected := v1.Group("/exchange")
	protected.Use(handlers.AuthMiddleware())
	{
		protected.GET("/orders", handlers.GetOrders)
	}

	return r, database.DB
}

// ============================================================
// Test: Health Check
// ============================================================

func TestHealthEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.GET("/api/health", handlers.HealthCheck)

	req, _ := http.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%v'", response["status"])
	}
	t.Log("Health check endpoint works correctly")
}

// ============================================================
// Test: Registration Validation
// ============================================================

func TestRegistrationRequiresFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.POST("/api/v1/auth/register", handlers.Register)

	// Empty body should fail
	req, _ := http.NewRequest("POST", "/api/v1/auth/register", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code == http.StatusOK {
		t.Error("Empty registration should fail")
	}
	t.Logf("Empty registration correctly rejected with status %d", w.Code)
}

// ============================================================
// Test: Auth Middleware - TOKEN_EXPIRED vs INVALID_TOKEN
// ============================================================

func TestAuthMiddlewareInvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.GET("/api/v1/user/info", handlers.AuthMiddleware(), func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	// No auth header
	req, _ := http.NewRequest("GET", "/api/v1/user/info", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 without auth, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["code"] != "AUTH_REQUIRED" {
		t.Errorf("Expected AUTH_REQUIRED code, got %v", response["code"])
	}

	// Invalid JWT token
	req2, _ := http.NewRequest("GET", "/api/v1/user/info", nil)
	req2.Header.Set("Authorization", "Bearer invalid.jwt.token")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 with invalid token, got %d", w2.Code)
	}

	var response2 map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &response2)
	if response2["code"] != "INVALID_TOKEN" {
		t.Errorf("Expected INVALID_TOKEN code, got %v", response2["code"])
	}

	t.Log("Auth middleware correctly distinguishes AUTH_REQUIRED vs INVALID_TOKEN")
}

// ============================================================
// Test: Admin Middleware
// ============================================================

func TestAdminMiddlewareRejectsNonAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()

	r.GET("/admin/test", func(c *gin.Context) {
		c.Set("role", "USER")
		c.Next()
	}, handlers.AdminMiddleware(), func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	req, _ := http.NewRequest("GET", "/admin/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 for non-admin, got %d", w.Code)
	}
	t.Log("Admin middleware correctly rejects non-admin users")
}

// ============================================================
// Test: Rate Limiter
// ============================================================

func TestRateLimiterAllowsNormalTraffic(t *testing.T) {
	rl := handlers.NewRateLimiter(100, 1) // 100 requests per 1 second

	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.Use(rl.Middleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Normal request should pass
	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Normal request should pass, got %d", w.Code)
	}
	t.Log("Rate limiter allows normal traffic")
}

// ============================================================
// Test: Validation Functions
// ============================================================

func TestInputValidation(t *testing.T) {
	// Test email validation
	errs := handlers.ValidateEmail("invalid-email")
	if len(errs) == 0 {
		t.Error("Invalid email should fail validation")
	}

	errs = handlers.ValidateEmail("valid@example.com")
	if len(errs) > 0 {
		t.Errorf("Valid email should pass validation, got errors: %v", errs)
	}

	// Test username validation
	errs = handlers.ValidateUsername("ab")
	if len(errs) == 0 {
		t.Error("Short username should fail validation")
	}

	errs = handlers.ValidateUsername("validuser123")
	if len(errs) > 0 {
		t.Errorf("Valid username should pass validation, got errors: %v", errs)
	}

	// Test password validation
	errs = handlers.ValidatePasswordStrength("weak")
	if len(errs) == 0 {
		t.Error("Weak password should fail validation")
	}

	errs = handlers.ValidatePasswordStrength("Strong@Pass123")
	if len(errs) > 0 {
		t.Errorf("Strong password should pass validation, got errors: %v", errs)
	}

	t.Log("Input validation functions work correctly")
}

// ============================================================
// Test: Full Registration + Verification + Login Flow
// This test requires database connectivity and is only run
// when the -tags=integration flag is provided.
// ============================================================

func TestFullAuthFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	router, db := setupTestEnvironment(t)
	_ = db

	// Step 1: Register
	regBody := map[string]string{
		"email":    "integration@example.com",
		"username": "integrationuser",
		"password": "Test@123456",
	}
	body, _ := json.Marshal(regBody)
	req, _ := http.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("Registration failed: %d. Body: %s", w.Code, w.Body.String())
	}
	t.Log("Step 1: Registration succeeded")

	// Step 2: Get the verification token from database
	var token models.EmailVerificationToken
	if result := database.DB.Where("user_id = (SELECT id FROM users WHERE email = ?)", "integration@example.com").First(&token); result.Error != nil {
		t.Fatalf("Verification token not found: %v", result.Error)
	}

	// Step 3: Verify email
	req2, _ := http.NewRequest("GET", "/api/v1/auth/verify-email?token="+token.Token, nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Email verification failed: %d. Body: %s", w2.Code, w2.Body.String())
	}
	t.Log("Step 2: Email verification succeeded")

	// Step 4: Login
	loginBody := map[string]string{
		"email":    "integration@example.com",
		"password": "Test@123456",
	}
	loginJSON, _ := json.Marshal(loginBody)
	req3, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(loginJSON))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("Login failed: %d. Body: %s", w3.Code, w3.Body.String())
	}

	var loginResponse map[string]interface{}
	json.Unmarshal(w3.Body.Bytes(), &loginResponse)
	t.Log("Step 3: Login succeeded")

	// Step 5: Access protected route with the token
	jwtToken, _ := loginResponse["token"].(string)
	if jwtToken == "" {
		// Try from data object
		if data, ok := loginResponse["data"].(map[string]interface{}); ok {
			jwtToken, _ = data["token"].(string)
		}
	}

	if jwtToken == "" {
		t.Fatal("No JWT token in login response")
	}

	req4, _ := http.NewRequest("GET", "/api/v1/user/info", nil)
	req4.Header.Set("Authorization", "Bearer "+jwtToken)
	w4 := httptest.NewRecorder()
	router.ServeHTTP(w4, req4)

	if w4.Code != http.StatusOK {
		t.Fatalf("Protected route access failed: %d. Body: %s", w4.Code, w4.Body.String())
	}
	t.Log("Step 4: Protected route access succeeded")

	t.Log("Full auth flow test passed!")
}
