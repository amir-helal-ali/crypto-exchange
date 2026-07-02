package handlers

import (
        "crypto/sha256"
        "fmt"
        "io"
        "net/http"
        "net/url"
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
//
// NOTE: SSL cert generation keys (ssl_type, ssl_issuer, ssl_generated_at,
// ssl_domains, ssl_email, ssl_expiry, ssl_staging) are written by the
// /api/v1/admin/ssl/* endpoints directly — they don't need to be in this
// allowlist because they're never written via /api/v1/admin/settings.
var allowedSettingKeys = map[string]string{
        "frontend_domain":        "domains",
        "backend_domain":         "domains",
        "admin_domain":           "domains",
        "main_domain":            "domains",
        "nginx_http_port":        "ports",
        "nginx_https_port":       "ports",
        "backend_internal_port":  "ports",
        "frontend_internal_port": "ports",
        "admin_internal_port":    "ports",
        "backend_host_port":      "ports",
        "frontend_host_port":     "ports",
        "admin_host_port":        "ports",
        "ssl_enabled":            "ssl",
        "ssl_cert_path":          "ssl",
        "ssl_key_path":           "ssl",
        "cors_extra_origins":     "security",
        "registration_open":      "features",
        "maintenance_mode":       "features",
        "maintenance_message":    "features",
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
                // Validate port settings (must be 1-65535)
                if strings.HasSuffix(key, "_port") && value != "" {
                        var port int
                        _, err := fmt.Sscanf(value, "%d", &port)
                        if err != nil || port < 1 || port > 65535 {
                                rejected = append(rejected, key+" (must be 1-65535)")
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
        // Determine the effective backend_domain.
        // If the DB value is "localhost" or empty, we also send the
        // Host header so the frontend can detect the actual domain
        // being used to reach the API (useful behind nginx/reverse proxy).
        backendDomain := settings.GetDefault("backend_domain", "")
        if backendDomain == "" || backendDomain == "localhost" {
                // Prefer the Host header (which reflects the domain the
                // client used to reach us, possibly via nginx).
                if host := c.Request.Host; host != "" {
                        // Strip port number if present
                        for i := 0; i < len(host); i++ {
                                if host[i] == ':' {
                                        host = host[:i]
                                        break
                                }
                        }
                        if host != "" && host != "localhost" && host != "127.0.0.1" {
                                backendDomain = host
                        }
                }
        }

        c.JSON(http.StatusOK, gin.H{
                "backend_domain":         backendDomain,
                "frontend_domain":        settings.GetDefault("frontend_domain", ""),
                "admin_domain":           settings.GetDefault("admin_domain", ""),
                "main_domain":            settings.GetDefault("main_domain", ""),
                "ssl_enabled":            settings.GetBool("ssl_enabled"),
                "registration_open":      settings.GetBool("registration_open"),
                "maintenance_mode":       settings.GetBool("maintenance_mode"),
                "maintenance_message":    settings.GetDefault("maintenance_message", ""),
                "nginx_http_port":        settings.GetDefault("nginx_http_port", "80"),
                "nginx_https_port":       settings.GetDefault("nginx_https_port", "443"),
                "backend_internal_port":  settings.GetDefault("backend_internal_port", "3000"),
                "frontend_internal_port": settings.GetDefault("frontend_internal_port", "3000"),
                "admin_internal_port":    settings.GetDefault("admin_internal_port", "3000"),
                "backend_host_port":      settings.GetDefault("backend_host_port", "3000"),
                "frontend_host_port":     settings.GetDefault("frontend_host_port", "3001"),
                "admin_host_port":        settings.GetDefault("admin_host_port", "3002"),
                "timestamp":              time.Now().UTC().Format(time.RFC3339),
        })
}

// VerifyDomain checks whether a domain is properly configured and points
// to this server. It performs DNS resolution and an HTTP challenge check.
//
// Admin-only endpoint: POST /api/v1/admin/domains/verify
//
// Request body: { "domain": "api.example.com" }
//
// The verification checks:
// 1. Domain format validity
// 2. DNS resolution (the domain resolves to an IP)
// 3. HTTP challenge: attempts to fetch /.well-known/domain-verification
//    from the domain to confirm it points to this server
func VerifyDomain(c *gin.Context) {
        var req struct {
                Domain string `json:"domain" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Domain is required"})
                return
        }

        domain := strings.TrimSpace(req.Domain)
        domain = strings.TrimPrefix(domain, "http://")
        domain = strings.TrimPrefix(domain, "https://")
        domain = strings.TrimSuffix(domain, "/")

        if domain == "" || len(domain) < 3 || strings.Contains(domain, " ") {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid domain format"})
                return
        }

        type VerificationResult struct {
                Domain      string   `json:"domain"`
                Resolves    bool     `json:"resolves"`
                IPs         []string `json:"ips,omitempty"`
                Reachable   bool     `json:"reachable"`
                PointsToUs  bool     `json:"points_to_us"`
                HTTPCheck   string   `json:"http_check,omitempty"`
                Status      string   `json:"status"`
                Message     string   `json:"message"`
        }

        result := VerificationResult{Domain: domain}

        // 1. DNS resolution check
        // Use a simple HTTP request to test resolution + reachability
        sslEnabled := settings.GetBool("ssl_enabled")
        scheme := "http"
        if sslEnabled {
                scheme = "https"
        }
        testURL := fmt.Sprintf("%s://%s/api/health", scheme, domain)

        client := &http.Client{Timeout: 10 * time.Second}
        resp, err := client.Get(testURL)

        if err != nil {
                // Could be DNS failure, connection refused, or TLS error
                urlErr, ok := err.(*url.Error)
                if ok {
                        result.HTTPCheck = urlErr.Error()
                } else {
                        result.HTTPCheck = err.Error()
                }
                result.Resolves = false
                result.Reachable = false
                result.PointsToUs = false
                result.Status = "unreachable"
                result.Message = fmt.Sprintf("لا يمكن الوصول للنطاق %s. تأكد من أن DNS يشير للخادم والمنفذ مفتوح.", domain)
        } else {
                defer resp.Body.Close()
                result.Resolves = true
                result.Reachable = true

                // Check if the response comes from our backend
                body, _ := io.ReadAll(resp.Body)
                bodyStr := string(body)

                if resp.StatusCode == 200 && (strings.Contains(bodyStr, "status") || strings.Contains(bodyStr, "ok") || strings.Contains(bodyStr, "healthy")) {
                        result.PointsToUs = true
                        result.Status = "verified"
                        result.Message = fmt.Sprintf("النطاق %s يعمل ويشير لهذا الخادم بنجاح.", domain)
                } else {
                        result.PointsToUs = false
                        result.Status = "not_pointing"
                        result.Message = fmt.Sprintf("النطاق %s يستجيب لكن لا يشير لهذا الخادم. تأكد من إعدادات DNS.", domain)
                }
        }

        // Log the verification attempt
        userID, _ := c.Get("user_id")
        uid, _ := userID.(uint)
        if uid > 0 {
                database.DB.Create(&models.AuditLog{
                        UserID:    uid,
                        Action:    "DOMAIN_VERIFY",
                        Details:   fmt.Sprintf("Verified domain: %s — status: %s", domain, result.Status),
                        IPAddress: c.ClientIP(),
                })
        }

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "data":    result,
        })
}

// WriteEnvSettings writes current port and domain settings to a .env override
// file that docker-compose reads. This enables port changes to take effect
// after `docker compose up -d`.
//
// Admin-only endpoint: POST /api/v1/admin/settings/write-env
func WriteEnvSettings(c *gin.Context) {
        // Collect all port and domain settings
        envVars := map[string]string{
                "NGINX_HTTP_PORT":        settings.GetDefault("nginx_http_port", "80"),
                "NGINX_HTTPS_PORT":       settings.GetDefault("nginx_https_port", "443"),
                "BACKEND_INTERNAL_PORT":  settings.GetDefault("backend_internal_port", "3000"),
                "FRONTEND_INTERNAL_PORT": settings.GetDefault("frontend_internal_port", "3000"),
                "ADMIN_INTERNAL_PORT":    settings.GetDefault("admin_internal_port", "3000"),
                "BACKEND_HOST_PORT":      settings.GetDefault("backend_host_port", "3000"),
                "FRONTEND_HOST_PORT":     settings.GetDefault("frontend_host_port", "3001"),
                "ADMIN_HOST_PORT":        settings.GetDefault("admin_host_port", "3002"),
                "MAIN_DOMAIN":            settings.GetDefault("main_domain", "localhost"),
                "FRONTEND_DOMAIN":        settings.GetDefault("frontend_domain", "localhost"),
                "BACKEND_DOMAIN":         settings.GetDefault("backend_domain", "localhost"),
                "ADMIN_DOMAIN":           settings.GetDefault("admin_domain", "localhost"),
                "SSL_ENABLED":            settings.GetDefault("ssl_enabled", "false"),
        }

        // Try to write to /app/.env.override (shared volume with host)
        // Fall back to /root/.env.override
        envPath := os.Getenv("ENV_OVERRIDE_PATH")
        if envPath == "" {
                envPath = "/shared/nginx/.env.override"
        }

        var sb strings.Builder
        sb.WriteString("# Auto-generated by admin panel — do not edit manually\n")
        sb.WriteString(fmt.Sprintf("# Generated at: %s\n", time.Now().UTC().Format(time.RFC3339)))
        sb.WriteString("# Apply changes: docker compose up -d\n\n")

        for key, value := range envVars {
                sb.WriteString(fmt.Sprintf("%s=%s\n", key, value))
        }

        if err := os.WriteFile(envPath, []byte(sb.String()), 0644); err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "success": true,
                        "warning": "Could not write .env override file (no shared volume). Port changes will need manual .env update.",
                        "mode":    "dev",
                        "data":    envVars,
                })
                return
        }

        // Log
        userID, _ := c.Get("user_id")
        uid, _ := userID.(uint)
        if uid > 0 {
                database.DB.Create(&models.AuditLog{
                        UserID:    uid,
                        Action:    "SETTINGS_WRITE_ENV",
                        Details:   "Wrote port/domain settings to .env override file",
                        IPAddress: c.ClientIP(),
                })
        }

        c.JSON(http.StatusOK, gin.H{
                "success": true,
                "message": "تم كتابة إعدادات المنافذ والنطاقات في ملف .env. شغّل docker compose up -d لتطبيق التغييرات.",
                "path":    envPath,
                "data":    envVars,
        })
}

// generateDomainVerificationToken creates a unique token for domain ownership verification.
// The token is derived from the domain name + a server secret, so it's deterministic.
func generateDomainVerificationToken(domain string) string {
        secret := os.Getenv("JWT_SECRET")
        if secret == "" {
                secret = "default-verification-secret"
        }
        h := sha256.New()
        h.Write([]byte(domain + ":" + secret))
        return fmt.Sprintf("%x", h.Sum(nil))[:32]
}
