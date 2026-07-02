package database

import (
        "log"
        "os"
        "strings"
        "time"

        "crypto-exchange-backend/models"

        "gorm.io/driver/postgres"
        "gorm.io/gorm"
        "gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
        dsn := os.Getenv("DATABASE_URL")
        if dsn == "" {
                log.Fatal("CRITICAL: DATABASE_URL environment variable is not set. Refusing to start with hardcoded credentials.")
        }

        var err error
        DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
                Logger: logger.Default.LogMode(logger.Silent),
        })
        if err != nil {
                log.Fatalf("Failed to connect to database: %v", err)
        }

        sqlDB, err := DB.DB()
        if err != nil {
                log.Fatalf("Failed to get DB instance: %v", err)
        }
        sqlDB.SetMaxOpenConns(25)
        sqlDB.SetMaxIdleConns(10)
        sqlDB.SetConnMaxLifetime(5 * time.Minute)

        err = DB.AutoMigrate(
                &models.User{}, &models.Order{}, &models.Wallet{}, &models.AuditLog{},
                &models.KYCRequest{}, &models.Transaction{}, &models.Ad{},
                &models.PasswordResetToken{}, &models.EmailVerificationToken{},
                &models.RefreshToken{}, &models.Notification{}, &models.FeeSchedule{},
                &models.SystemSetting{},
        )
        if err != nil {
                log.Fatalf("Failed to migrate database: %v", err)
        }

        // Create additional indexes for frequently queried columns
        createIndexes()

        // Seed default system settings (domains, SSL, etc.)
        seedSystemSettings()

        log.Println("Database connected and migrated successfully")
}

// createIndexes adds performance-critical indexes that GORM tag-based
// indexes may not cover, especially composite and partial indexes.
func createIndexes() {
        indexes := []struct {
                name string
                sql  string
        }{
                // Orders: most common query patterns
                {
                        name: "idx_orders_user_status",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status)`,
                },
                {
                        name: "idx_orders_symbol_status",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON orders(symbol, status)`,
                },
                {
                        name: "idx_orders_status_created",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)`,
                },
                // Transactions: admin list + user filter
                {
                        name: "idx_transactions_user_type",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type)`,
                },
                {
                        name: "idx_transactions_status_created",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC)`,
                },
                // Audit logs: admin search + user history
                {
                        name: "idx_audit_logs_user_action",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action)`,
                },
                {
                        name: "idx_audit_logs_created_desc",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON audit_logs(created_at DESC)`,
                },
                // Refresh tokens: cleanup + session validation
                {
                        name: "idx_refresh_tokens_user_revoked",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked)`,
                },
                // Email verification tokens: cleanup + validation
                {
                        name: "idx_email_tokens_user_created",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user_created ON email_verification_tokens(user_id, created_at)`,
                },
                // Password reset tokens: cleanup
                {
                        name: "idx_password_reset_tokens_expires",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at)`,
                },
                // Notifications: user inbox
                {
                        name: "idx_notifications_user_read",
                        sql:  `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)`,
                },
        }

        for _, idx := range indexes {
                if err := DB.Exec(idx.sql).Error; err != nil {
                        log.Printf("[DB] Warning: Failed to create index %s: %v", idx.name, err)
                }
        }

        log.Println("[DB] Database indexes verified")
}

// defaultSettings defines the seed values for SystemSetting rows.
// These are written once on first startup; admin users can edit them
// later via the /api/v1/admin/settings endpoint. Existing rows are
// never overwritten by seedSystemSettings.
//
// Domain and SSL defaults are read from environment variables so the
// initial seed matches the deployment environment (docker-compose .env).
// If the env vars are not set, safe localhost defaults are used.
var defaultSettings = []models.SystemSetting{
        // Domains (used by nginx template + CORS middleware)
        {Key: "frontend_domain", Value: envOrDefault("FRONTEND_DOMAIN", "localhost"), Category: "domains"},
        {Key: "backend_domain", Value: envOrDefault("BACKEND_DOMAIN", "localhost"), Category: "domains"},
        {Key: "admin_domain", Value: envOrDefault("ADMIN_DOMAIN", "localhost"), Category: "domains"},
        {Key: "main_domain", Value: envOrDefault("MAIN_DOMAIN", "localhost"), Category: "domains"},

        // Ports — nginx listen ports, internal service ports, host access ports
        {Key: "nginx_http_port", Value: envOrDefault("NGINX_HTTP_PORT", "80"), Category: "ports"},
        {Key: "nginx_https_port", Value: envOrDefault("NGINX_HTTPS_PORT", "443"), Category: "ports"},
        {Key: "backend_internal_port", Value: envOrDefault("BACKEND_INTERNAL_PORT", "3000"), Category: "ports"},
        {Key: "frontend_internal_port", Value: envOrDefault("FRONTEND_INTERNAL_PORT", "3000"), Category: "ports"},
        {Key: "admin_internal_port", Value: envOrDefault("ADMIN_INTERNAL_PORT", "3000"), Category: "ports"},
        {Key: "backend_host_port", Value: envOrDefault("BACKEND_HOST_PORT", "3000"), Category: "ports"},
        {Key: "frontend_host_port", Value: envOrDefault("FRONTEND_HOST_PORT", "3001"), Category: "ports"},
        {Key: "admin_host_port", Value: envOrDefault("ADMIN_HOST_PORT", "3002"), Category: "ports"},

        // SSL configuration — defaults to off for local dev
        {Key: "ssl_enabled", Value: envOrDefault("SSL_ENABLED", "false"), Category: "ssl"},
        {Key: "ssl_cert_path", Value: "/etc/nginx/certs/local.pem", Category: "ssl"},
        {Key: "ssl_key_path", Value: "/etc/nginx/certs/local-key.pem", Category: "ssl"},

        // CORS / allowed origins (comma-separated, optional override)
        // If empty, origins are auto-derived from the domain settings above.
        {Key: "cors_extra_origins", Value: "", Category: "security"},

        // Feature flags
        {Key: "registration_open", Value: "true", Category: "features"},
        {Key: "maintenance_mode", Value: "false", Category: "features"},
        {Key: "maintenance_message", Value: "The platform is temporarily under maintenance. Please check back soon.", Category: "features"},
}

// envOrDefault returns the value of the environment variable named by the key,
// or the provided fallback value if the variable is not set or empty.
func envOrDefault(key, fallback string) string {
        if v := os.Getenv(key); v != "" {
                return v
        }
        return fallback
}

// seedSystemSettings inserts default SystemSetting rows if they don't
// already exist. Also updates domain/SSL settings if they still have
// the old hardcoded .local defaults and env vars provide better values.
// Idempotent — safe to call on every startup.
func seedSystemSettings() {
        for _, s := range defaultSettings {
                var existing models.SystemSetting
                result := DB.Where("key = ?", s.Key).First(&existing)
                if result.Error == gorm.ErrRecordNotFound {
                        if err := DB.Create(&s).Error; err != nil {
                                log.Printf("[DB] Warning: Failed to seed setting %s: %v", s.Key, err)
                        }
                }
        }

        // Migrate stale .local defaults: if a domain setting still has a
        // *.local value and the corresponding env var is set to something
        // else (e.g. localhost or a real domain), update it automatically.
        // This handles databases created before the env-based seed was added.
        envMigrations := map[string]string{
                "frontend_domain": os.Getenv("FRONTEND_DOMAIN"),
                "backend_domain":  os.Getenv("BACKEND_DOMAIN"),
                "admin_domain":    os.Getenv("ADMIN_DOMAIN"),
                "main_domain":     os.Getenv("MAIN_DOMAIN"),
        }
        for key, envVal := range envMigrations {
                if envVal == "" {
                        continue
                }
                var existing models.SystemSetting
                if err := DB.Where("key = ?", key).First(&existing).Error; err == nil {
                        // Only migrate if the current value is a .local domain
                        // that differs from the env var
                        if existing.Value != envVal && strings.HasSuffix(existing.Value, ".local") {
                                if err := DB.Model(&existing).Update("value", envVal).Error; err != nil {
                                        log.Printf("[DB] Warning: Failed to migrate setting %s: %v", key, err)
                                } else {
                                        log.Printf("[DB] Migrated setting %s: %s → %s", key, existing.Value, envVal)
                                }
                        }
                }
        }

        // Also migrate ssl_enabled if it's still "true" but env says "false"
        if sslEnv := os.Getenv("SSL_ENABLED"); sslEnv == "false" {
                var existing models.SystemSetting
                if err := DB.Where("key = ? AND value = ?", "ssl_enabled", "true").First(&existing).Error; err == nil {
                        if err := DB.Model(&existing).Update("value", "false").Error; err != nil {
                                log.Printf("[DB] Warning: Failed to migrate ssl_enabled: %v", err)
                        } else {
                                log.Printf("[DB] Migrated setting ssl_enabled: true → false")
                        }
                }
        }

        log.Println("[DB] System settings verified")
}
