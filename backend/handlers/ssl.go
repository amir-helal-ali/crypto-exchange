package handlers

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"
	"crypto-exchange-backend/settings"

	"github.com/gin-gonic/gin"
)

// ─── SSL Certificate Management ───────────────────────────────────────
//
// This file implements one-click SSL certificate generation for both
// local development and production (Let's Encrypt) use cases.
//
// Endpoints:
//   GET  /api/v1/admin/ssl/status     — current cert info (issuer, expiry, SANs)
//   POST /api/v1/admin/ssl/generate   — generate new cert (local or letsencrypt)
//   POST /api/v1/admin/ssl/renew      — renew existing Let's Encrypt cert
//   POST /api/v1/admin/ssl/install    — upload existing PEM cert + key
//
// Architecture:
//   - Backend runs openssl/certbot directly (installed in backend image)
//   - Certs are written to /etc/nginx/certs/ (shared volume with nginx)
//   - ACME challenges go to /var/www/certbot/ (also shared with nginx)
//   - After cert generation, settings are updated + nginx is reloaded
//
// The admin doesn't need to know any paths — everything is auto-detected
// from the current domain settings.

// certsDir returns the directory where SSL certs are stored.
// Defaults to /etc/nginx/certs but can be overridden via SSL_CERTS_DIR env.
func certsDir() string {
	if d := os.Getenv("SSL_CERTS_DIR"); d != "" {
		return d
	}
	return "/etc/nginx/certs"
}

// acmeWebroot returns the directory for Let's Encrypt HTTP-01 challenges.
func acmeWebroot() string {
	if d := os.Getenv("ACME_WEBROOT"); d != "" {
		return d
	}
	return "/var/www/certbot"
}

// ─── Types ────────────────────────────────────────────────────────────

type generateSSLRequest struct {
	Type    string   `json:"type" binding:"required"` // "local" | "letsencrypt"
	Domains []string `json:"domains"`                 // optional — auto-detected from settings if empty
	Email   string   `json:"email"`                   // required for letsencrypt
	Staging bool     `json:"staging"`                 // use Let's Encrypt staging (for testing)
}

type installSSLRequest struct {
	CertPEM string `json:"cert_pem" binding:"required"`
	KeyPEM  string `json:"key_pem" binding:"required"`
	Domains []string `json:"domains"`
}

// ─── GetSSLStatus ────────────────────────────────────────────────────
// Returns information about the currently configured SSL certificate.
// Parses the cert file (if exists) using Go's crypto/x509 — no shell-out.
//
// GET /api/v1/admin/ssl/status
func GetSSLStatus(c *gin.Context) {
	certPath := settings.Get("ssl_cert_path")
	keyPath := settings.Get("ssl_key_path")
	sslEnabled := settings.GetBool("ssl_enabled")
	sslType := settings.GetDefault("ssl_type", "unknown")

	response := gin.H{
		"enabled":      sslEnabled,
		"type":         sslType,
		"issuer":       settings.GetDefault("ssl_issuer", "—"),
		"cert_path":    certPath,
		"key_path":     keyPath,
		"domains":      settings.Get("ssl_domains"),
		"email":        settings.Get("ssl_email"),
		"generated_at": settings.Get("ssl_generated_at"),
		"exists":       false,
	}

	if certPath == "" {
		c.JSON(200, gin.H{"success": true, "data": response})
		return
	}

	// Try to read + parse the cert file
	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		response["error"] = fmt.Sprintf("cert file not readable: %v", err)
		c.JSON(200, gin.H{"success": true, "data": response})
		return
	}

	block, _ := pem.Decode(certBytes)
	if block == nil {
		response["error"] = "cert file is not valid PEM"
		c.JSON(200, gin.H{"success": true, "data": response})
		return
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		response["error"] = fmt.Sprintf("cert parse failed: %v", err)
		c.JSON(200, gin.H{"success": true, "data": response})
		return
	}

	// Calculate days remaining
	daysRemaining := int(time.Until(cert.NotAfter).Hours() / 24)

	// Health check
	health := "healthy"
	if daysRemaining < 0 {
		health = "expired"
	} else if daysRemaining < 7 {
		health = "critical"
	} else if daysRemaining < 30 {
		health = "warning"
	}

	response["exists"] = true
	response["subject"] = cert.Subject.CommonName
	response["issuer"] = cert.Issuer.CommonName
	response["issuer_org"] = strings.Join(cert.Issuer.Organization, ", ")
	response["not_before"] = cert.NotBefore.Format(time.RFC3339)
	response["not_after"] = cert.NotAfter.Format(time.RFC3339)
	response["expires_at"] = cert.NotAfter.Format("2006-01-02")
	response["days_remaining"] = daysRemaining
	response["health"] = health
	response["sans"] = cert.DNSNames
	response["key_algorithm"] = cert.PublicKeyAlgorithm.String()
	response["signature_algorithm"] = cert.SignatureAlgorithm.String()
	response["serial_number"] = cert.SerialNumber.String()

	// Check key file too
	if _, err := os.Stat(keyPath); err != nil {
		response["key_exists"] = false
		response["error"] = "key file not found"
	} else {
		response["key_exists"] = true
	}

	c.JSON(200, gin.H{"success": true, "data": response})
}

// ─── GenerateSSLCertificate ──────────────────────────────────────────
// One-click SSL cert generation. Auto-detects domains from settings.
//
// POST /api/v1/admin/ssl/generate
// Body: {
//   "type": "local" | "letsencrypt",
//   "domains": ["eg-money.local", ...],  // optional, auto-filled from settings
//   "email": "admin@example.com",         // required for letsencrypt
//   "staging": false                      // use LE staging env (for testing)
// }
func GenerateSSLCertificate(c *gin.Context) {
	var req generateSSLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Normalize type
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "local" && req.Type != "letsencrypt" {
		c.JSON(400, gin.H{"error": "type must be 'local' or 'letsencrypt'"})
		return
	}

	// Auto-detect domains from settings if not provided
	if len(req.Domains) == 0 {
		req.Domains = autoDetectDomains()
	}
	if len(req.Domains) == 0 {
		c.JSON(400, gin.H{"error": "No domains configured. Set domains in the Domains tab first."})
		return
	}

	// Sanitize domains (lowercase, trim, dedupe)
	req.Domains = sanitizeDomains(req.Domains)
	if len(req.Domains) == 0 {
		c.JSON(400, gin.H{"error": "No valid domains provided"})
		return
	}

	// Validate email for letsencrypt
	if req.Type == "letsencrypt" && req.Email == "" {
		c.JSON(400, gin.H{"error": "Email is required for Let's Encrypt certificates"})
		return
	}

	// Validate domains for letsencrypt (must be real, public-facing domains)
	if req.Type == "letsencrypt" {
		for _, d := range req.Domains {
			if isLocalDomain(d) {
				c.JSON(400, gin.H{
					"error": fmt.Sprintf("Let's Encrypt cannot issue certs for local domain '%s'. Use 'local' type for development.", d),
				})
				return
			}
		}
	}

	// Ensure certs directory exists
	if err := os.MkdirAll(certsDir(), 0755); err != nil {
		c.JSON(500, gin.H{"error": "Cannot create certs directory", "details": err.Error()})
		return
	}

	// Determine cert file paths. Use a single wildcard-style name based on
	// the primary domain so it's easy to find later.
	primaryDomain := req.Domains[0]
	certPath := filepath.Join(certsDir(), primaryDomain+".pem")
	keyPath := filepath.Join(certsDir(), primaryDomain+"-key.pem")

	// Generate the cert
	var output strings.Builder
	var err error

	switch req.Type {
	case "local":
		output, err = generateLocalCert(req.Domains, certPath, keyPath)
	case "letsencrypt":
		output, err = generateLetsEncryptCert(req.Domains, req.Email, req.Staging, certPath, keyPath)
	}

	if err != nil {
		c.JSON(500, gin.H{
			"error":   "Certificate generation failed",
			"details": err.Error(),
			"output":  output.String(),
		})
		return
	}

	// Update DB settings
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)

	issuer := "Self-Signed (OpenSSL)"
	if req.Type == "letsencrypt" {
		if req.Staging {
			issuer = "Let's Encrypt (Staging)"
		} else {
			issuer = "Let's Encrypt"
		}
	}

	now := time.Now().UTC()
	settings.Set("ssl_cert_path", certPath, "ssl", uid)
	settings.Set("ssl_key_path", keyPath, "ssl", uid)
	settings.Set("ssl_enabled", "true", "ssl", uid)
	settings.Set("ssl_type", req.Type, "ssl", uid)
	settings.Set("ssl_issuer", issuer, "ssl", uid)
	settings.Set("ssl_generated_at", now.Format(time.RFC3339), "ssl", uid)
	settings.Set("ssl_domains", strings.Join(req.Domains, ","), "ssl", uid)
	if req.Email != "" {
		settings.Set("ssl_email", req.Email, "ssl", uid)
	}
	settings.Set("ssl_staging", boolStr(req.Staging), "ssl", uid)

	// Read cert expiry
	if expiry, err := readCertExpiry(certPath); err == nil {
		settings.Set("ssl_expiry", expiry.Format(time.RFC3339), "ssl", uid)
	}

	// Log to audit
	database.DB.Create(&models.AuditLog{
		UserID:    uid,
		Action:    "SSL_CERT_GENERATED",
		Details:   fmt.Sprintf("Generated %s SSL cert for: %s (issuer: %s)", req.Type, strings.Join(req.Domains, ", "), issuer),
		IPAddress: c.ClientIP(),
	})

	// Trigger nginx reload
	triggerNginxReload()

	c.JSON(200, gin.H{
		"success":   true,
		"message":   "SSL certificate generated successfully. Nginx is reloading.",
		"type":      req.Type,
		"issuer":    issuer,
		"domains":   req.Domains,
		"cert_path": certPath,
		"key_path":  keyPath,
		"output":    output.String(),
	})
}

// ─── RenewSSLCertificate ─────────────────────────────────────────────
// Renews an existing Let's Encrypt certificate.
//
// POST /api/v1/admin/ssl/renew
func RenewSSLCertificate(c *gin.Context) {
	sslType := settings.Get("ssl_type")
	if sslType != "letsencrypt" {
		c.JSON(400, gin.H{"error": "Only Let's Encrypt certificates can be renewed. Current type: " + sslType})
		return
	}

	certPath := settings.Get("ssl_cert_path")
	if certPath == "" {
		c.JSON(400, gin.H{"error": "No certificate path configured"})
		return
	}

	domainsStr := settings.Get("ssl_domains")
	if domainsStr == "" {
		c.JSON(400, gin.H{"error": "No domains configured for renewal"})
		return
	}
	domains := strings.Split(domainsStr, ",")

	email := settings.Get("ssl_email")
	staging := settings.GetBool("ssl_staging")

	// Run certbot renew for the specific cert
	var output strings.Builder
	args := []string{"certonly", "--webroot", "-w", acmeWebroot(), "--non-interactive", "--keep-until-expiring"}
	if staging {
		args = append(args, "--staging")
	}
	if email != "" {
		args = append(args, "--email", email)
	}
	args = append(args, "--agree-tos", "--no-eff-email")
	for _, d := range domains {
		args = append(args, "-d", strings.TrimSpace(d))
	}

	cmd := exec.Command("certbot", args...)
	cmd.Stdout = &output
	cmd.Stderr = &output
	if err := cmd.Run(); err != nil {
		c.JSON(500, gin.H{
			"error":   "Renewal failed",
			"details": err.Error(),
			"output":  output.String(),
		})
		return
	}

	// Certbot stores certs in /etc/letsencrypt/live/<primary>/. Copy them
	// to our shared certs directory so nginx picks them up.
	primaryDomain := strings.TrimSpace(domains[0])
	leCertPath := filepath.Join("/etc/letsencrypt/live", primaryDomain, "fullchain.pem")
	leKeyPath := filepath.Join("/etc/letsencrypt/live", primaryDomain, "privkey.pem")

	if err := copyFile(leCertPath, certPath); err != nil {
		c.JSON(500, gin.H{"error": "Failed to copy renewed cert", "details": err.Error()})
		return
	}
	if err := copyFile(leKeyPath, settings.Get("ssl_key_path")); err != nil {
		c.JSON(500, gin.H{"error": "Failed to copy renewed key", "details": err.Error()})
		return
	}

	// Update timestamp + expiry
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	settings.Set("ssl_generated_at", time.Now().UTC().Format(time.RFC3339), "ssl", uid)
	if expiry, err := readCertExpiry(certPath); err == nil {
		settings.Set("ssl_expiry", expiry.Format(time.RFC3339), "ssl", uid)
	}

	// Audit log
	database.DB.Create(&models.AuditLog{
		UserID:    uid,
		Action:    "SSL_CERT_RENEWED",
		Details:   fmt.Sprintf("Renewed Let's Encrypt cert for: %s", domainsStr),
		IPAddress: c.ClientIP(),
	})

	triggerNginxReload()

	c.JSON(200, gin.H{
		"success": true,
		"message": "Certificate renewed successfully. Nginx is reloading.",
		"output":  output.String(),
	})
}

// ─── InstallSSLCertificate ───────────────────────────────────────────
// Allows the admin to paste an existing PEM cert + key (e.g. from
// ZeroSSL, Cloudflare, or a paid CA) instead of generating one.
//
// POST /api/v1/admin/ssl/install
// Body: { "cert_pem": "...", "key_pem": "...", "domains": [...] }
func InstallSSLCertificate(c *gin.Context) {
	var req installSSLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Validate PEM
	certBlock, _ := pem.Decode([]byte(req.CertPEM))
	if certBlock == nil {
		c.JSON(400, gin.H{"error": "cert_pem is not valid PEM"})
		return
	}
	keyBlock, _ := pem.Decode([]byte(req.KeyPEM))
	if keyBlock == nil {
		c.JSON(400, gin.H{"error": "key_pem is not valid PEM"})
		return
	}

	// Determine name
	if len(req.Domains) == 0 {
		req.Domains = autoDetectDomains()
	}
	if len(req.Domains) == 0 {
		req.Domains = []string{"custom"}
	}
	req.Domains = sanitizeDomains(req.Domains)
	primaryDomain := req.Domains[0]

	certPath := filepath.Join(certsDir(), primaryDomain+".pem")
	keyPath := filepath.Join(certsDir(), primaryDomain+"-key.pem")

	// Write files with secure permissions
	if err := os.WriteFile(certPath, []byte(req.CertPEM), 0644); err != nil {
		c.JSON(500, gin.H{"error": "Failed to write cert file", "details": err.Error()})
		return
	}
	if err := os.WriteFile(keyPath, []byte(req.KeyPEM), 0600); err != nil {
		c.JSON(500, gin.H{"error": "Failed to write key file", "details": err.Error()})
		return
	}

	// Update settings
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)

	settings.Set("ssl_cert_path", certPath, "ssl", uid)
	settings.Set("ssl_key_path", keyPath, "ssl", uid)
	settings.Set("ssl_enabled", "true", "ssl", uid)
	settings.Set("ssl_type", "custom", "ssl", uid)
	settings.Set("ssl_issuer", "Custom Upload", "ssl", uid)
	settings.Set("ssl_generated_at", time.Now().UTC().Format(time.RFC3339), "ssl", uid)
	settings.Set("ssl_domains", strings.Join(req.Domains, ","), "ssl", uid)

	if expiry, err := readCertExpiry(certPath); err == nil {
		settings.Set("ssl_expiry", expiry.Format(time.RFC3339), "ssl", uid)
	}

	database.DB.Create(&models.AuditLog{
		UserID:    uid,
		Action:    "SSL_CERT_INSTALLED",
		Details:   fmt.Sprintf("Installed custom SSL cert for: %s", strings.Join(req.Domains, ", ")),
		IPAddress: c.ClientIP(),
	})

	triggerNginxReload()

	c.JSON(200, gin.H{
		"success":   true,
		"message":   "SSL certificate installed successfully. Nginx is reloading.",
		"cert_path": certPath,
		"key_path":  keyPath,
	})
}

// ═══════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════

// generateLocalCert creates a self-signed cert using openssl with proper SANs.
// The cert is valid for 365 days and includes all provided domains as SANs.
//
// Note: Browsers will show a "not trusted" warning for self-signed certs.
// For trusted local certs, the admin should install mkcert in the backend
// container (see Dockerfile comments) — but self-signed is the universal
// fallback that works everywhere.
func generateLocalCert(domains []string, certPath, keyPath string) (strings.Builder, error) {
	var output strings.Builder

	// Build SAN config
	sanEntries := []string{}
	for _, d := range domains {
		sanEntries = append(sanEntries, "DNS:"+d)
	}
	sanList := strings.Join(sanEntries, ",")

	// Write a temp openssl config with SAN extension
	tmpConfig, err := os.CreateTemp("", "openssl-san-*.cnf")
	if err != nil {
		return output, fmt.Errorf("create temp config: %w", err)
	}
	defer os.Remove(tmpConfig.Name())

	configContent := fmt.Sprintf(`[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = %s
O = EgMoney Local Dev

[v3_req]
subjectAltName = %s
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[v3_ext]
subjectAltName = %s
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
`, domains[0], sanList, sanList)

	if _, err := tmpConfig.WriteString(configContent); err != nil {
		tmpConfig.Close()
		return output, fmt.Errorf("write config: %w", err)
	}
	tmpConfig.Close()

	// Generate private key + self-signed cert in one step
	cmd := exec.Command("openssl", "req", "-x509",
		"-newkey", "rsa:2048",
		"-nodes",
		"-keyout", keyPath,
		"-out", certPath,
		"-days", "365",
		"-config", tmpConfig.Name(),
		"-extensions", "v3_ext",
	)
	cmd.Stdout = &output
	cmd.Stderr = &output

	if err := cmd.Run(); err != nil {
		return output, fmt.Errorf("openssl req failed: %w\n%s", err, output.String())
	}

	// Set secure permissions on the key
	if err := os.Chmod(keyPath, 0600); err != nil {
		output.WriteString(fmt.Sprintf("\n[warn] chmod key failed: %v", err))
	}
	if err := os.Chmod(certPath, 0644); err != nil {
		output.WriteString(fmt.Sprintf("\n[warn] chmod cert failed: %v", err))
	}

	output.WriteString(fmt.Sprintf("\n[ok] Generated self-signed cert for %d domain(s)\n", len(domains)))
	output.WriteString(fmt.Sprintf("[ok] Cert: %s\n", certPath))
	output.WriteString(fmt.Sprintf("[ok] Key:  %s\n", keyPath))

	return output, nil
}

// generateLetsEncryptCert uses certbot with the webroot plugin to issue
// a real, browser-trusted certificate via Let's Encrypt.
//
// Prerequisites:
//   - Domains must be real, public, and pointing to this server's IP
//   - Port 80 must be reachable from the internet (for HTTP-01 challenge)
//   - nginx must be running and serving /.well-known/acme-challenge/ from webroot
func generateLetsEncryptCert(domains []string, email string, staging bool, certPath, keyPath string) (strings.Builder, error) {
	var output strings.Builder

	// Ensure webroot exists
	if err := os.MkdirAll(acmeWebroot(), 0755); err != nil {
		return output, fmt.Errorf("create webroot: %w", err)
	}

	// Build certbot command
	args := []string{"certonly",
		"--webroot", "-w", acmeWebroot(),
		"--non-interactive",
		"--agree-tos",
		"--no-eff-email",
		"--email", email,
	}
	if staging {
		args = append(args, "--staging")
	}
	for _, d := range domains {
		args = append(args, "-d", d)
	}

	cmd := exec.Command("certbot", args...)
	cmd.Stdout = &output
	cmd.Stderr = &output

	if err := cmd.Run(); err != nil {
		return output, fmt.Errorf("certbot failed: %w\n%s", err, output.String())
	}

	// Certbot stores certs at /etc/letsencrypt/live/<primary>/
	primaryDomain := domains[0]
	leCertPath := filepath.Join("/etc/letsencrypt/live", primaryDomain, "fullchain.pem")
	leKeyPath := filepath.Join("/etc/letsencrypt/live", primaryDomain, "privkey.pem")

	// Copy to our shared certs directory
	if err := copyFile(leCertPath, certPath); err != nil {
		return output, fmt.Errorf("copy cert: %w", err)
	}
	if err := copyFile(leKeyPath, keyPath); err != nil {
		return output, fmt.Errorf("copy key: %w", err)
	}

	// Secure the key
	if err := os.Chmod(keyPath, 0600); err != nil {
		output.WriteString(fmt.Sprintf("\n[warn] chmod key failed: %v", err))
	}
	if err := os.Chmod(certPath, 0644); err != nil {
		output.WriteString(fmt.Sprintf("\n[warn] chmod cert failed: %v", err))
	}

	output.WriteString(fmt.Sprintf("\n[ok] Let's Encrypt cert issued for %d domain(s)\n", len(domains)))
	output.WriteString(fmt.Sprintf("[ok] Cert: %s\n", certPath))
	output.WriteString(fmt.Sprintf("[ok] Key:  %s\n", keyPath))

	return output, nil
}

// autoDetectDomains returns the list of configured domains from settings,
// deduplicated, with empties removed.
func autoDetectDomains() []string {
	seen := map[string]bool{}
	out := []string{}
	for _, k := range []string{"main_domain", "frontend_domain", "backend_domain", "admin_domain"} {
		v := settings.Get(k)
		if v == "" {
			continue
		}
		if seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

// sanitizeDomains lowercases, trims, and deduplicates a domain list.
func sanitizeDomains(domains []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, d := range domains {
		d = strings.ToLower(strings.TrimSpace(d))
		if d == "" || seen[d] {
			continue
		}
		// Basic validation
		if len(d) < 3 || strings.Contains(d, " ") || strings.Contains(d, "://") {
			continue
		}
		seen[d] = true
		out = append(out, d)
	}
	return out
}

// isLocalDomain returns true if the domain looks like a local/test domain
// (not resolvable from the public internet).
func isLocalDomain(domain string) bool {
	localSuffixes := []string{
		".local", ".localhost", ".test", ".example", ".invalid",
		".localdomain", ".home",
	}
	if domain == "localhost" || strings.HasPrefix(domain, "127.") || strings.HasPrefix(domain, "192.168.") {
		return true
	}
	for _, sfx := range localSuffixes {
		if strings.HasSuffix(domain, sfx) {
			return true
		}
	}
	// IP address regex
	if matched, _ := regexp.MatchString(`^\d+\.\d+\.\d+\.\d+$`, domain); matched {
		return true
	}
	return false
}

// readCertExpiry parses a PEM cert file and returns the NotAfter time.
func readCertExpiry(certPath string) (time.Time, error) {
	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return time.Time{}, err
	}
	block, _ := pem.Decode(certBytes)
	if block == nil {
		return time.Time{}, fmt.Errorf("not valid PEM")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return time.Time{}, err
	}
	return cert.NotAfter, nil
}

// copyFile copies a file from src to dst. Used to move certs from
// certbot's directory to our shared certs directory.
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

// boolStr returns "true" or "false" for a bool.
func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// triggerNginxReload writes to the shared trigger file so the nginx
// sidecar regenerates the config and reloads. Same mechanism as the
// existing /api/v1/admin/nginx/reload endpoint.
func triggerNginxReload() {
	triggerPath := os.Getenv("NGINX_RELOAD_TRIGGER")
	if triggerPath == "" {
		triggerPath = "/shared/nginx/.reload-trigger"
	}
	_ = os.WriteFile(triggerPath, []byte(fmt.Sprintf("%d\n", time.Now().UnixNano())), 0644)
}
