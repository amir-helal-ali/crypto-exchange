package handlers

import (
        "fmt"
        "net/http"
        "strings"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/models"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

func GetAdminStats(c *gin.Context) {
        var totalUsers int64
        var totalOrders int64
        var totalTransactions int64
        var pendingWithdrawals int64
        var pendingDeposits int64
        var pendingKYC int64
        database.DB.Model(&models.User{}).Count(&totalUsers)
        database.DB.Model(&models.Order{}).Count(&totalOrders)
        database.DB.Model(&models.Transaction{}).Count(&totalTransactions)
        database.DB.Model(&models.Transaction{}).Where("type = ? AND status = ?", "withdraw", "PENDING").Count(&pendingWithdrawals)
        database.DB.Model(&models.Transaction{}).Where("type = ? AND status = ?", "deposit", "PENDING").Count(&pendingDeposits)
        database.DB.Model(&models.KYCRequest{}).Where("status = ?", "PENDING").Count(&pendingKYC)

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "data": gin.H{
                        "totalUsers":         totalUsers,
                        "totalOrders":       totalOrders,
                        "totalTransactions": totalTransactions,
                        "pendingWithdrawals": pendingWithdrawals,
                        "pendingDeposits":   pendingDeposits,
                        "pendingKYC":        pendingKYC,
                },
        })
}

func GetAllUsers(c *gin.Context) {
        page, limit := getPagination(c)
        offset := (page - 1) * limit
        var total int64
        database.DB.Model(&models.User{}).Count(&total)
        var users []models.User
        database.DB.Select("id", "email", "username", "role", "created_at").Order("created_at DESC").Limit(limit).Offset(offset).Find(&users)

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

// buildAuditQuery constructs the base GORM query for audit logs with optional filters.
// Supported query params: action, user_id, search, date_from, date_to
func buildAuditQuery(c *gin.Context) *gorm.DB {
        q := database.DB.Model(&models.AuditLog{})

        if action := c.Query("action"); action != "" {
                q = q.Where("action = ?", action)
        }
        if userID := c.Query("user_id"); userID != "" {
                q = q.Where("user_id = ?", userID)
        }
        if search := c.Query("search"); search != "" {
                q = q.Where("details ILIKE ?", "%"+search+"%")
        }
        if dateFrom := c.Query("date_from"); dateFrom != "" {
                if t, err := time.Parse("2006-01-02", dateFrom); err == nil {
                        q = q.Where("created_at >= ?", t)
                }
        }
        if dateTo := c.Query("date_to"); dateTo != "" {
                if t, err := time.Parse("2006-01-02", dateTo); err == nil {
                        q = q.Where("created_at < ?", t.AddDate(0, 0, 1))
                }
        }

        return q
}

func GetAuditLogs(c *gin.Context) {
        page, limit := getPagination(c)
        offset := (page - 1) * limit

        q := buildAuditQuery(c)

        var total int64
        q.Count(&total)

        var logs []models.AuditLog
        q.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs)

        formattedLogs := make([]gin.H, len(logs))
        for i, log := range logs {
                username := "System"
                if log.User != nil {
                        username = log.User.Username
                }
                formattedLogs[i] = gin.H{
                        "id":        log.ID,
                        "user_id":   log.UserID,
                        "action":    log.Action,
                        "details":   log.Details,
                        "ipAddress": log.IPAddress,
                        "username":  username,
                        "createdAt": log.CreatedAt,
                }
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "data": formattedLogs, "total": total, "page": page, "limit": limit})
}

// ExportAuditLogsCSV exports filtered audit logs as a CSV file download.
func ExportAuditLogsCSV(c *gin.Context) {
        q := buildAuditQuery(c)

        var logs []models.AuditLog
        q.Preload("User").Order("created_at DESC").Limit(10000).Find(&logs)

        c.Header("Content-Type", "text/csv; charset=utf-8")
        c.Header("Content-Disposition", "attachment; filename=audit-logs.csv")

        // BOM for Excel UTF-8 compatibility
        c.Writer.Write([]byte("\xEF\xBB\xBF"))

        c.Writer.WriteString("ID,Username,Action,Details,IP Address,Created At\n")
        for _, log := range logs {
                username := "System"
                if log.User != nil {
                        username = log.User.Username
                }
                details := log.Details
                if details == "" {
                        details = "-"
                }
                // Escape CSV fields containing commas or quotes
                if strings.Contains(details, ",") || strings.Contains(details, "\"") {
                        details = "\"" + strings.ReplaceAll(details, "\"", "\"\"") + "\""
                }
                c.Writer.WriteString(fmt.Sprintf("%d,%s,%s,%s,%s,%s\n",
                        log.ID,
                        username,
                        log.Action,
                        details,
                        log.IPAddress,
                        log.CreatedAt.UTC().Format("2006-01-02 15:04:05"),
                ))
        }
}

func GetAllTransactions(c *gin.Context) {
        page, limit := getPagination(c)
        offset := (page - 1) * limit

        var total int64
        database.DB.Model(&models.Transaction{}).Count(&total)

        var txns []models.Transaction
        database.DB.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&txns)

        formatted := make([]gin.H, len(txns))
        for i, t := range txns {
                username := "—"
                email := "—"
                if t.User != nil {
                        username = t.User.Username
                        email = t.User.Email
                }
                formatted[i] = gin.H{
                        "id":        t.ID,
                        "user_id":   t.UserID,
                        "username":  username,
                        "email":     email,
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

// ReviewTransaction handles both deposit and withdrawal review by admin.
//
// For WITHDRAWAL transactions (funds already deducted at request time):
//   - approve: marks as COMPLETED, records blockchain TxID
//   - reject:  marks as REJECTED and returns funds to user's wallet
//
// For DEPOSIT transactions (funds NOT yet credited):
//   - approve: marks as COMPLETED and credits funds to user's wallet (with row locking)
//   - reject:  marks as REJECTED (no fund movement needed)
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

        var statusText string

        err := database.DB.Transaction(func(dbTx *gorm.DB) error {
                // Lock the transaction row to prevent concurrent processing
                var lockedTxn models.Transaction
                if err := dbTx.Where("id = ? AND status = ?", txn.ID, "PENDING").First(&lockedTxn).Error; err != nil {
                        return fmt.Errorf("المعاملة قيد المعالجة بالفعل")
                }

                if input.Action == "approve" {
                        lockedTxn.Status = "COMPLETED"
                        if input.TxID != "" {
                                lockedTxn.TxID = input.TxID
                        }

                        // For deposits: credit funds to user's wallet
                        if lockedTxn.Type == "deposit" {
                                var wallet models.Wallet
                                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                                        Where("user_id = ? AND currency = ?", lockedTxn.UserID, lockedTxn.Currency).First(&wallet).Error; err != nil {
                                        return fmt.Errorf("محفظة المستخدم غير موجودة")
                                }
                                wallet.Balance += lockedTxn.Amount
                                if err := dbTx.Save(&wallet).Error; err != nil {
                                        return fmt.Errorf("فشل إضافة الرصيد: %v", err)
                                }
                        }

                } else {
                        // Reject
                        lockedTxn.Status = "REJECTED"

                        // For withdrawals: return funds to user's wallet (were deducted at request time)
                        if lockedTxn.Type == "withdraw" {
                                var wallet models.Wallet
                                if err := dbTx.Set("gorm:query_option", "FOR UPDATE").
                                        Where("user_id = ? AND currency = ?", lockedTxn.UserID, lockedTxn.Currency).First(&wallet).Error; err == nil {
                                        wallet.Balance += lockedTxn.Amount
                                        if err := dbTx.Save(&wallet).Error; err != nil {
                                                return fmt.Errorf("فشل إعادة الرصيد: %v", err)
                                        }
                                }
                        }
                        // For deposits: no fund movement needed (were never credited)
                }

                if err := dbTx.Save(&lockedTxn).Error; err != nil {
                        return err
                }
                return nil
        })

        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }

        // Log the action
        actionType := "إيداع"
        if txn.Type == "withdraw" {
                actionType = "سحب"
        }

        database.DB.Create(&models.AuditLog{
                UserID:    adminID.(uint),
                Action:    "REVIEW_TRANSACTION",
                Details:   fmt.Sprintf("%s %s #%d for %.8f %s (user #%d)", input.Action, actionType, txn.ID, txn.Amount, txn.Currency, txn.UserID),
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        if input.Action == "approve" {
                if txn.Type == "deposit" {
                        statusText = "تمت الموافقة على الإيداع وإضافة الرصيد"
                } else {
                        statusText = "تمت الموافقة على السحب"
                }
        } else {
                if txn.Type == "deposit" {
                        statusText = "تم رفض طلب الإيداع"
                } else {
                        statusText = "تم رفض السحب وإعادة الرصيد"
                }
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "message": statusText})

        // Send notifications to the user
        if input.Action == "approve" {
                if txn.Type == "deposit" {
                        NotifyDepositApproved(txn.UserID, txn.Currency, txn.Amount)
                } else {
                        NotifyWithdrawalApproved(txn.UserID, txn.Currency, txn.Amount)
                }
        } else {
                if txn.Type == "withdraw" {
                        NotifyWithdrawalRejected(txn.UserID, txn.Currency, txn.Amount)
                }
        }
}

// GetFeeSchedules returns all fee schedules
func GetFeeSchedules(c *gin.Context) {
        var fees []models.FeeSchedule
        database.DB.Order("user_type, order_type").Find(&fees)
        c.JSON(http.StatusOK, gin.H{"success": true, "data": fees})
}

// UpdateFeeSchedule updates a specific fee schedule
func UpdateFeeSchedule(c *gin.Context) {
        feeID := c.Param("id")
        adminID, _ := c.Get("user_id")

        var input struct {
                MakerFee *float64 `json:"maker_fee"`
                TakerFee *float64 `json:"taker_fee"`
                MinFee   *float64 `json:"min_fee"`
        }
        if err := c.ShouldBindJSON(&input); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        var fee models.FeeSchedule
        if err := database.DB.First(&fee, feeID).Error; err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": "Fee schedule not found"})
                return
        }

        updates := map[string]interface{}{}
        if input.MakerFee != nil {
                updates["maker_fee"] = *input.MakerFee
        }
        if input.TakerFee != nil {
                updates["taker_fee"] = *input.TakerFee
        }
        if input.MinFee != nil {
                updates["min_fee"] = *input.MinFee
        }

        if len(updates) == 0 {
                c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
                return
        }

        if err := database.DB.Model(&fee).Updates(updates).Error; err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fee schedule"})
                return
        }

        database.DB.Create(&models.AuditLog{
                UserID:    adminID.(uint),
                Action:    "UPDATE_FEE_SCHEDULE",
                Details:   fmt.Sprintf("Updated fee schedule #%s: %v", feeID, updates),
                IPAddress: c.ClientIP(),
                CreatedAt: time.Now(),
        })

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تحديث جدول الرسوم بنجاح", "data": fee})
}
