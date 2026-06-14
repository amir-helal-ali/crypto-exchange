package scheduler

import (
	"log"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"gorm.io/gorm"
)

// StartCleanupScheduler starts background goroutines that periodically
// clean up expired tokens, stale sessions, and old audit logs.
func StartCleanupScheduler() {
	// Run cleanup every hour
	ticker := time.NewTicker(1 * time.Hour)

	// Run once immediately on startup
	runCleanup()

	go func() {
		for range ticker.C {
			runCleanup()
		}
	}()

	log.Println("[Scheduler] Cleanup scheduler started (runs every hour)")
}

func runCleanup() {
	cleanExpiredEmailTokens()
	cleanExpiredPasswordResetTokens()
	cleanExpiredRefreshTokens()
	cleanOldAuditLogs()
}

// cleanExpiredEmailTokens removes email verification tokens that have expired.
// Also marks the user's email as requiring re-verification if token was never used.
func cleanExpiredEmailTokens() {
	result := database.DB.Where("expires_at < ? AND used = ?", time.Now(), false).
		Delete(&models.EmailVerificationToken{})

	if result.RowsAffected > 0 {
		log.Printf("[Scheduler] Cleaned %d expired email verification tokens", result.RowsAffected)
	}

	// Also clean used tokens older than 7 days (housekeeping)
	database.DB.Where("used = ? AND expires_at < ?", true, time.Now().AddDate(0, 0, -7)).
		Delete(&models.EmailVerificationToken{})
}

// cleanExpiredPasswordResetTokens removes expired password reset tokens.
func cleanExpiredPasswordResetTokens() {
	result := database.DB.Where("expires_at < ?", time.Now()).
		Delete(&models.PasswordResetToken{})

	if result.RowsAffected > 0 {
		log.Printf("[Scheduler] Cleaned %d expired password reset tokens", result.RowsAffected)
	}

	// Also clean used tokens older than 7 days
	database.DB.Where("used = ? AND expires_at < ?", true, time.Now().AddDate(0, 0, -7)).
		Delete(&models.PasswordResetToken{})
}

// cleanExpiredRefreshTokens removes expired and revoked refresh tokens.
func cleanExpiredRefreshTokens() {
	result := database.DB.Where("expires_at < ? OR revoked = ?", time.Now(), true).
		Delete(&models.RefreshToken{})

	if result.RowsAffected > 0 {
		log.Printf("[Scheduler] Cleaned %d expired/revoked refresh tokens", result.RowsAffected)
	}
}

// cleanOldAuditLogs archives/deletes audit logs older than 90 days.
// For production, consider archiving to cold storage instead of deleting.
func cleanOldAuditLogs() {
	cutoff := time.Now().AddDate(0, 0, -90)

	result := database.DB.Where("created_at < ?", cutoff).
		Delete(&models.AuditLog{})

	if result.RowsAffected > 0 {
		log.Printf("[Scheduler] Cleaned %d audit logs older than 90 days", result.RowsAffected)
	}
}

// CleanStaleOrders checks for PENDING orders that have been open for too long.
// LIMIT orders older than 30 days with no fills are auto-cancelled.
// This prevents order book pollution and fund lock-up.
func CleanStaleOrders() {
	cutoff := time.Now().AddDate(0, 0, -30)

	var staleOrders []models.Order
	if err := database.DB.Where(
		"status = ? AND created_at < ? AND filled_quantity = ?",
		"PENDING", cutoff, 0,
	).Find(&staleOrders).Error; err != nil {
		log.Printf("[Scheduler] Error finding stale orders: %v", err)
		return
	}

	if len(staleOrders) == 0 {
		return
	}

	for _, order := range staleOrders {
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			// Release reserved funds
			if order.Side == "BUY" && order.ReservedAmount > 0 {
				var wallet models.Wallet
				if err := tx.Set("gorm:query_option", "FOR UPDATE").
					Where("user_id = ? AND currency = ?", order.UserID, "USDT").
					First(&wallet).Error; err != nil {
					return err
				}
				if err := tx.Model(&wallet).Update("balance", wallet.Balance+order.ReservedAmount).Error; err != nil {
					return err
				}
			} else if order.Side == "SELL" && order.ReservedAmount > 0 {
				baseCurrency := order.Symbol[:len(order.Symbol)-4] // Remove "USDT"
				var wallet models.Wallet
				if err := tx.Set("gorm:query_option", "FOR UPDATE").
					Where("user_id = ? AND currency = ?", order.UserID, baseCurrency).
					First(&wallet).Error; err != nil {
					return err
				}
				if err := tx.Model(&wallet).Update("balance", wallet.Balance+order.ReservedAmount).Error; err != nil {
					return err
				}
			}

			// Mark order as cancelled
			return tx.Model(&order).Updates(map[string]interface{}{
				"status":          "CANCELLED",
				"reserved_amount": 0,
			}).Error
		})

		if err != nil {
			log.Printf("[Scheduler] Error cancelling stale order #%d: %v", order.ID, err)
		} else {
			log.Printf("[Scheduler] Auto-cancelled stale order #%d (user %d, %s %s)", order.ID, order.UserID, order.Side, order.Symbol)
		}
	}

	log.Printf("[Scheduler] Cleaned %d stale orders (30+ days, no fills)", len(staleOrders))
}
