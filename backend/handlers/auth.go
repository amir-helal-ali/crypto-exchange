package handlers

import (
        "crypto/rand"
        "encoding/hex"
        "fmt"
        "net/http"
        "os"
        "strings"
        "sync"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/email"
        "crypto-exchange-backend/models"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
        "gorm.io/gorm"
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

// generateVerificationToken creates a cryptographically secure 64-byte hex token
func generateVerificationToken() (string, error) {
        tokenBytes := make([]byte, 32)
        if _, err := rand.Read(tokenBytes); err != nil {
                return "", err
        }
        return hex.EncodeToString(tokenBytes), nil
}

// sendVerificationEmailToUser creates a verification token and sends the email
func sendVerificationEmailToUser(userID uint, userEmail string) error {
        token, err := generateVerificationToken()
        if err != nil {
                return fmt.Errorf("failed to generate token: %w", err)
        }

        verificationToken := models.EmailVerificationToken{
                UserID:    userID,
                Token:     token,
                ExpiresAt: time.Now().Add(24 * time.Hour),
        }
        if err := database.DB.Create(&verificationToken).Error; err != nil {
                return fmt.Errorf("failed to save token: %w", err)
        }

        baseURL := os.Getenv("FRONTEND_URL")
        if baseURL == "" {
                baseURL = "https://eg-money.local"
        }
        verificationLink := fmt.Sprintf("%s/verify-email?token=%s", baseURL, token)

        if email.IsConfigured() {
                if err := email.SendVerificationEmail(userEmail, verificationLink); err != nil {
                        return fmt.Errorf("failed to send email: %w", err)
                }
        } else {
                fmt.Printf("[DEV] Email verification link for %s: %s\n", userEmail, verificationLink)
        }

        return nil
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
                Email:         input.Email,
                Username:      input.Username,
                PasswordHash:  string(hash),
                FullName:      input.FullName,
                Country:       input.Country,
                Phone:         input.Phone,
                Role:          "USER",
                EmailVerified: false,
        }

        if err := database.DB.Create(&user).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Email or username already registered"})
                return
        }

        createUserWallets(user.ID)

        // Send verification email (non-blocking: log error but don't fail registration)
        if err := sendVerificationEmailToUser(user.ID, user.Email); err != nil {
                fmt.Printf("[WARN] Failed to send verification email to %s: %v\n", user.Email, err)
        }

        database.DB.Create(&models.AuditLog{
                UserID:    user.ID,
                Action:    "REGISTER",
                Details:   "New user registered - pending email verification",
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        // Do NOT auto-login: user must verify email first
        c.JSON(http.StatusCreated, gin.H{
                "success": true,
                "message": "تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل حسابك.",
                "email":   user.Email,
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
                c.JSON(http.StatusUnauthorized, gin.H{"error": "بيانات الدخول غير صحيحة"})
                return
        }

        if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "بيانات الدخول غير صحيحة"})
                return
        }

        // Check email verification (skip for ADMIN users)
        if user.Role != "ADMIN" && !user.EmailVerified {
                c.JSON(http.StatusForbidden, gin.H{
                        "error":           "يرجى تأكيد بريدك الإلكتروني أولاً",
                        "code":            "EMAIL_NOT_VERIFIED",
                        "email":           user.Email,
                        "requires_verify": true,
                })
                return
        }

        // Check 2FA
        if user.TwoFAEnabled {
                tempToken, err := generateVerificationToken()
                if err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "حدث خطأ غير متوقع"})
                        return
                }
                temp2FATokens.Store(tempToken, twoFASession{
                        UserID:    user.ID,
                        ExpiresAt: time.Now().Add(5 * time.Minute),
                })
                c.JSON(http.StatusOK, gin.H{
                        "success":       true,
                        "requires_2fa":  true,
                        "temp_token":    tempToken,
                        "message":       "يرجى إدخال رمز المصادقة الثنائية",
                })
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

// --- 2FA temp session storage (in-memory until Redis) ---
type twoFASession struct {
        UserID    uint
        ExpiresAt time.Time
}

var temp2FATokens sync.Map

// VerifyEmail handles GET /api/auth/verify-email?token=xxx
func VerifyEmail(c *gin.Context) {
        token := c.Query("token")
        if token == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "رمز التحقق مفقود"})
                return
        }

        var verificationToken models.EmailVerificationToken
        if err := database.DB.Where("token = ? AND used = ? AND expires_at > ?", token, false, time.Now()).First(&verificationToken).Error; err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "رمز التحقق غير صالح أو منتهي الصلاحية"})
                return
        }

        // Mark email as verified and invalidate the token in a transaction
        err := database.DB.Transaction(func(tx *gorm.DB) error {
                if err := tx.Model(&models.User{}).Where("id = ?", verificationToken.UserID).Update("email_verified", true).Error; err != nil {
                        return err
                }
                if err := tx.Model(&verificationToken).Update("used", true).Error; err != nil {
                        return err
                }
                return nil
        })

        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "فشل تحديث حالة التحقق"})
                return
        }

        database.DB.Create(&models.AuditLog{
                UserID:    verificationToken.UserID,
                Action:    "EMAIL_VERIFIED",
                Details:   "Email verified successfully",
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "message": "تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.",
        })
}

// ResendVerification handles POST /api/auth/resend-verification
func ResendVerification(c *gin.Context) {
        var input struct {
                Email string `json:"email" binding:"required,email"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        input.Email = strings.TrimSpace(strings.ToLower(input.Email))

        var user models.User
        if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
                // Don't reveal whether email exists (security best practice)
                c.JSON(http.StatusOK, gin.H{
                        "success": true,
                        "message": "إذا كان البريد مسجلاً وغير مؤكد، سيتم إرسال رابط التحقق",
                })
                return
        }

        // Already verified
        if user.EmailVerified {
                c.JSON(http.StatusOK, gin.H{
                        "success": true,
                        "message": "إذا كان البريد مسجلاً وغير مؤكد، سيتم إرسال رابط التحقق",
                })
                return
        }

        // Rate limit: check if a token was created in the last 60 seconds
        var recentToken models.EmailVerificationToken
        oneMinuteAgo := time.Now().Add(-1 * time.Minute)
        if err := database.DB.Where("user_id = ? AND created_at > ?", user.ID, oneMinuteAgo).First(&recentToken).Error; err == nil {
                c.JSON(http.StatusTooManyRequests, gin.H{
                        "error":   "يرجى الانتظار 60 ثانية قبل طلب رابط جديد",
                        "code":    "RATE_LIMITED",
                        "retry_after": 60,
                })
                return
        }

        if err := sendVerificationEmailToUser(user.ID, user.Email); err != nil {
                fmt.Printf("[WARN] Failed to resend verification email to %s: %v\n", user.Email, err)
        }

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "message": "إذا كان البريد مسجلاً وغير مؤكد، سيتم إرسال رابط التحقق",
        })
}

// Verify2FA handles POST /api/auth/verify-2fa
func Verify2FA(c *gin.Context) {
        var input struct {
                TempToken string `json:"temp_token" binding:"required"`
                Code      string `json:"code" binding:"required"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Validate temp token
        sessionVal, ok := temp2FATokens.Load(input.TempToken)
        if !ok {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "رمز مؤقت غير صالح"})
                return
        }

        session := sessionVal.(twoFASession)
        if time.Now().After(session.ExpiresAt) {
                temp2FATokens.Delete(input.TempToken)
                c.JSON(http.StatusUnauthorized, gin.H{"error": "انتهت صلاحية الرمز المؤقت"})
                return
        }

        var user models.User
        if err := database.DB.First(&user, session.UserID).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "حدث خطأ غير متوقع"})
                return
        }

        // Verify TOTP code (or backup code)
        if !validateTOTP(user.TwoFASecret, input.Code) && !isBackupCode(user.TwoFABackupCodes, input.Code) {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "رمز المصادقة الثنائية غير صحيح"})
                return
        }

        // Valid - generate JWT and clean up
        temp2FATokens.Delete(input.TempToken)
        token, _ := GenerateJWT(user.ID, user.Role)

        database.DB.Create(&models.AuditLog{
                UserID:    user.ID,
                Action:    "LOGIN_2FA",
                Details:   "User logged in with 2FA",
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

        baseURL := os.Getenv("FRONTEND_URL")
        if baseURL == "" {
                baseURL = "https://eg-money.local"
        }
        resetLink := fmt.Sprintf("%s/reset-password?token=%s", baseURL, token)

        if email.IsConfigured() {
                html := fmt.Sprintf(`<!DOCTYPE html><html dir="rtl"><body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center">
                        <div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
                        <h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
                        <h2 style="color:#fff;font-size:18px;margin:16px 0">إعادة تعيين كلمة المرور</h2>
                        <p style="color:#a1a1aa;font-size:14px;line-height:1.6">اضغط على الزر أدناه لإعادة تعيين كلمة المرور. هذا الرابط صالح لمدة ساعة واحدة.</p>
                        <a href="%s" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:14px;margin:16px 0">إعادة تعيين كلمة المرور</a>
                        <p style="color:#52525b;font-size:12px;margin-top:24px">إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
                        </div></body></html>`, resetLink)
                if err := email.Send(user.Email, "إعادة تعيين كلمة المرور - EgMoney", html); err != nil {
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

// validateTOTP validates a TOTP code against the given secret.
// Full implementation will be added in Feature 4.2 (2FA).
func validateTOTP(secret string, code string) bool {
        // Stub: will be replaced with full TOTP validation in 4.2
        return false
}

// isBackupCode checks if the code matches a backup code and marks it as used.
// Full implementation will be added in Feature 4.2 (2FA).
func isBackupCode(backupCodes string, code string) bool {
        // Stub: will be replaced with full backup code validation in 4.2
        return false
}
