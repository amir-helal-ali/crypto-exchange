package handlers

import (
	"net/http"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
		updates["username"] = input.Username
	}
	if input.Email != "" {
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

	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username or email already taken"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Profile updated successfully"})
}

func WithdrawCurrency(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		Currency string  `json:"currency" binding:"required"`
		Amount   float64 `json:"amount" binding:"required,gt=0"`
		Address  string  `json:"address" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var wallet models.Wallet
	if err := database.DB.Where("user_id = ? AND currency = ?", userID, input.Currency).First(&wallet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Wallet not found for this currency"})
		return
	}

	if wallet.Balance < input.Amount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient balance"})
		return
	}

	tx := models.Transaction{
		UserID:   userID,
		Type:     "withdraw",
		Currency: input.Currency,
		Amount:   input.Amount,
		Status:   "PENDING",
		Address:  input.Address,
	}
	database.DB.Create(&tx)

	wallet.Balance -= input.Amount
	database.DB.Save(&wallet)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Withdrawal request submitted", "data": tx})
}

func GetTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")
	var transactions []models.Transaction
	database.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(50).Find(&transactions)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": transactions})
}

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

	var wallet models.Wallet
	if err := database.DB.Where("user_id = ? AND currency = ?", userID, input.Currency).First(&wallet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Wallet not found for this currency"})
		return
	}

	wallet.Balance += input.Amount
	database.DB.Save(&wallet)

	tx := models.Transaction{
		UserID:   userID,
		Type:     "deposit",
		Currency: input.Currency,
		Amount:   input.Amount,
		Status:   "COMPLETED",
		TxID:     input.TxID,
	}
	database.DB.Create(&tx)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deposit successful", "data": tx})
}

func ChangePassword(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
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

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	database.DB.Model(&user).Update("password_hash", string(hashedPassword))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Password changed successfully"})
}
