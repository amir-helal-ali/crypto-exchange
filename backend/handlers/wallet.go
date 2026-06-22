package handlers

import (
        "fmt"
        "net/http"
        "strings"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/models"

        "github.com/gin-gonic/gin"
        "golang.org/x/crypto/bcrypt"
        "gorm.io/gorm"
)

func GetWalletBalances(c *gin.Context) {
        userID := c.GetUint("user_id")
        var wallets []models.Wallet
        database.DB.Where("user_id = ?", userID).Find(&wallets)

        if len(wallets) == 0 {
                wallets = []models.Wallet{}
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "data": wallets})
}

func GetUserInfo(c *gin.Context) {
        userID := c.GetUint("user_id")
        var user models.User
        if err := database.DB.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
                "id":         user.ID,
                "email":      user.Email,
                "username":   user.Username,
                "full_name":  user.FullName,
                "country":    user.Country,
                "phone":      user.Phone,
                "role":       user.Role,
                "created_at": user.CreatedAt,
        }})
}

func UpdateProfile(c *gin.Context) {
        userID := c.GetUint("user_id")
        var input struct {
                Username string `json:"username"`
                Email    string `json:"email"`
                FullName string `json:"full_name"`
                Country  string `json:"country"`
                Phone    string `json:"phone"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        updates := map[string]interface{}{}
        if input.Username != "" {
                input.Username = strings.TrimSpace(input.Username)
                if len(input.Username) < 3 {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters"})
                        return
                }
                updates["username"] = input.Username
        }
        if input.Email != "" {
                input.Email = strings.TrimSpace(strings.ToLower(input.Email))
                updates["email"] = input.Email
        }
        if input.FullName != "" {
                updates["full_name"] = input.FullName
        }
        if input.Country != "" {
                updates["country"] = input.Country
        }
        if input.Phone != "" {
                updates["phone"] = input.Phone
        }

        if len(updates) == 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
                return
        }

        if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
                c.JSON(http.StatusConflict, gin.H{"error": "Username or email already taken"})
                return
        }

        var updatedUser models.User
        database.DB.First(&updatedUser, userID)

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "Profile updated successfully", "data": updatedUser})
}

// WithdrawCurrency handles withdrawal requests.
// Funds are deducted immediately from the wallet and a PENDING transaction is created.
// The admin must then approve or reject the withdrawal.
// If rejected, the admin handler returns the funds to the wallet.
func WithdrawCurrency(c *gin.Context) {
        userID := c.GetUint("user_id")
        var input struct {
                Currency string  `json:"currency" binding:"required"`
                Amount   float64 `json:"amount" binding:"required,gt=0"`
                Address  string  `json:"address" binding:"required,min=10"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
        input.Address = strings.TrimSpace(input.Address)

        if input.Amount < 0.001 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Minimum withdrawal amount is 0.001"})
                return
        }

        var createdTx models.Transaction
        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                // Lock wallet row with FOR UPDATE for concurrent safety
                var lockedWallet models.Wallet
                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                        Where("user_id = ? AND currency = ?", userID, input.Currency).First(&lockedWallet).Error; err != nil {
                        return fmt.Errorf("محفظة %s غير موجودة", input.Currency)
                }

                // Use centralized validation
                validationErrors := ValidateWithdrawal(input.Currency, input.Amount, input.Address, lockedWallet.Balance)
                if validationErrors.HasErrors() {
                        for _, msg := range validationErrors {
                                return fmt.Errorf("%s", msg)
                        }
                }

                if lockedWallet.Balance < input.Amount {
                        return fmt.Errorf("رصيد %s غير كافٍ (المطلوب: %.8f، المتاح: %.8f)", input.Currency, input.Amount, lockedWallet.Balance)
                }

                // Deduct funds immediately
                lockedWallet.Balance -= input.Amount
                if err := dbTx.Save(&lockedWallet).Error; err != nil {
                        return err
                }

                // Create PENDING transaction for admin review
                tx := models.Transaction{
                        UserID:   userID,
                        Type:     "withdraw",
                        Currency: input.Currency,
                        Amount:   input.Amount,
                        Status:   "PENDING",
                        Address:  input.Address,
                }
                if err := dbTx.Create(&tx).Error; err != nil {
                        return err
                }
                // Capture for live notification after commit
                createdTx = tx
                return nil
        })

        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Live push to admin dashboard (no polling)
        NotifyAdminNewTransaction(&createdTx)

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تقديم طلب السحب بنجاح. سيتم مراجعته من قبل الإدارة."})
}

func GetTransactions(c *gin.Context) {
        userID := c.GetUint("user_id")
        page, limit := getPagination(c)
        offset := (page - 1) * limit

        var total int64
        database.DB.Model(&models.Transaction{}).Where("user_id = ?", userID).Count(&total)

        var transactions []models.Transaction
        database.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Offset(offset).Find(&transactions)

        c.JSON(http.StatusOK, gin.H{"success": true, "data": transactions, "total": total, "page": page, "limit": limit})
}

// DepositCurrency handles deposit requests.
// Since deposits and withdrawals are processed manually by the admin,
// this endpoint creates a PENDING transaction that must be approved by admin.
// Funds are NOT credited until the admin approves the deposit.
func DepositCurrency(c *gin.Context) {
        userID := c.GetUint("user_id")
        var input struct {
                Currency string  `json:"currency" binding:"required"`
                Amount   float64 `json:"amount" binding:"required,gt=0"`
                TxID     string  `json:"tx_id" binding:"required"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
        input.TxID = strings.TrimSpace(input.TxID)

        // Use centralized validation
        validationErrors := ValidateDeposit(input.Currency, input.Amount, input.TxID)
        if validationErrors.HasErrors() {
                for _, msg := range validationErrors {
                        c.JSON(http.StatusBadRequest, gin.H{"error": msg})
                        return
                }
        }

        if input.Amount <= 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Amount must be greater than zero"})
                return
        }

        // Verify wallet exists for this currency
        var wallet models.Wallet
        if err := database.DB.Where("user_id = ? AND currency = ?", userID, input.Currency).First(&wallet).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "محفظة هذه العملة غير موجودة"})
                return
        }

        // Create PENDING deposit transaction — admin must approve before funds are credited
        tx := models.Transaction{
                UserID:   userID,
                Type:     "deposit",
                Currency: input.Currency,
                Amount:   input.Amount,
                Status:   "PENDING",
                TxID:     input.TxID,
        }
        if err := database.DB.Create(&tx).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "فشل إنشاء طلب الإيداع"})
                return
        }

        // Live push to admin dashboard (no polling)
        NotifyAdminNewTransaction(&tx)

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "message": "تم تقديم طلب الإيداع بنجاح. سيتم مراجعته من قبل الإدارة وإضافة الرصيد بعد التأكيد.",
                "data":    tx,
        })
}

func ChangePassword(c *gin.Context) {
        userID := c.GetUint("user_id")
        var input struct {
                CurrentPassword string `json:"current_password" binding:"required"`
                NewPassword     string `json:"new_password" binding:"required,min=8"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        // Enforce strong password using centralized validation
        if err := ValidatePasswordStrength(input.NewPassword); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var user models.User
        if err := database.DB.First(&user, userID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
                return
        }

        if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.CurrentPassword)); err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
                return
        }

        hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
                return
        }

        // Update password and invalidate all sessions in a transaction
        txErr := database.DB.Transaction(func(dbTx *gorm.DB) error {
                if err := dbTx.Model(&user).Update("password_hash", string(hashedPassword)).Error; err != nil {
                        return err
                }
                // Revoke all refresh tokens to force re-login on all devices
                if err := dbTx.Where("user_id = ?", userID).Delete(&models.RefreshToken{}).Error; err != nil {
                        return err
                }
                return nil
        })

        if txErr != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "فشل تحديث كلمة المرور"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى على جميع الأجهزة."})
}
