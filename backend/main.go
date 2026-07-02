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
        "crypto-exchange-backend/pubsub"
        exchangeredis "crypto-exchange-backend/redis"
        "crypto-exchange-backend/scheduler"
        "crypto-exchange-backend/settings"
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

        // Wire the matching engine to MarketHub's live ticker stream.
        // Two-directional injection (no import cycle):
        //   • matching ← MarketHub prices: SetPriceProvider lets the
        //     matching engine read live prices from MarketHub's cache
        //     instead of polling Binance REST.
        //   • matching → MarketHub events: SetTickerHook lets MarketHub
        //     notify the matching engine on every live tick so orders
        //     are evaluated with zero polling latency.
        matching.SetPriceProvider(func(symbol string) (float64, bool) {
                tc := websocket.GlobalMarketHub.GetTicker(symbol)
                if tc == nil {
                        return 0, false
                }
                return tc.Price, true
        })
        websocket.SetTickerHook(matching.OnTickerUpdate)

        // Load system settings into in-memory cache (domains, SSL, feature flags)
        settings.Refresh()

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

        // Stricter rate limiting for auth endpoints (20 requests per minute per IP)
        authRL := handlers.NewRateLimiter(20, time.Minute)

        r.MaxMultipartMemory = 5 << 20

        r.GET("/", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok", "name": "EgMoney API", "version": "1.0.0"})
        })

        // Health checks remain at /api/ (no version prefix - always latest)
        // Registered for both GET and HEAD: Docker healthcheck, wget --spider,
        // AWS ELB, and Kubernetes HTTP probes all commonly send HEAD requests,
        // but Gin does NOT auto-route HEAD to GET handlers (unlike net/http).
        r.GET("/api/health", handlers.HealthCheck)
        r.HEAD("/api/health", handlers.HealthCheck)
        r.GET("/api/health/ready", handlers.ReadinessCheck)
        r.HEAD("/api/health/ready", handlers.ReadinessCheck)
        r.GET("/api/health/live", handlers.LivenessCheck)
        r.HEAD("/api/health/live", handlers.LivenessCheck)

        // === v1 API routes ===
        v1 := r.Group("/api/v1")

        v1.GET("/market/prices", handlers.GetPrices)
        v1.GET("/market/klines", handlers.GetKlines)

        // Public config endpoint — no auth required (used by frontend to
        // discover API URL, feature flags, maintenance status at runtime).
        v1.GET("/config", handlers.GetPublicConfig)

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
                        admin.PUT("/user/:id/verify-email", handlers.AdminVerifyEmail)
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

                        // System settings — domain management, SSL, feature flags
                        admin.GET("/settings", handlers.GetSystemSettings)
                        admin.PUT("/settings", handlers.UpdateSystemSettings)
                        admin.POST("/nginx/reload", handlers.ReloadNginx)

                        // Domain verification — checks DNS + HTTP reachability
                        admin.POST("/domains/verify", handlers.VerifyDomain)

                        // Write current settings to .env override file (for docker compose)
                        admin.POST("/settings/write-env", handlers.WriteEnvSettings)

                        // SSL certificate management — one-click cert generation
                        // (local self-signed OR Let's Encrypt production certs),
                        // status inspection, renewal, and custom PEM upload.
                        admin.GET("/ssl/status", handlers.GetSSLStatus)
                        admin.POST("/ssl/generate", handlers.GenerateSSLCertificate)
                        admin.POST("/ssl/renew", handlers.RenewSSLCertificate)
                        admin.POST("/ssl/install", handlers.InstallSSLCertificate)

                        // Infrastructure metrics — for Prometheus scraping / admin
                        // observability dashboard. Returns live WebSocket / SSE /
                        // Binance / Redis PubSub / Go runtime stats. Polling by a
                        // monitoring agent IS appropriate here (metrics are not
                        // user-facing data); the endpoint is admin-only so internal
                        // stats are never leaked publicly.
                        admin.GET("/metrics", handlers.GetMetrics)
                }

        // Public routes (outside versioned group)
        v1.GET("/ads", handlers.GetActiveAds)
        v1.GET("/fees", handlers.GetFeeSchedules)

        // Live market data — REST snapshots + multiplexed WebSocket hubs.
        // All multi-symbol live data flows through /ws/market; dedicated
        // single-purpose sockets (kline/trades/orderbook) are kept for
        // backwards compatibility with simpler clients.
        v1.GET("/market/tickers", websocket.ServeAllTickersJSON)
        v1.GET("/market/orderbook", websocket.ServeOrderbookJSON)
        v1.GET("/market/trades", websocket.ServeRecentTradesJSON)
        r.GET("/ws/market", websocket.HandleMarketWebSocket)
        r.GET("/ws/kline", websocket.HandleKlineWebSocket)
        r.GET("/ws/trades", websocket.HandleTradesWebSocket)
        r.GET("/ws/orderbook", websocket.HandleOrderbookWebSocket)
        r.GET("/ws/user", websocket.HandleUserWebSocket)

        // Admin live stream (SSE) — pushes stats / transactions / users /
        // KYC updates to the admin dashboard in real time. No polling.
        r.GET("/api/v1/admin/stream", handlers.HandleAdminSSE)

        r.Static("/uploads", "./uploads")

        port := os.Getenv("PORT")
        if port == "" {
                port = "3000"
        }

        srv := &http.Server{
                Addr:         ":" + port,
                Handler:      r,
                ReadTimeout:  0, // no read timeout — required for long-lived WebSocket & SSE connections
                WriteTimeout: 0, // no write timeout — required for SSE streaming and WebSocket idle
                IdleTimeout:  120 * time.Second,
                // Explicit read/write header timeouts still apply — they protect
                // against slowloris-style attacks without breaking streaming.
                ReadHeaderTimeout: 10 * time.Second,
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

        // Close Redis Pub/Sub subscriber FIRST so we stop receiving cross-
        // instance events before our local subscribers are torn down.
        // This prevents the subscriber goroutine from trying to deliver
        // to handlers whose packages may have already been finalized.
        pubsub.Close()

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        if err := srv.Shutdown(ctx); err != nil {
                logg.Fatal("Server forced to shutdown", map[string]interface{}{"error": err.Error()})
        }

        logg.Info("Server exited gracefully", nil)
}
