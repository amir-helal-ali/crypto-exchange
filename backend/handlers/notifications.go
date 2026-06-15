package handlers

import (
        "net/http"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/models"
        "crypto-exchange-backend/notifications"

        "github.com/gin-gonic/gin"
)

// GetNotifications returns the current user's notifications with pagination
func GetNotifications(c *gin.Context) {
        userID := c.GetUint("user_id")
        page, limit := getPagination(c)
        offset := (page - 1) * limit

        var total int64
        database.DB.Model(&models.Notification{}).Where("user_id = ?", userID).Count(&total)

        var notifs []models.Notification
        database.DB.Where("user_id = ?", userID).
                Order("created_at DESC").
                Limit(limit).
                Offset(offset).
                Find(&notifs)

        // Count unread
        var unreadCount int64
        database.DB.Model(&models.Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&unreadCount)

        c.JSON(http.StatusOK, gin.H{
                "success":      true,
                "data":         notifs,
                "total":        total,
                "unread_count": unreadCount,
                "page":         page,
                "limit":        limit,
        })
}

// MarkNotificationRead marks a single notification as read
func MarkNotificationRead(c *gin.Context) {
        userID := c.GetUint("user_id")
        notificationID := c.Param("id")

        result := database.DB.Model(&models.Notification{}).
                Where("id = ? AND user_id = ?", notificationID, userID).
                Update("read", true)

        if result.RowsAffected == 0 {
                c.JSON(http.StatusNotFound, gin.H{"error": "الإشعار غير موجود"})
                return
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تحديد الإشعار كمقروء"})
}

// MarkAllNotificationsRead marks all notifications as read for the current user
func MarkAllNotificationsRead(c *gin.Context) {
        userID := c.GetUint("user_id")

        database.DB.Model(&models.Notification{}).
                Where("user_id = ? AND read = ?", userID, false).
                Update("read", true)

        c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تحديد جميع الإشعارات كمقروءة"})
}

// --- Notification helper wrappers (delegate to notifications package) ---

// CreateNotification creates a notification for a user
func CreateNotification(userID uint, notifType string, title string, body string, data string) {
        notifications.CreateNotification(userID, notifType, title, body, data)
}

// NotifyOrderFilled creates a notification when an order is filled
func NotifyOrderFilled(userID uint, symbol string, side string, orderType string, quantity float64, fillPrice float64, orderID uint) {
        notifications.NotifyOrderFilled(userID, symbol, side, orderType, quantity, fillPrice, orderID)
}

// NotifyOrderCancelled creates a notification when an order is cancelled
func NotifyOrderCancelled(userID uint, symbol string, side string, quantity float64, orderID uint) {
        notifications.NotifyOrderCancelled(userID, symbol, side, quantity, orderID)
}

// NotifyOrderTriggered creates a notification when a STOP_LIMIT or TAKE_PROFIT order is triggered
func NotifyOrderTriggered(userID uint, symbol string, side string, orderType string, triggerPrice float64, orderID uint) {
        notifications.NotifyOrderTriggered(userID, symbol, side, orderType, triggerPrice, orderID)
}

// NotifyDepositApproved creates a notification when a deposit is approved
func NotifyDepositApproved(userID uint, currency string, amount float64) {
        notifications.NotifyDepositApproved(userID, currency, amount)
}

// NotifyWithdrawalApproved creates a notification when a withdrawal is approved
func NotifyWithdrawalApproved(userID uint, currency string, amount float64) {
        notifications.NotifyWithdrawalApproved(userID, currency, amount)
}

// NotifyWithdrawalRejected creates a notification when a withdrawal is rejected
func NotifyWithdrawalRejected(userID uint, currency string, amount float64) {
        notifications.NotifyWithdrawalRejected(userID, currency, amount)
}

// NotifyKYCApproved creates a notification when KYC is approved
func NotifyKYCApproved(userID uint) {
        notifications.NotifyKYCApproved(userID)
}

// NotifyKYCRejected creates a notification when KYC is rejected
func NotifyKYCRejected(userID uint, reason string) {
        notifications.NotifyKYCRejected(userID, reason)
}
