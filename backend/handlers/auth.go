package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/email"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = func() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		panic("CRITICAL: JWT_SECRET environment variable is not set")
	}
	return []byte(s)
}()

type Claims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateJWT(userID uint, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ValidateJWT(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}

var supportedCurrencies = []string{"BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT"}

func createUserWallets(userID uint) {
	for _, currency := range supportedCurrencies {
		database.DB.Create(&models.Wallet{
			UserID:   userID,
			Currency: currency,
			Balance:  0,
		})
	}
}

func Register(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Username string `json:"username" binding:"required,min=3,max=50"`
		Password string `json:"password" binding:"required,min=6"`
		FullName string `json:"full_name"`
		Country  string `json:"country"`
		Phone    string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Username = strings.TrimSpace(input.Username)
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:        input.Email,
		Username:     input.Username,
		PasswordHash: string(hash),
		FullName:     input.FullName,
		Country:      input.Country,
		Phone:        input.Phone,
		Role:         "USER",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email or username already registered"})
		return
	}

	createUserWallets(user.ID)

	database.DB.Create(&models.AuditLog{
		UserID:    user.ID,
		Action:    "REGISTER",
		Details:   "New user registered",
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	token, _ := GenerateJWT(user.ID, user.Role)
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "User registered successfully",
		"token":   token,
		"user":    user,
	})
}

func Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, _ := GenerateJWT(user.ID, user.Role)

	database.DB.Create(&models.AuditLog{
		UserID:    user.ID,
		Action:    "LOGIN",
		Details:   "User logged in",
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"user":    user,
	})
}

func ForgotPassword(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", strings.TrimSpace(strings.ToLower(input.Email))).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "If the email exists, a reset link has been sent"})
		return
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate reset token"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	resetToken := models.PasswordResetToken{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err := database.DB.Create(&resetToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reset token"})
		return
	}

	database.DB.Create(&models.AuditLog{
		UserID:    user.ID,
		Action:    "PASSWORD_RESET_REQUESTED",
		Details:   "Password reset requested",
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	resetLink := fmt.Sprintf("https://eg-money.local/reset-password?token=%s", token)

	if email.IsConfigured() {
		html := fmt.Sprintf(`<!DOCTYPE html><html dir="rtl"><body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center">
			<div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
			<h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
			<h2 style="color:#fff;font-size:18px;margin:16px 0">Reset Password Request</h2>
			<p style="color:#a1a1aa;font-size:14px;line-height:1.6">Click the button below to reset your password. This link expires in 1 hour.</p>
			<a href="%s" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:14px;margin:16px 0">Reset Password</a>
			<p style="color:#52525b;font-size:12px;margin-top:24px">If you did not request a password reset, please ignore this email.</p>
			</div></body></html>`, resetLink)
		if err := email.Send(user.Email, "Reset Your EgMoney Password", html); err != nil {
			fmt.Printf("Email send error: %v\n", err)
		}
	} else {
		fmt.Printf("Password reset link for %s (%s): %s\n", user.Email, resetToken.Token[:8]+"...", resetLink)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "If the email exists, a reset link has been sent"})
}

func ResetPassword(c *gin.Context) {
	var input struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var resetToken models.PasswordResetToken
	if err := database.DB.Where("token = ? AND used = ? AND expires_at > ?", input.Token, false, time.Now()).First(&resetToken).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := database.DB.Model(&models.User{}).Where("id = ?", resetToken.UserID).Update("password_hash", string(hash)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	database.DB.Model(&resetToken).Update("used", true)

	database.DB.Create(&models.AuditLog{
		UserID:    resetToken.UserID,
		Action:    "PASSWORD_RESET_COMPLETED",
		Details:   "Password reset completed successfully",
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Password has been reset successfully"})
}
