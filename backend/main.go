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
                adminPass = "Admin@123456"
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

        gin.SetMode(gin.ReleaseMode)

        database.Connect()
        seedAdmin()

        matching.Start(10 * time.Second)

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

        rl := handlers.NewRateLimiter(120, time.Minute)
        r.Use(rl.Middleware())

        r.MaxMultipartMemory = 5 << 20

        r.GET("/", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "name": "EgMoney API", "version": "1.0.0"})
        })

        r.GET("/api/health", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "message": "EgMoney Go Backend is running"})
        })

        r.GET("/api/market/prices", handlers.GetPrices)
        r.GET("/api/market/klines", handlers.GetKlines)

        r.POST("/api/auth/register", handlers.Register)
        r.POST("/api/auth/login", handlers.Login)
        r.POST("/api/auth/forgot-password", handlers.ForgotPassword)
        r.POST("/api/auth/reset-password", handlers.ResetPassword)
        r.GET("/api/auth/verify-email", handlers.VerifyEmail)
        r.POST("/api/auth/resend-verification", handlers.ResendVerification)
        r.POST("/api/auth/verify-2fa", handlers.Verify2FA)

        // 2FA management routes (require authentication)
        twofa := r.Group("/api/auth")
        twofa.Use(handlers.AuthMiddleware())
        {
                twofa.POST("/setup-2fa", handlers.Setup2FA)
                twofa.POST("/enable-2fa", handlers.Enable2FA)
                twofa.POST("/disable-2fa", handlers.Disable2FA)
        }

        userKYC := r.Group("/api/kyc")
        userKYC.Use(handlers.AuthMiddleware())
        {
                userKYC.POST("/submit", handlers.SubmitKYC)
                userKYC.GET("/status", handlers.GetMyKYC)
        }

        protected := r.Group("/api/exchange")
        protected.Use(handlers.AuthMiddleware())
        {
                protected.POST("/order", handlers.PlaceOrder)
                protected.GET("/orders", handlers.GetOrders)
                protected.POST("/order/:id/cancel", handlers.CancelOrder)
        }

        wallet := r.Group("/api")
        wallet.Use(handlers.AuthMiddleware())
        {
                wallet.GET("/wallet/balances", handlers.GetWalletBalances)
                wallet.GET("/user/info", handlers.GetUserInfo)
                wallet.PUT("/user/profile", handlers.UpdateProfile)
                wallet.POST("/user/change-password", handlers.ChangePassword)
                wallet.POST("/wallet/deposit", handlers.DepositCurrency)
                wallet.POST("/wallet/withdraw", handlers.WithdrawCurrency)
                wallet.GET("/wallet/transactions", handlers.GetTransactions)
        }

        admin := r.Group("/api/admin")
        admin.Use(handlers.AuthMiddleware(), handlers.AdminMiddleware())
        {
                admin.GET("/stats", handlers.GetAdminStats)
                admin.GET("/users", handlers.GetAllUsers)
                admin.GET("/audit-logs", handlers.GetAuditLogs)
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
        }

        r.GET("/api/ads", handlers.GetActiveAds)
        r.GET("/ws/market", websocket.HandleMarketWebSocket)

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
