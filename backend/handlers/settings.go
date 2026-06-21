package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"
	"crypto-exchange-backend/settings"

	"github.com/gin-gonic/gin"
)

// allowedSettingKeys restricts which keys an admin can write to via the
// settings endpoint. This prevents accidental overwrite of internal flags.
var allowedSettingKeys = map[string]string{
	"frontend_domain":      "domains",
	"backend_domain":       "domains",
	"admin_domain":         "domains",
	"main_domain":          "domains",
	"ssl_enabled":          "ssl",
	"ssl_cert_path":        "ssl",
	"ssl_key_path":         "ssl",
	"cors_extra_origins":   "security",
	"registration_open":    "features",
	"maintenance_mode":     "features",
	"maintenance_message":  "features",
}

// GetSystemSettings returns all system settings grouped by category.
// Admin-only endpoint: GET /api/v1/admin/settings
func GetSystemSettings(c *gin.Context) {
	var rows []models.SystemSetting
	if err := database.DB.Order("category ASC, key ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	// Group by category
	grouped := make(map[string]map[string]string)
	for _, r := range rows {
		if grouped[r.Category] == nil {
			grouped[r.Category] = make(map[string]string)
		}
		grouped[r.Category][r.Key] = r.Value
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    grouped,
	})
}

// UpdateSystemSettings bulk-updates settings from a JSON body.
// Admin-only endpoint: PUT /api/v1/admin/settings
//
// Request body:
//   { "settings": { "frontend_domain": "new.example.com", "ssl_enabled": "false" } }
//
// Only keys in allowedSettingKeys are accepted; unknown keys are silently
// ignored (defense in depth — even if admin role is compromised, only
// whitelisted knobs can be turned).
func UpdateSystemSettings(c *gin.Context) {
	var req struct {
		Settings map[string]string `json:"settings" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)

	updated := []string{}
	rejected := []string{}
	for key, value := range req.Settings {
		category, ok := allowedSettingKeys[key]
		if !ok {
			rejected = append(rejected, key)
			continue
		}
		// Basic validation for SSL paths (must be absolute or empty)
		if (key == "ssl_cert_path" || key == "ssl_key_path") && value != "" && !strings.HasPrefix(value, "/") {
			rejected = append(rejected, key+" (must be absolute path)")
			continue
		}
		// Validate boolean settings
		if key == "ssl_enabled" || key == "registration_open" || key == "maintenance_mode" {
			v := strings.ToLower(value)
			if v != "true" && v != "false" && v != "1" && v != "0" && v != "yes" && v != "no" {
				rejected = append(rejected, key+" (must be true/false)")
				continue
			}
		}
		// Validate domain format (basic check)
		if strings.HasSuffix(key, "_domain") && value != "" {
			if len(value) < 3 || strings.Contains(value, " ") || strings.Contains(value, "://") {
				rejected = append(rejected, key+" (invalid domain format)")
				continue
			}
		}
		if err := settings.Set(key, value, category, uid); err != nil {
			rejected = append(rejected, key+" (db error: "+err.Error()+")")
			continue
		}
		updated = append(updated, key)
	}

	// Log to audit
	if uid > 0 {
		details := fmt.Sprintf("Updated settings: %s", strings.Join(updated, ", "))
		database.DB.Create(&models.AuditLog{
			UserID:    uid,
			Action:    "SETTINGS_UPDATE",
			Details:   details,
			IPAddress: c.ClientIP(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"updated":  updated,
		"rejected": rejected,
		"message":  fmt.Sprintf("Updated %d setting(s).", len(updated)),
	})
}

// ReloadNginx triggers nginx to reload its configuration. This is called
// by the admin UI after domain changes so the new config takes effect.
//
// The reload works by:
// 1. Calling the settings-nginx sidecar (if running) to regenerate
//    /etc/nginx/conf.d/exchange.conf from the template + current settings
// 2. Sending HUP signal to nginx master process via `nginx -s reload`
//
// If the sidecar is not available (e.g., dev mode without nginx), the
// endpoint returns 200 with a warning instead of failing.
//
// Admin-only endpoint: POST /api/v1/admin/nginx/reload
func ReloadNginx(c *gin.Context) {
	// Path to the config-generator script inside the nginx container.
	// In docker-compose, this is mounted at /usr/local/bin/regen-nginx.sh
	// We trigger it via docker exec on the nginx container, OR (preferred)
	// by touching a trigger file that an inotify watcher picks up.
	//
	// For simplicity, we use the trigger-file approach: writing to
	// /shared/nginx/.reload-trigger (a volume shared with the nginx
	// sidecar) causes the sidecar to regenerate + reload.

	triggerPath := os.Getenv("NGINX_RELOAD_TRIGGER")
	if triggerPath == "" {
		triggerPath = "/shared/nginx/.reload-trigger"
	}

	// Write current timestamp to the trigger file
	content := fmt.Sprintf("%d\n", time.Now().UnixNano())
	if err := os.WriteFile(triggerPath, []byte(content), 0644); err != nil {
		// Trigger file not writable — likely dev mode (no shared volume).
		// Return success with warning so admin UI doesn't fail.
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"warning": "nginx reload trigger unavailable (no shared volume). In dev mode, restart nginx manually.",
			"mode":    "dev",
		})
		return
	}

	// Optional: also try `nginx -s reload` directly if we're on the same
	// container (rare). Best-effort, ignore errors.
	_ = exec.Command("nginx", "-s", "reload").Run()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Nginx reload triggered. New config will be live within 2-3 seconds.",
		"mode":    "production",
	})
}

// GetPublicConfig returns a subset of system settings that are safe to
// expose to the public (no auth required). Used by the frontend to
// dynamically discover the API URL and feature flags.
//
// Public endpoint: GET /api/v1/config
func GetPublicConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"backend_domain":      settings.GetDefault("backend_domain", ""),
		"frontend_domain":     settings.GetDefault("frontend_domain", ""),
		"admin_domain":        settings.GetDefault("admin_domain", ""),
		"ssl_enabled":         settings.GetBool("ssl_enabled"),
		"registration_open":   settings.GetBool("registration_open"),
		"maintenance_mode":    settings.GetBool("maintenance_mode"),
		"maintenance_message": settings.GetDefault("maintenance_message", ""),
		"timestamp":           time.Now().UTC().Format(time.RFC3339),
	})
}
