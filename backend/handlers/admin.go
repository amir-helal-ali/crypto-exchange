package handlers

import (
	"fmt"
	"net/http"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

func GetAdminStats(c *gin.Context) {
	var totalUsers int64
	var totalOrders int64
	var totalTransactions int64
	var pendingWithdrawals int64
	database.DB.Model(&models.User{}).Count(&totalUsers)
	database.DB.Model(&models.Order{}).Count(&totalOrders)
	database.DB.Model(&models.Transaction{}).Count(&totalTransactions)
	database.DB.Model(&models.Transaction{}).Where("type = ? AND status = ?", "withdraw", "PENDING").Count(&pendingWithdrawals)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"totalUsers":         totalUsers,
			"totalOrders":        totalOrders,
			"totalTransactions":  totalTransactions,
			"pendingWithdrawals": pendingWithdrawals,
		},
	})
}

func GetAllUsers(c *gin.Context) {
	page, limit := getPagination(c)
	offset := (page - 1) * limit
	var total int64
	database.DB.Model(&models.User{}).Count(&total)
	var users []models.User
	database.DB.Select("id", "email", "username", "role", "created_at").Limit(limit).Offset(offset).Find(&users)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": users, "total": total, "page": page, "limit": limit})
}

func UpdateUserRole(c *gin.Context) {
	userID := c.Param("id")
	adminID, _ := c.Get("user_id")

	var input struct {
		Role string `json:"role" binding:"required,oneof=USER ADMIN VERIFIED_USER"`
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

	database.DB.Model(&user).Update("role", input.Role)

	database.DB.Create(&models.AuditLog{
		UserID:    adminID.(uint),
		Action:    "UPDATE_USER_ROLE",
		Details:   fmt.Sprintf("Updated user %s (ID: %s) role to %s", user.Username, userID, input.Role),
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "User role updated successfully"})
}

func GetAuditLogs(c *gin.Context) {
	page, limit := getPagination(c)
	offset := (page - 1) * limit
	var total int64
	database.DB.Model(&models.AuditLog{}).Count(&total)
	var logs []models.AuditLog
	database.DB.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs)

	formattedLogs := make([]gin.H, len(logs))
	for i, log := range logs {
		username := "System"
		if log.User != nil {
			username = log.User.Username
		}
		formattedLogs[i] = gin.H{
			"id":        log.ID,
			"action":    log.Action,
			"details":   log.Details,
			"ipAddress": log.IPAddress,
			"username":  username,
			"createdAt": log.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": formattedLogs, "total": total, "page": page, "limit": limit})
}

func GetAllTransactions(c *gin.Context) {
	page, limit := getPagination(c)
	offset := (page - 1) * limit

	var total int64
	database.DB.Model(&models.Transaction{}).Count(&total)

	var txns []models.Transaction
	database.DB.Order("created_at DESC").Limit(limit).Offset(offset).Find(&txns)

	formatted := make([]gin.H, len(txns))
	for i, t := range txns {
		var user models.User
		database.DB.Select("id", "email", "username").First(&user, t.UserID)
		formatted[i] = gin.H{
			"id":        t.ID,
			"user_id":   t.UserID,
			"username":  user.Username,
			"type":      t.Type,
			"currency":  t.Currency,
			"amount":    t.Amount,
			"status":    t.Status,
			"address":   t.Address,
			"tx_id":     t.TxID,
			"createdAt": t.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": formatted, "total": total, "page": page, "limit": limit})
}

func ReviewTransaction(c *gin.Context) {
	txID := c.Param("id")
	adminID, _ := c.Get("user_id")

	var input struct {
		Action string `json:"action" binding:"required,oneof=approve reject"`
		TxID   string `json:"tx_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var txn models.Transaction
	if err := database.DB.First(&txn, txID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	if txn.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction already processed"})
		return
	}

	if input.Action == "approve" {
		txn.Status = "COMPLETED"
		txn.TxID = input.TxID
	} else {
		txn.Status = "FAILED"
		var wallet models.Wallet
		if err := database.DB.Where("user_id = ? AND currency = ?", txn.UserID, txn.Currency).First(&wallet).Error; err == nil {
			wallet.Balance += txn.Amount
			database.DB.Save(&wallet)
		}
	}

	database.DB.Save(&txn)

	database.DB.Create(&models.AuditLog{
		UserID:    adminID.(uint),
		Action:    "REVIEW_TRANSACTION",
		Details:   fmt.Sprintf("%s withdrawal #%d for %.4f %s", input.Action, txn.ID, txn.Amount, txn.Currency),
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	statusText := "تمت الموافقة على السحب"
	if input.Action == "reject" {
		statusText = "تم رفض السحب وإعادة الرصيد"
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": statusText})
}
