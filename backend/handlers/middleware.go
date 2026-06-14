package handlers

import (
        "fmt"
        "net/http"
        "os"
        "strings"
        "sync"
        "time"

        exchangeredis "crypto-exchange-backend/redis"

        "github.com/gin-gonic/gin"
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

func CORSMiddleware() gin.HandlerFunc {
        // Build allowed origins from environment
        isDev := os.Getenv("GIN_MODE") != "release"

        allowedOrigins := []string{
                "https://eg-money.local",
                "https://admin.eg-money.local",
                "https://api.eg-money.local",
        }

        // In development, also allow localhost variants
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

        // Add custom CORS origin from env (for production deployments)
        if customOrigin := os.Getenv("CORS_ORIGIN"); customOrigin != "" {
                allowedOrigins = append(allowedOrigins, customOrigin)
        }

        return func(c *gin.Context) {
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
                useRedis: exchangeredis.IsAvailable(),
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
                        count, err := exchangeredis.IncrementRateLimit(key, rl.window)
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
                        c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
                        c.Abort()
                        return
                }

                token := authHeader
                if strings.HasPrefix(authHeader, "Bearer ") {
                        token = strings.TrimPrefix(authHeader, "Bearer ")
                }

                claims, err := ValidateJWT(token)
                if err != nil {
                        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
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
