package main

import (
        "context"
        "encoding/json"
        "log"
        "net/http"
        "os"
        "os/signal"
        "syscall"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/email"
        "crypto-exchange-backend/handlers"
        "crypto-exchange-backend/matching"
        "crypto-exchange-backend/models"
        exchangeredis "crypto-exchange-backend/redis"
        "crypto-exchange-backend/scheduler"
        "crypto-exchange-backend/websocket"

        "github.com/gin-gonic/gin"
        "github.com/joho/godotenv"
        "golang.org/x/crypto/bcrypt"
)

type jsonLogger struct {
        *log.Logger
}

func newJSONLogger() *jsonLogger {
        return &jsonLogger{log.New(os.Stdout, "", 0)}
}

func (l *jsonLogger) Info(msg string, fields map[string]interface{}) {
        entry := map[string]interface{}{"level": "info", "time": time.Now().UTC().Format(time.RFC3339), "message": msg}
        for k, v := range fields {
                entry[k] = v
        }
        b, _ := json.Marshal(entry)
        l.Println(string(b))
}

func (l *jsonLogger) Error(msg string, fields map[string]interface{}) {
        entry := map[string]interface{}{"level": "error", "time": time.Now().UTC().Format(time.RFC3339), "message": msg}
        for k, v := range fields {
                entry[k] = v
        }
        b, _ := json.Marshal(entry)
        l.Println(string(b))
}

func (l *jsonLogger) Fatal(msg string, fields map[string]interface{}) {
        entry := map[string]interface{}{"level": "fatal", "time": time.Now().UTC().Format(time.RFC3339), "message": msg}
        for k, v := range fields {
                entry[k] = v
        }
        b, _ := json.Marshal(entry)
        l.Println(string(b))
        os.Exit(1)
}

var logg = newJSONLogger()

func seedAdmin() {
        var count int64
        database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&count)
        if count > 0 {
                return
        }

        adminPass := os.Getenv("ADMIN_PASSWORD")
        if adminPass == "" {
                logg.Fatal("ADMIN_PASSWORD environment variable is not set. Refusing to use default password in production.", nil)
        }
        hash, _ := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
        admin := models.User{
                Email:          "admin@eg-money.com",
                Username:       "admin",
                PasswordHash:   string(hash),
                Role:           "ADMIN",
                EmailVerified:  true,
        }
        if err := database.DB.Create(&admin).Error; err != nil {
                logg.Error("Failed to seed admin", map[string]interface{}{"error": err.Error()})
        } else {
                logg.Info("Admin user created", map[string]interface{}{"email": "admin@eg-money.com"})
        }
}

func main() {
        if err := godotenv.Load(); err != nil {
                logg.Info("No .env file found, using environment variables", nil)
        }

        email.LoadConfig()
        exchangeredis.Connect()

        gin.SetMode(gin.ReleaseMode)

        database.Connect()
        seedAdmin()
        matching.SeedDefaultFees()

        matching.Start(10 * time.Second)
        scheduler.StartCleanupScheduler()

        r := gin.Default()
        r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
                entry := map[string]interface{}{
                        "level":      "info",
                        "time":       param.TimeStamp.Format(time.RFC3339),
                        "method":     param.Method,
                        "path":       param.Path,
                        "status":     param.StatusCode,
                        "latency":    param.Latency.String(),
                        "client_ip":  param.ClientIP,
                        "user_agent": param.Request.UserAgent(),
                }
                b, _ := json.Marshal(entry)
                return string(b) + "\n"
        }))

        r.Use(handlers.CORSMiddleware())

        // Security headers middleware
        r.Use(func(c *gin.Context) {
                c.Header("X-Content-Type-Options", "nosniff")
                c.Header("X-Frame-Options", "DENY")
                c.Header("X-XSS-Protection", "1; mode=block")
                c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
                c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss://stream.binance.com:9443 https:; font-src 'self'; frame-ancestors 'none'")
                c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
                c.Next()
        })

        rl := handlers.NewRateLimiter(120, time.Minute)
        r.Use(rl.Middleware())

        // Stricter rate limiting for auth endpoints (5 requests per minute per IP)
        authRL := handlers.NewRateLimiter(5, time.Minute)

        r.MaxMultipartMemory = 5 << 20

        r.GET("/", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "name": "EgMoney API", "version": "1.0.0"})
        })

        // Health checks remain at /api/ (no version prefix - always latest)
        r.GET("/api/health", handlers.HealthCheck)
        r.GET("/api/health/ready", handlers.ReadinessCheck)
        r.GET("/api/health/live", handlers.LivenessCheck)

        // === v1 API routes ===
        v1 := r.Group("/api/v1")

        v1.GET("/market/prices", handlers.GetPrices)
        v1.GET("/market/klines", handlers.GetKlines)

        v1.POST("/auth/register", authRL.Middleware(), handlers.Register)
        v1.POST("/auth/login", authRL.Middleware(), handlers.Login)
        v1.POST("/auth/forgot-password", authRL.Middleware(), handlers.ForgotPassword)
        v1.POST("/auth/reset-password", authRL.Middleware(), handlers.ResetPassword)
        v1.GET("/auth/verify-email", handlers.VerifyEmail)
        v1.POST("/auth/resend-verification", authRL.Middleware(), handlers.ResendVerification)
        v1.POST("/auth/verify-2fa", authRL.Middleware(), handlers.Verify2FA)
        v1.POST("/auth/refresh", handlers.RefreshAccessToken)

        // Authenticated auth routes
        authProtected := v1.Group("/auth")
        authProtected.Use(handlers.AuthMiddleware())
        {
                authProtected.POST("/setup-2fa", handlers.Setup2FA)
                authProtected.POST("/enable-2fa", handlers.Enable2FA)
                authProtected.POST("/disable-2fa", handlers.Disable2FA)
                authProtected.POST("/logout", handlers.Logout)
                authProtected.GET("/sessions", handlers.GetSessions)
                authProtected.POST("/sessions/:id/revoke", handlers.RevokeSession)
        }

        userKYC := v1.Group("/kyc")
        userKYC.Use(handlers.AuthMiddleware())
        {
                userKYC.POST("/submit", handlers.SubmitKYC)
                userKYC.POST("/upload", handlers.UploadKYCDocument)
                userKYC.GET("/status", handlers.GetMyKYC)
        }

        protected := v1.Group("/exchange")
        protected.Use(handlers.AuthMiddleware())
        {
                protected.POST("/order", handlers.PlaceOrder)
                protected.GET("/orders", handlers.GetOrders)
                protected.POST("/order/:id/cancel", handlers.CancelOrder)
        }

        wallet := v1.Group("")
        wallet.Use(handlers.AuthMiddleware())
        {
                wallet.GET("/wallet/balances", handlers.GetWalletBalances)
                wallet.GET("/user/info", handlers.GetUserInfo)
                wallet.PUT("/user/profile", handlers.UpdateProfile)
                wallet.POST("/user/change-password", handlers.ChangePassword)
                wallet.POST("/wallet/deposit", handlers.DepositCurrency)
                wallet.POST("/wallet/withdraw", handlers.WithdrawCurrency)
                wallet.GET("/wallet/transactions", handlers.GetTransactions)
                wallet.GET("/notifications", handlers.GetNotifications)
                wallet.PUT("/notifications/read-all", handlers.MarkAllNotificationsRead)
                wallet.PUT("/notifications/:id/read", handlers.MarkNotificationRead)
        }

        admin := v1.Group("/admin")
        admin.Use(handlers.AuthMiddleware(), handlers.AdminMiddleware())
        {
                admin.GET("/stats", handlers.GetAdminStats)
                admin.GET("/users", handlers.GetAllUsers)
                admin.GET("/audit-logs", handlers.GetAuditLogs)
                admin.GET("/audit-logs/export", handlers.ExportAuditLogsCSV)
                admin.GET("/kyc", handlers.GetAllKYCRequests)
                admin.PUT("/kyc/:id/review", handlers.ReviewKYC)
                admin.PUT("/user/:id/role", handlers.UpdateUserRole)
                admin.GET("/transactions", handlers.GetAllTransactions)
                admin.PUT("/transactions/:id/review", handlers.ReviewTransaction)
                admin.GET("/ads", handlers.GetAllAds)
                admin.POST("/ads", handlers.CreateAd)
                admin.PUT("/ads/:id", handlers.UpdateAd)
                admin.DELETE("/ads/:id", handlers.DeleteAd)
                admin.POST("/ads/upload", handlers.UploadAdImage)
                admin.POST("/ads/suggest", handlers.SuggestAd)
                admin.GET("/fees", handlers.GetFeeSchedules)
                admin.PUT("/fees/:id", handlers.UpdateFeeSchedule)
        }

        // Public routes (outside versioned group)
        v1.GET("/ads", handlers.GetActiveAds)
        v1.GET("/fees", handlers.GetFeeSchedules)
        r.GET("/ws/market", websocket.HandleMarketWebSocket)
        r.GET("/ws/user", websocket.HandleUserWebSocket)

        r.Static("/uploads", "./uploads")

        port := os.Getenv("PORT")
        if port == "" {
                port = "3000"
        }

        srv := &http.Server{
                Addr:         ":" + port,
                Handler:      r,
                ReadTimeout:  15 * time.Second,
                WriteTimeout: 15 * time.Second,
                IdleTimeout:  60 * time.Second,
        }

        go func() {
                logg.Info("EgMoney Go Backend starting", map[string]interface{}{"port": port})
                if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                        logg.Fatal("listen error", map[string]interface{}{"error": err.Error()})
                }
        }()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        logg.Info("Shutting down server...", nil)

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        if err := srv.Shutdown(ctx); err != nil {
                logg.Fatal("Server forced to shutdown", map[string]interface{}{"error": err.Error()})
        }

        logg.Info("Server exited gracefully", nil)
}
