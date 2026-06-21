package main

import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "log"
        "net/http"
        "os"
        "strings"
        "time"

        "github.com/gin-contrib/cors"
        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "golang.org/x/crypto/bcrypt"
        "gorm.io/driver/sqlite"
        "gorm.io/gorm"
        "gorm.io/gorm/logger"
)

// ============================================================
// Models (mirror of the real backend)
// ============================================================

type User struct {
        ID            uint      `gorm:"primaryKey" json:"id"`
        Email         string    `gorm:"uniqueIndex;not null" json:"email"`
        Username      string    `gorm:"uniqueIndex;not null" json:"username"`
        PasswordHash  string    `gorm:"not null" json:"-"`
        FullName      string    `json:"full_name"`
        Country       string    `json:"country"`
        Phone         string    `json:"phone"`
        Role          string    `gorm:"default:USER" json:"role"`
        EmailVerified bool      `gorm:"default:false" json:"email_verified"`
        TwoFAEnabled  bool      `gorm:"default:false" json:"two_fa_enabled"`
        CreatedAt     time.Time `json:"created_at"`
        UpdatedAt     time.Time `json:"updated_at"`
}

type Wallet struct {
        ID       uint    `gorm:"primaryKey" json:"id"`
        UserID   uint    `gorm:"not null;uniqueIndex:idx_wallet_user_currency" json:"user_id"`
        Currency string  `gorm:"not null;uniqueIndex:idx_wallet_user_currency" json:"currency"`
        Balance  float64 `gorm:"default:0" json:"balance"`
}

type Order struct {
        ID             uint      `gorm:"primaryKey" json:"id"`
        UserID         uint      `gorm:"not null" json:"user_id"`
        Symbol         string    `gorm:"not null" json:"symbol"`
        Side           string    `gorm:"not null" json:"side"`
        Type           string    `gorm:"not null" json:"type"`
        Price          float64   `json:"price"`
        Quantity       float64   `gorm:"not null" json:"quantity"`
        FilledQuantity float64   `gorm:"default:0" json:"filled_quantity"`
        AvgFillPrice   float64   `gorm:"default:0" json:"avg_fill_price"`
        Fee            float64   `gorm:"default:0" json:"fee"`
        Status         string    `gorm:"default:PENDING" json:"status"`
        CreatedAt      time.Time `json:"created_at"`
        UpdatedAt      time.Time `json:"updated_at"`
}

type Transaction struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null" json:"user_id"`
        Type      string    `gorm:"not null" json:"type"`
        Currency  string    `gorm:"not null" json:"currency"`
        Amount    float64   `gorm:"not null" json:"amount"`
        Status    string    `gorm:"default:PENDING" json:"status"`
        Address   string    `json:"address"`
        TxID      string    `json:"tx_id"`
        CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null" json:"user_id"`
        Type      string    `gorm:"not null" json:"type"`
        Title     string    `gorm:"not null" json:"title"`
        Body      string    `json:"body"`
        Read      bool      `gorm:"default:false" json:"read"`
        CreatedAt time.Time `json:"created_at"`
}

type KYCRequest struct {
        ID             uint      `gorm:"primaryKey" json:"id"`
        UserID         uint      `gorm:"uniqueIndex" json:"user_id"`
        FullName       string    `json:"full_name"`
        DocumentType   string    `json:"document_type"`
        DocumentNumber string    `json:"document_number"`
        Status         string    `gorm:"default:PENDING" json:"status"`
        CreatedAt      time.Time `json:"created_at"`
        UpdatedAt      time.Time `json:"updated_at"`
}

type FeeSchedule struct {
        ID        uint    `gorm:"primaryKey" json:"id"`
        UserType  string  `json:"user_type"`
        OrderType string  `json:"order_type"`
        MakerFee  float64 `gorm:"default:0.001" json:"maker_fee"`
        TakerFee  float64 `gorm:"default:0.001" json:"taker_fee"`
        MinFee    float64 `gorm:"default:0" json:"min_fee"`
}

type Ad struct {
        ID         uint   `gorm:"primaryKey" json:"id"`
        Title      string `json:"title"`
        Link       string `json:"link"`
        ImageURL   string `json:"image_url"`
        ButtonText string `json:"button_text"`
        ButtonLink string `json:"button_link"`
        Position   string `gorm:"default:hero" json:"position"`
        Active     bool   `gorm:"default:true" json:"active"`
        SortOrder  int    `gorm:"default:0" json:"sort_order"`
}

type RefreshToken struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null" json:"user_id"`
        Token     string    `gorm:"uniqueIndex" json:"-"`
        UserAgent string    `json:"user_agent"`
        IPAddress string    `json:"ip_address"`
        ExpiresAt time.Time `json:"expires_at"`
        Revoked   bool      `gorm:"default:false" json:"-"`
        CreatedAt time.Time `json:"created_at"`
}

// ============================================================
// Globals
// ============================================================

var DB *gorm.DB
var jwtSecret = []byte(getEnv("JWT_SECRET", "nexus-dev-secret-change-me-in-production-32chars"))

func getEnv(key, def string) string {
        if v := os.Getenv(key); v != "" {
                return v
        }
        return def
}

// ============================================================
// DB
// ============================================================

func connectDB() {
        dbPath := getEnv("SQLITE_PATH", "/home/z/my-project/crypto-exchange/mock-backend/data.db")
        var err error
        DB, err = gorm.Open(sqlite.Open(dbPath+"?_journal_mode=WAL&_busy_timeout=5000"), &gorm.Config{
                Logger: logger.Default.LogMode(logger.Warn),
        })
        if err != nil {
                log.Fatalf("Failed to open SQLite: %v", err)
        }
        if err := DB.AutoMigrate(
                &User{}, &Wallet{}, &Order{}, &Transaction{},
                &Notification{}, &KYCRequest{}, &FeeSchedule{}, &Ad{}, &RefreshToken{},
        ); err != nil {
                log.Fatalf("Failed to migrate: %v", err)
        }
        seedAdmin()
        seedFees()
        log.Printf("SQLite ready at %s", dbPath)
}

func seedAdmin() {
        var count int64
        DB.Model(&User{}).Where("role = ?", "ADMIN").Count(&count)
        if count > 0 {
                return
        }
        adminPass := getEnv("ADMIN_PASSWORD", "Admin@123456")
        hash, _ := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
        DB.Create(&User{
                Email:        "admin@eg-money.com",
                Username:     "admin",
                PasswordHash: string(hash),
                Role:         "ADMIN",
                EmailVerified: true,
                FullName:     "مدير النظام",
        })
        log.Printf("Admin created: admin@eg-money.com / %s", adminPass)
}

func seedFees() {
        var count int64
        DB.Model(&FeeSchedule{}).Count(&count)
        if count > 0 {
                return
        }
        fees := []FeeSchedule{
                {UserType: "REGULAR", OrderType: "SPOT", MakerFee: 0.001, TakerFee: 0.001},
                {UserType: "VIP", OrderType: "SPOT", MakerFee: 0.0005, TakerFee: 0.0007},
                {UserType: "REGULAR", OrderType: "MARGIN", MakerFee: 0.002, TakerFee: 0.002},
                {UserType: "VIP", OrderType: "MARGIN", MakerFee: 0.001, TakerFee: 0.0015},
        }
        DB.Create(&fees)
}

// ============================================================
// JWT
// ============================================================

type Claims struct {
        UserID uint   `json:"user_id"`
        Role   string `json:"role"`
        jwt.RegisteredClaims
}

func generateJWT(userID uint, role string) (string, error) {
        claims := Claims{
                UserID: userID,
                Role:   role,
                RegisteredClaims: jwt.RegisteredClaims{
                        ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
                },
        }
        token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
        return token.SignedString(jwtSecret)
}

func generateRefreshToken() string {
        b := make([]byte, 32)
        rand.Read(b)
        return hex.EncodeToString(b)
}

func authMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                auth := c.GetHeader("Authorization")
                if !strings.HasPrefix(auth, "Bearer ") {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
                        return
                }
                tokenStr := strings.TrimPrefix(auth, "Bearer ")
                claims := &Claims{}
                token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
                        return jwtSecret, nil
                })
                if err != nil || !token.Valid {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
                        return
                }
                c.Set("user_id", claims.UserID)
                c.Set("role", claims.Role)
                c.Next()
        }
}

func adminMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                role, _ := c.Get("role")
                if role != "ADMIN" {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin only"})
                        return
                }
                c.Next()
        }
}

// ============================================================
// Handlers
// ============================================================

func register(c *gin.Context) {
        var req struct {
                Email    string `json:"email" binding:"required,email"`
                Username string `json:"username" binding:"required,min=3"`
                Password string `json:"password" binding:"required,min=6"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        // Check uniqueness
        var existing User
        if DB.Where("email = ? OR username = ?", req.Email, req.Username).First(&existing).Error == nil {
                c.JSON(409, gin.H{"error": "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل"})
                return
        }
        hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
        user := User{
                Email:        req.Email,
                Username:     req.Username,
                PasswordHash: string(hash),
                Role:         "USER",
                EmailVerified: true, // mock: auto-verify
        }
        if err := DB.Create(&user).Error; err != nil {
                c.JSON(500, gin.H{"error": "failed to create user"})
                return
        }
        // Seed wallets
        for _, cur := range []string{"USDT", "BTC", "ETH", "EGP"} {
                bal := 0.0
                if cur == "USDT" {
                        bal = 10000 // welcome bonus for testing
                }
                DB.Create(&Wallet{UserID: user.ID, Currency: cur, Balance: bal})
        }
        // Welcome notification
        DB.Create(&Notification{
                UserID: user.ID,
                Type:   "welcome",
                Title:  "مرحباً بك في NEXUS Exchange!",
                Body:   "تم إنشاء حسابك بنجاح. تم إيداع 10,000 USDT كرصيد تجريبي.",
        })
        c.JSON(200, gin.H{
                "message": "تم إنشاء الحساب بنجاح",
                "user": gin.H{
                        "id":             user.ID,
                        "email":          user.Email,
                        "username":       user.Username,
                        "email_verified": user.EmailVerified,
                },
        })
}

func login(c *gin.Context) {
        var req struct {
                Email    string `json:"email" binding:"required"`
                Password string `json:"password" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        var user User
        if DB.Where("email = ? OR username = ?", req.Email, req.Email).First(&user).Error != nil {
                c.JSON(401, gin.H{"error": "بيانات الدخول غير صحيحة"})
                return
        }
        if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
                c.JSON(401, gin.H{"error": "بيانات الدخول غير صحيحة"})
                return
        }
        access, _ := generateJWT(user.ID, user.Role)
        refresh := generateRefreshToken()
        DB.Create(&RefreshToken{
                UserID:    user.ID,
                Token:     refresh,
                UserAgent: c.GetHeader("User-Agent"),
                IPAddress: c.ClientIP(),
                ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
        })
        c.JSON(200, gin.H{
                "access_token":  access,
                "refresh_token": refresh,
                "token_type":    "Bearer",
                "expires_in":    900,
                "user": gin.H{
                        "id":             user.ID,
                        "email":          user.Email,
                        "username":       user.Username,
                        "role":           user.Role,
                        "email_verified": user.EmailVerified,
                        "two_fa_enabled": user.TwoFAEnabled,
                        "full_name":      user.FullName,
                },
        })
}

func refresh(c *gin.Context) {
        var req struct {
                RefreshToken string `json:"refresh_token" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        var rt RefreshToken
        if DB.Where("token = ? AND revoked = ? AND expires_at > ?", req.RefreshToken, false, time.Now()).First(&rt).Error != nil {
                c.JSON(401, gin.H{"error": "invalid refresh token"})
                return
        }
        var user User
        DB.First(&user, rt.UserID)
        access, _ := generateJWT(user.ID, user.Role)
        c.JSON(200, gin.H{
                "access_token": access,
                "token_type":   "Bearer",
                "expires_in":   900,
        })
}

func logout(c *gin.Context) {
        var req struct {
                RefreshToken string `json:"refresh_token"`
        }
        if err := c.ShouldBindJSON(&req); err == nil && req.RefreshToken != "" {
                DB.Model(&RefreshToken{}).Where("token = ?", req.RefreshToken).Update("revoked", true)
        }
        c.JSON(200, gin.H{"message": "تم تسجيل الخروج"})
}

func getUserInfo(c *gin.Context) {
        uid := c.GetUint("user_id")
        var user User
        if DB.First(&user, uid).Error != nil {
                c.JSON(404, gin.H{"error": "user not found"})
                return
        }
        c.JSON(200, user)
}

func getBalances(c *gin.Context) {
        uid := c.GetUint("user_id")
        var wallets []Wallet
        DB.Where("user_id = ?", uid).Find(&wallets)
        c.JSON(200, wallets)
}

func deposit(c *gin.Context) {
        uid := c.GetUint("user_id")
        var req struct {
                Currency string  `json:"currency" binding:"required"`
                Amount   float64 `json:"amount" binding:"required,gt=0"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        var wallet Wallet
        if DB.Where("user_id = ? AND currency = ?", uid, req.Currency).First(&wallet).Error != nil {
                wallet = Wallet{UserID: uid, Currency: req.Currency, Balance: 0}
                DB.Create(&wallet)
        }
        wallet.Balance += req.Amount
        DB.Save(&wallet)
        DB.Create(&Transaction{
                UserID:   uid,
                Type:     "DEPOSIT",
                Currency: req.Currency,
                Amount:   req.Amount,
                Status:   "COMPLETED",
        })
        DB.Create(&Notification{
                UserID: uid,
                Type:   "deposit",
                Title:  "تم الإيداع بنجاح",
                Body:   fmt.Sprintf("تم إيداع %.4f %s في محفظتك", req.Amount, req.Currency),
        })
        c.JSON(200, gin.H{"message": "تم الإيداع", "balance": wallet.Balance})
}

func withdraw(c *gin.Context) {
        uid := c.GetUint("user_id")
        var req struct {
                Currency string  `json:"currency" binding:"required"`
                Amount   float64 `json:"amount" binding:"required,gt=0"`
                Address  string  `json:"address" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        var wallet Wallet
        if DB.Where("user_id = ? AND currency = ?", uid, req.Currency).First(&wallet).Error != nil {
                c.JSON(400, gin.H{"error": "محفظة غير موجودة"})
                return
        }
        if wallet.Balance < req.Amount {
                c.JSON(400, gin.H{"error": "الرصيد غير كافٍ"})
                return
        }
        wallet.Balance -= req.Amount
        DB.Save(&wallet)
        DB.Create(&Transaction{
                UserID:   uid,
                Type:     "WITHDRAW",
                Currency: req.Currency,
                Amount:   req.Amount,
                Status:   "PENDING",
                Address:  req.Address,
        })
        DB.Create(&Notification{
                UserID: uid,
                Type:   "withdraw",
                Title:  "تم إنشاء طلب السحب",
                Body:   fmt.Sprintf("طلب سحب %.4f %s قيد المعالجة", req.Amount, req.Currency),
        })
        c.JSON(200, gin.H{"message": "تم إنشاء طلب السحب", "balance": wallet.Balance})
}

func getTransactions(c *gin.Context) {
        uid := c.GetUint("user_id")
        var txs []Transaction
        DB.Where("user_id = ?", uid).Order("created_at DESC").Limit(100).Find(&txs)
        c.JSON(200, txs)
}

func placeOrder(c *gin.Context) {
        uid := c.GetUint("user_id")
        var req struct {
                Symbol   string  `json:"symbol" binding:"required"`
                Side     string  `json:"side" binding:"required,oneof=BUY SELL"`
                Type     string  `json:"type" binding:"required"`
                Price    float64 `json:"price"`
                Quantity float64 `json:"quantity" binding:"required,gt=0"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        if req.Type == "LIMIT" && req.Price <= 0 {
                c.JSON(400, gin.H{"error": "السعر مطلوب للأوامر المحددة"})
                return
        }
        // Mock: fill immediately at market price
        order := Order{
                UserID:         uid,
                Symbol:         req.Symbol,
                Side:           req.Side,
                Type:           req.Type,
                Price:          req.Price,
                Quantity:       req.Quantity,
                FilledQuantity: req.Quantity,
                AvgFillPrice:   req.Price,
                Fee:            req.Quantity * req.Price * 0.001,
                Status:         "FILLED",
        }
        DB.Create(&order)
        DB.Create(&Notification{
                UserID: uid,
                Type:   "order",
                Title:  "تم تنفيذ الأمر",
                Body:   fmt.Sprintf("تم تنفيذ أمر %s %s %.6f @ %.2f", req.Side, req.Symbol, req.Quantity, req.Price),
        })
        c.JSON(200, order)
}

func getOrders(c *gin.Context) {
        uid := c.GetUint("user_id")
        var orders []Order
        DB.Where("user_id = ?", uid).Order("created_at DESC").Limit(50).Find(&orders)
        c.JSON(200, orders)
}

func cancelOrder(c *gin.Context) {
        uid := c.GetUint("user_id")
        id := c.Param("id")
        DB.Model(&Order{}).Where("id = ? AND user_id = ? AND status = ?", id, uid, "PENDING").Update("status", "CANCELLED")
        c.JSON(200, gin.H{"message": "تم إلغاء الأمر"})
}

func getNotifications(c *gin.Context) {
        uid := c.GetUint("user_id")
        var notifs []Notification
        DB.Where("user_id = ?", uid).Order("created_at DESC").Limit(50).Find(&notifs)
        c.JSON(200, notifs)
}

func markAllRead(c *gin.Context) {
        uid := c.GetUint("user_id")
        DB.Model(&Notification{}).Where("user_id = ?", uid).Update("read", true)
        c.JSON(200, gin.H{"message": "تم تعليم الكل كمقروء"})
}

func markRead(c *gin.Context) {
        id := c.Param("id")
        uid := c.GetUint("user_id")
        DB.Model(&Notification{}).Where("id = ? AND user_id = ?", id, uid).Update("read", true)
        c.JSON(200, gin.H{"message": "تم"})
}

func getFees(c *gin.Context) {
        var fees []FeeSchedule
        DB.Find(&fees)
        c.JSON(200, fees)
}

func getAds(c *gin.Context) {
        var ads []Ad
        DB.Where("active = ?", true).Order("sort_order ASC").Find(&ads)
        c.JSON(200, ads)
}

func getAdminStats(c *gin.Context) {
        var userCount, orderCount, txCount int64
        DB.Model(&User{}).Count(&userCount)
        DB.Model(&Order{}).Count(&orderCount)
        DB.Model(&Transaction{}).Count(&txCount)
        c.JSON(200, gin.H{
                "users":        userCount,
                "orders":       orderCount,
                "transactions": txCount,
        })
}

func getAdminUsers(c *gin.Context) {
        var users []User
        DB.Order("created_at DESC").Limit(100).Find(&users)
        c.JSON(200, users)
}

// ============================================================
// Main
// ============================================================

func main() {
        connectDB()

        gin.SetMode(gin.ReleaseMode)
        r := gin.Default()

        r.Use(cors.New(cors.Config{
                AllowOrigins:     []string{"*"},
                AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
                AllowHeaders:     []string{"*"},
                ExposeHeaders:    []string{"Content-Length"},
                AllowCredentials: true,
                MaxAge:           12 * time.Hour,
        }))

        // Health
        r.GET("/", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "name": "NEXUS Mock API", "version": "1.0.0"})
        })
        r.GET("/api/health", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "database": "sqlite"})
        })

        v1 := r.Group("/api/v1")

        // Auth (public)
        v1.POST("/auth/register", register)
        v1.POST("/auth/login", login)
        v1.POST("/auth/refresh", refresh)
        v1.GET("/auth/verify-email", func(c *gin.Context) {
                c.JSON(200, gin.H{"message": "تم تأكيد البريد الإلكتروني"})
        })
        v1.POST("/auth/forgot-password", func(c *gin.Context) {
                c.JSON(200, gin.H{"message": "إذا كان البريد موجوداً ستصلك رسالة"})
        })
        v1.POST("/auth/reset-password", func(c *gin.Context) {
                c.JSON(200, gin.H{"message": "تم تغيير كلمة المرور"})
        })

        // Authenticated auth
        authAuth := v1.Group("/auth", authMiddleware())
        authAuth.POST("/logout", logout)
        authAuth.GET("/sessions", func(c *gin.Context) {
                c.JSON(200, []any{})
        })

        // Market — NEXUS's own deterministic market engine
        v1.GET("/market/prices", func(c *gin.Context) {
                out := map[string]float64{}
                for sym := range symbolBasePrice {
                        out[sym] = liveState.get(sym)
                }
                c.JSON(200, out)
        })
        v1.GET("/market/klines", handleKlines)
        v1.GET("/market/ticker", handleTicker)
        v1.GET("/market/tickers", handleAllTickers)
        // WebSocket endpoints (no /api/v1 prefix, mounted on root)
        r.GET("/ws/market", handleMarketWS)
        r.GET("/ws/kline", handleKlineWS)

        // Wallet + user (authenticated)
        userG := v1.Group("", authMiddleware())
        userG.GET("/user/info", getUserInfo)
        userG.PUT("/user/profile", func(c *gin.Context) {
                uid := c.GetUint("user_id")
                var req struct {
                        FullName string `json:"full_name"`
                        Country  string `json:"country"`
                        Phone    string `json:"phone"`
                }
                if err := c.ShouldBindJSON(&req); err == nil {
                        DB.Model(&User{}).Where("id = ?", uid).Updates(req)
                }
                c.JSON(200, gin.H{"message": "تم التحديث"})
        })
        userG.POST("/user/change-password", func(c *gin.Context) {
                c.JSON(200, gin.H{"message": "تم تغيير كلمة المرور"})
        })
        userG.GET("/wallet/balances", getBalances)
        userG.POST("/wallet/deposit", deposit)
        userG.POST("/wallet/withdraw", withdraw)
        userG.GET("/wallet/transactions", getTransactions)
        userG.GET("/notifications", getNotifications)
        userG.PUT("/notifications/read-all", markAllRead)
        userG.PUT("/notifications/:id/read", markRead)

        // KYC
        kycG := v1.Group("/kyc", authMiddleware())
        kycG.POST("/submit", func(c *gin.Context) {
                uid := c.GetUint("user_id")
                var req struct {
                        FullName       string `json:"full_name"`
                        DocumentType   string `json:"document_type"`
                        DocumentNumber string `json:"document_number"`
                }
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(400, gin.H{"error": err.Error()})
                        return
                }
                DB.Where("user_id = ?", uid).Delete(&KYCRequest{})
                DB.Create(&KYCRequest{
                        UserID:         uid,
                        FullName:       req.FullName,
                        DocumentType:   req.DocumentType,
                        DocumentNumber: req.DocumentNumber,
                        Status:         "PENDING",
                })
                c.JSON(200, gin.H{"message": "تم إرسال طلب التحقق"})
        })
        kycG.GET("/status", func(c *gin.Context) {
                uid := c.GetUint("user_id")
                var kyc KYCRequest
                if DB.Where("user_id = ?", uid).First(&kyc).Error != nil {
                        c.JSON(200, gin.H{"status": "NOT_SUBMITTED"})
                        return
                }
                c.JSON(200, kyc)
        })

        // Exchange
        exchG := v1.Group("/exchange", authMiddleware())
        exchG.POST("/order", placeOrder)
        exchG.GET("/orders", getOrders)
        exchG.POST("/order/:id/cancel", cancelOrder)

        // Public
        v1.GET("/fees", getFees)
        v1.GET("/ads", getAds)

        // Admin
        adminG := v1.Group("/admin", authMiddleware(), adminMiddleware())
        adminG.GET("/stats", getAdminStats)
        adminG.GET("/users", getAdminUsers)
        adminG.GET("/audit-logs", func(c *gin.Context) { c.JSON(200, []any{}) })
        adminG.GET("/kyc", func(c *gin.Context) {
                var ks []KYCRequest
                DB.Find(&ks)
                c.JSON(200, ks)
        })
        adminG.PUT("/kyc/:id/review", func(c *gin.Context) {
                id := c.Param("id")
                var req struct {
                        Status          string `json:"status"`
                        RejectionReason string `json:"rejection_reason"`
                }
                c.ShouldBindJSON(&req)
                DB.Model(&KYCRequest{}).Where("id = ?", id).Updates(map[string]any{"status": req.Status})
                c.JSON(200, gin.H{"message": "تم"})
        })
        adminG.GET("/transactions", func(c *gin.Context) {
                var txs []Transaction
                DB.Order("created_at DESC").Limit(100).Find(&txs)
                c.JSON(200, txs)
        })

        port := getEnv("PORT", "3000")
        log.Printf("NEXUS Mock Backend listening on :%s", port)
        if err := r.Run(":" + port); err != nil {
                log.Fatal(err)
        }
}
