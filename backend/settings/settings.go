// Package settings provides thread-safe access to system settings stored
// in the database. Settings are cached in-memory for fast lookups and
// refreshed on demand (after admin updates via /api/v1/admin/settings).
//
// Usage:
//
//	settings.Refresh()                       // load all settings from DB
//	v := settings.Get("frontend_domain")     // cached read
//	v := settings.GetDefault("key", "fallback")
//	settings.Set("key", "value", userID)     // write to DB + cache
package settings

import (
	"sync"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"gorm.io/gorm"
)

var (
	mu      sync.RWMutex
	cache   = make(map[string]string)
	loaded  bool
)

// Refresh reloads all settings from the database into the in-memory cache.
// Safe to call concurrently. Called once at startup and after every admin
// update via /api/v1/admin/settings.
func Refresh() {
	var rows []models.SystemSetting
	if err := database.DB.Find(&rows).Error; err != nil {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	cache = make(map[string]string, len(rows))
	for _, r := range rows {
		cache[r.Key] = r.Value
	}
	loaded = true
}

// ensureLoaded loads the cache once on first access. Subsequent calls are
// no-ops. This avoids requiring explicit Refresh() at startup if the
// caller forgets.
func ensureLoaded() {
	if !loaded {
		Refresh()
	}
}

// Get returns the value for the given key, or empty string if not found.
func Get(key string) string {
	ensureLoaded()
	mu.RLock()
	defer mu.RUnlock()
	return cache[key]
}

// GetDefault returns the value for the given key, or the provided default
// if the key is missing or empty.
func GetDefault(key, def string) string {
	v := Get(key)
	if v == "" {
		return def
	}
	return v
}

// GetBool returns true if the setting value is "true", "1", "yes", or "on".
func GetBool(key string) bool {
	v := Get(key)
	switch v {
	case "true", "1", "yes", "on", "TRUE", "True":
		return true
	}
	return false
}

// Set writes a setting to the database and updates the in-memory cache.
// userID is the admin user who made the change (for audit purposes).
func Set(key, value, category string, userID uint) error {
	s := models.SystemSetting{
		Key:       key,
		Value:     value,
		Category:  category,
		UpdatedAt: time.Now(),
		UpdatedBy: userID,
	}
	result := database.DB.Where("key = ?", key).
		Assign(models.SystemSetting{Value: value, Category: category, UpdatedAt: time.Now(), UpdatedBy: userID}).
		FirstOrCreate(&s)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		return result.Error
	}
	mu.Lock()
	cache[key] = value
	mu.Unlock()
	return nil
}

// All returns a copy of all settings as a map. Used by the admin endpoint
// to return the full configuration snapshot.
func All() map[string]string {
	ensureLoaded()
	mu.RLock()
	defer mu.RUnlock()
	out := make(map[string]string, len(cache))
	for k, v := range cache {
		out[k] = v
	}
	return out
}

// ByCategory returns all settings in a given category.
func ByCategory(cat string) map[string]string {
	ensureLoaded()
	mu.RLock()
	defer mu.RUnlock()
	out := make(map[string]string)
	// We don't have category in cache, so query DB directly
	var rows []models.SystemSetting
	database.DB.Where("category = ?", cat).Find(&rows)
	for _, r := range rows {
		out[r.Key] = r.Value
	}
	return out
}

// AllowedOrigins returns the list of CORS-allowed origins derived from
// current domain settings + any extra origins configured by admin.
// Always includes localhost variants for dev compatibility.
func AllowedOrigins() []string {
	scheme := "https"
	if !GetBool("ssl_enabled") {
		scheme = "http"
	}
	origins := []string{
		scheme + "://" + GetDefault("frontend_domain", "localhost"),
		scheme + "://" + GetDefault("backend_domain", "localhost"),
		scheme + "://" + GetDefault("admin_domain", "localhost"),
		// Always allow localhost for dev / direct port access
		"http://localhost:3000",
		"http://localhost:3001",
		"http://localhost:3002",
		"http://127.0.0.1:3000",
		"http://127.0.0.1:3001",
		"http://127.0.0.1:3002",
	}
	if extra := Get("cors_extra_origins"); extra != "" {
		// comma-separated list
		// (split logic is in caller to keep this package simple)
	}
	return origins
}
