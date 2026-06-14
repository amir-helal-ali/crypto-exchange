package handlers

import (
	"fmt"
	"net/http"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

// GetNotifications returns the current user's notifications with pagination
func GetNotifications(c *gin.Context) {
	userID := c.GetUint("user_id")
	page, limit := getPagination(c)
	offset := (page - 1) * limit

	var total int64
	database.DB.Model(&models.Notification{}).Where("user_id = ?", userID).Count(&total)

	var notifications []models.Notification
	database.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notifications)

	// Count unread
	var unreadCount int64
	database.DB.Model(&models.Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"data":         notifications,
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

// --- Helper functions to create notifications ---

// CreateNotification creates a notification for a user (used by other handlers and matching engine)
func CreateNotification(userID uint, notifType string, title string, body string, data string) {
	notification := models.Notification{
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Body:      body,
		Data:      data,
		Read:      false,
		CreatedAt: time.Now(),
	}
	if err := database.DB.Create(&notification).Error; err != nil {
		fmt.Printf("[WARN] Failed to create notification for user %d: %v\n", userID, err)
	}
}

// NotifyOrderFilled creates a notification when an order is filled
func NotifyOrderFilled(userID uint, symbol string, side string, orderType string, quantity float64, fillPrice float64, orderID uint) {
	sideLabel := "شراء"
	if side == "SELL" {
		sideLabel = "بيع"
	}
	title := fmt.Sprintf("تم تنفيذ أمر %s", sideLabel)
	body := fmt.Sprintf("تم تنفيذ أمرك: %s %.8f %s بسعر %.2f", sideLabel, quantity, symbol, fillPrice)
	data := fmt.Sprintf(`{"order_id":%d,"symbol":"%s","side":"%s","type":"%s","quantity":%.8f,"fill_price":%.2f}`, orderID, symbol, side, orderType, quantity, fillPrice)
	CreateNotification(userID, "ORDER_FILLED", title, body, data)
}

// NotifyOrderCancelled creates a notification when an order is cancelled
func NotifyOrderCancelled(userID uint, symbol string, side string, quantity float64, orderID uint) {
	sideLabel := "شراء"
	if side == "SELL" {
		sideLabel = "بيع"
	}
	title := "تم إلغاء الأمر"
	body := fmt.Sprintf("تم إلغاء أمرك: %s %.8f %s وإعادة الرصيد المحجوز", sideLabel, quantity, symbol)
	data := fmt.Sprintf(`{"order_id":%d,"symbol":"%s","side":"%s"}`, orderID, symbol, side)
	CreateNotification(userID, "ORDER_CANCELLED", title, body, data)
}

// NotifyOrderTriggered creates a notification when a STOP_LIMIT or TAKE_PROFIT order is triggered
func NotifyOrderTriggered(userID uint, symbol string, side string, orderType string, triggerPrice float64, orderID uint) {
	typeLabel := "وقف خسارة"
	if orderType == "TAKE_PROFIT" {
		typeLabel = "جني أرباح"
	}
	title := fmt.Sprintf("تم تفعيل أمر %s", typeLabel)
	body := fmt.Sprintf("تم تفعيل أمرك (%s %s %s) عند سعر %.2f", typeLabel, side, symbol, triggerPrice)
	data := fmt.Sprintf(`{"order_id":%d,"symbol":"%s","side":"%s","type":"%s","trigger_price":%.2f}`, orderID, symbol, side, orderType, triggerPrice)
	CreateNotification(userID, "ORDER_TRIGGERED", title, body, data)
}

// NotifyDepositApproved creates a notification when a deposit is approved
func NotifyDepositApproved(userID uint, currency string, amount float64) {
	title := "تم تأكيد الإيداع"
	body := fmt.Sprintf("تم إضافة %.8f %s إلى محفظتك بنجاح", amount, currency)
	data := fmt.Sprintf(`{"type":"deposit","currency":"%s","amount":%.8f}`, currency, amount)
	CreateNotification(userID, "DEPOSIT_APPROVED", title, body, data)
}

// NotifyWithdrawalApproved creates a notification when a withdrawal is approved
func NotifyWithdrawalApproved(userID uint, currency string, amount float64) {
	title := "تم تأكيد السحب"
	body := fmt.Sprintf("تم معالجة طلب سحب %.8f %s بنجاح", amount, currency)
	data := fmt.Sprintf(`{"type":"withdrawal","currency":"%s","amount":%.8f}`, currency, amount)
	CreateNotification(userID, "WITHDRAWAL_APPROVED", title, body, data)
}

// NotifyWithdrawalRejected creates a notification when a withdrawal is rejected
func NotifyWithdrawalRejected(userID uint, currency string, amount float64) {
	title := "تم رفض طلب السحب"
	body := fmt.Sprintf("تم رفض طلب سحب %.8f %s وتم إعادة الرصيد إلى محفظتك", amount, currency)
	data := fmt.Sprintf(`{"type":"withdrawal","currency":"%s","amount":%.8f}`, currency, amount)
	CreateNotification(userID, "WITHDRAWAL_REJECTED", title, body, data)
}

// NotifyKYCApproved creates a notification when KYC is approved
func NotifyKYCApproved(userID uint) {
	CreateNotification(userID, "KYC_APPROVED", "تم التحقق من هويتك", "تمت الموافقة على طلب التحقق من الهوية. يمكنك الآن استخدام جميع ميزات المنصة.", `{"type":"kyc","status":"approved"}`)
}

// NotifyKYCRejected creates a notification when KYC is rejected
func NotifyKYCRejected(userID uint, reason string) {
	body := fmt.Sprintf("تم رفض طلب التحقق من الهوية. السبب: %s", reason)
	CreateNotification(userID, "KYC_REJECTED", "تم رفض طلب التحقق", body, `{"type":"kyc","status":"rejected"}`)
}
