package handlers

import (
        "errors"
        "fmt"
        "net/http"
        "os"
        "strings"
        "sync"
        "time"

        "crypto-exchange-backend/redis"
        "crypto-exchange-backend/settings"

        "github.com/gin-gonic/gin"
        "github.com/golang-jwt/jwt/v5"
)

type RateLimiter struct {
        visitors map[string]*visitor
        mu       sync.RWMutex
        rate     int
        window   time.Duration
        useRedis bool
}

type visitor struct {
        count    int
        lastSeen time.Time
}

// CORSMiddleware returns a CORS middleware that dynamically reads allowed
// origins from the system settings table. This allows admins to add new
// domains via the /api/v1/admin/settings endpoint without restarting the
// backend.
func CORSMiddleware() gin.HandlerFunc {
        // In development mode (GIN_MODE != release), always allow localhost
        // variants for direct port access (bypassing nginx).
        isDev := os.Getenv("GIN_MODE") != "release"

        return func(c *gin.Context) {
                // Build allowed origins list on every request — settings may have
                // been updated since the last request. The settings cache is
                // in-memory so this is cheap.
                allowedOrigins := settings.AllowedOrigins()

                // Add CORS_ORIGIN env var (kept for backward compatibility)
                if customOrigin := os.Getenv("CORS_ORIGIN"); customOrigin != "" {
                        allowedOrigins = append(allowedOrigins, customOrigin)
                }

                // Add extra origins from settings (comma-separated)
                if extra := settings.Get("cors_extra_origins"); extra != "" {
                        for _, o := range strings.Split(extra, ",") {
                                o = strings.TrimSpace(o)
                                if o != "" {
                                        allowedOrigins = append(allowedOrigins, o)
                                }
                        }
                }

                // In dev mode, also allow localhost variants
                if isDev {
                        allowedOrigins = append(allowedOrigins,
                                "http://localhost:3000",
                                "http://localhost:3001",
                                "http://localhost:3002",
                                "http://127.0.0.1:3000",
                                "http://127.0.0.1:3001",
                                "http://127.0.0.1:3002",
                        )
                }

                origin := c.GetHeader("Origin")
                isAllowed := false
                for _, o := range allowedOrigins {
                        if origin == o {
                                isAllowed = true
                                break
                        }
                }

                if isAllowed && origin != "" {
                        c.Header("Access-Control-Allow-Origin", origin)
                        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                        c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                        c.Header("Access-Control-Allow-Credentials", "true")
                        c.Header("Access-Control-Max-Age", "86400")
                }
                if c.Request.Method == "OPTIONS" {
                        c.AbortWithStatus(204)
                        return
                }
                c.Next()
        }
}

func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
        rl := &RateLimiter{
                visitors: make(map[string]*visitor),
                rate:     rate,
                window:   window,
                useRedis: redis.IsAvailable(),
        }
        if !rl.useRedis {
                go rl.cleanup()
        }
        return rl
}

func (rl *RateLimiter) cleanup() {
        for {
                time.Sleep(time.Minute)
                rl.mu.Lock()
                for ip, v := range rl.visitors {
                        if time.Since(v.lastSeen) > rl.window {
                                delete(rl.visitors, ip)
                        }
                }
                rl.mu.Unlock()
        }
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                ip := c.ClientIP()

                // Try Redis-based rate limiting first
                if rl.useRedis {
                        key := fmt.Sprintf("rate_limit:%s", ip)
                        count, err := redis.IncrementRateLimit(key, rl.window)
                        if err == nil {
                                if count > rl.rate {
                                        c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded. Try again later."})
                                        c.Abort()
                                        return
                                }
                                c.Next()
                                return
                        }
                        // Fall through to in-memory on Redis error
                }

                // In-memory rate limiting (fallback)
                rl.mu.Lock()
                v, exists := rl.visitors[ip]
                if !exists {
                        rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
                        rl.mu.Unlock()
                        c.Next()
                        return
                }
                if time.Since(v.lastSeen) > rl.window {
                        v.count = 1
                        v.lastSeen = time.Now()
                        rl.mu.Unlock()
                        c.Next()
                        return
                }
                v.count++
                v.lastSeen = time.Now()
                if v.count > rl.rate {
                        rl.mu.Unlock()
                        c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded. Try again later."})
                        c.Abort()
                        return
                }
                rl.mu.Unlock()
                c.Next()
        }
}

func AuthMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                authHeader := c.GetHeader("Authorization")
                if authHeader == "" {
                        c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required", "code": "AUTH_REQUIRED"})
                        c.Abort()
                        return
                }

                token := authHeader
                if strings.HasPrefix(authHeader, "Bearer ") {
                        token = strings.TrimPrefix(authHeader, "Bearer ")
                }

                claims, err := ValidateJWT(token)
                if err != nil {
                        // Distinguish between expired and invalid tokens
                        if errors.Is(err, jwt.ErrTokenExpired) {
                                c.JSON(http.StatusUnauthorized, gin.H{
                                        "error": "Token expired",
                                        "code":  "TOKEN_EXPIRED",
                                })
                        } else {
                                c.JSON(http.StatusUnauthorized, gin.H{
                                        "error": "Invalid token",
                                        "code":  "INVALID_TOKEN",
                                })
                        }
                        c.Abort()
                        return
                }

                c.Set("user_id", claims.UserID)
                c.Set("role", claims.Role)
                c.Next()
        }
}

func AdminMiddleware() gin.HandlerFunc {
        return func(c *gin.Context) {
                role, exists := c.Get("role")
                if !exists || role != "ADMIN" {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
                        c.Abort()
                        return
                }
                c.Next()
        }
}
