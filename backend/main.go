package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/handlers"
	"crypto-exchange-backend/models"
	"crypto-exchange-backend/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func seedAdmin() {
	var count int64
	database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&count)
	if count > 0 {
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte("Admin@123456"), bcrypt.DefaultCost)
	admin := models.User{
		Email:        "admin@eg-money.com",
		Username:     "admin",
		PasswordHash: string(hash),
		Role:         "ADMIN",
	}
	if err := database.DB.Create(&admin).Error; err != nil {
		log.Printf("Failed to seed admin: %v", err)
	} else {
		log.Println("Admin user created: admin@eg-money.com / Admin@123456")
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	gin.SetMode(gin.ReleaseMode)

	database.Connect()
	seedAdmin()

	r := gin.Default()

	r.Use(handlers.CORSMiddleware())

	rl := handlers.NewRateLimiter(120, time.Minute)
	r.Use(rl.Middleware())

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
	}

	r.GET("/api/ads", handlers.GetActiveAds)
	r.GET("/ws/market", websocket.HandleMarketWebSocket)

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
		log.Printf("EgMoney Go Backend starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %s", err)
	}

	log.Println("Server exited gracefully")
}
