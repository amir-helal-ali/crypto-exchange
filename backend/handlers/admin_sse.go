package handlers

import (
        "encoding/json"
        "fmt"
        "io"
        "net/http"
        "sync"
        "time"

        "crypto-exchange-backend/database"
        "crypto-exchange-backend/models"
        "crypto-exchange-backend/pubsub"
        "crypto-exchange-backend/websocket"

        "github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────────────────
// Admin SSE (Server-Sent Events) stream
//
// Single long-lived HTTP connection per admin tab. The server pushes
// discrete event types ("stats", "online_users", "ticker", ...) as they
// happen — no client-side polling required.
//
//   GET /api/v1/admin/stream?token=<JWT>&types=stats,online,kyc,tx,users
//
// Event format (text/event-stream):
//
//   event: stats
//   data: {"total_users":12,"total_orders":5,...}
//
//   event: online
//   data: {"online_users":3}
// ──────────────────────────────────────────────────────────────────────────

type adminSubscriber struct {
        ch     chan sseEvent
        types  map[string]bool
        closed bool
        mu     sync.Mutex
}

type sseEvent struct {
        eventType string
        payload   any
}

var (
        adminSubsMu sync.RWMutex
        adminSubs   = make(map[*adminSubscriber]bool)

        // adminSSEConns tracks the number of active SSE connections for
        // observability and to enforce a hard cap (defence-in-depth against
        // connection-amplification DoS, even though auth is required).
        adminSSEMx   sync.Mutex
        adminSSECount int
        maxAdminSSEConns = 200 // per backend instance
)

// broadcastAdminEvent pushes an event to every subscribed admin client
// interested in its type. Called from anywhere in the backend.
func broadcastAdminEvent(eventType string, payload any) {
        adminSubsMu.RLock()
        subs := make([]*adminSubscriber, 0, len(adminSubs))
        for s := range adminSubs {
                subs = append(subs, s)
        }
        adminSubsMu.RUnlock()

        if len(subs) == 0 {
                return
        }
        evt := sseEvent{eventType: eventType, payload: payload}
        for _, s := range subs {
                if s.types[eventType] || s.types["*"] {
                        s.mu.Lock()
                        if !s.closed {
                                select {
                                case s.ch <- evt:
                                default:
                                        // drop on slow consumer — admin will get the next one
                                }
                        }
                        s.mu.Unlock()
                }
        }
}

// NotifyAdminNewTransaction — call when a new deposit/withdrawal is created.
// Publishes via Redis Pub/Sub so admin clients connected to OTHER
// backend instances also receive the event (multi-instance support).
func NotifyAdminNewTransaction(tx *models.Transaction) {
        payload := gin.H{
                "id":         tx.ID,
                "user_id":    tx.UserID,
                "currency":   tx.Currency,
                "amount":     tx.Amount,
                "type":       tx.Type,
                "status":     tx.Status,
                "created_at": tx.CreatedAt,
        }
        // Local broadcast + remote publish (handled atomically by PublishAdminEvent)
        pubsub.PublishAdminEvent("tx", payload)
}

// NotifyAdminNewUser — call when a new user registers.
func NotifyAdminNewUser(u *models.User) {
        payload := gin.H{
                "id":         u.ID,
                "username":   u.Username,
                "email":      u.Email,
                "created_at": u.CreatedAt,
        }
        pubsub.PublishAdminEvent("users", payload)
}

// NotifyAdminKYCSubmission — call when a user submits KYC documents.
func NotifyAdminKYCSubmission(kyc *models.KYCRequest) {
        payload := gin.H{
                "id":         kyc.ID,
                "user_id":    kyc.UserID,
                "status":     kyc.Status,
                "updated_at": kyc.UpdatedAt,
        }
        pubsub.PublishAdminEvent("kyc", payload)
}

// init wires the PubSub subscriber to forward remote admin events
// to local SSE subscribers. This runs once at package load — but
// because Go guarantees init order within a binary and idempotency
// is enforced inside pubsub.Init(), we don't need a sync.Once here.
func init() {
        pubsub.Init()
        pubsub.OnAdminEvent(func(eventType string, data any) {
                // Forward to local SSE subscribers
                broadcastAdminEvent(eventType, data)
        })
}

// HandleAdminSSE — the SSE endpoint itself.
func HandleAdminSSE(c *gin.Context) {
        // SSE requires auth — but middleware order matters. This handler is
        // mounted outside the admin-protected group, so we manually validate
        // the JWT here (read from query string for EventSource compatibility).
        tokenStr := c.Query("token")
        if tokenStr == "" {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
                return
        }
        claims, err := ValidateJWT(tokenStr)
        if err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                return
        }
        if claims.Role != "ADMIN" && claims.Role != "admin" {
                c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
                return
        }

        // Per-instance connection cap — protects against accidental
        // connection leaks (e.g. browser tabs left open across days)
        // and deliberate amplification attacks from a single admin token.
        adminSSEMx.Lock()
        if adminSSECount >= maxAdminSSEConns {
                adminSSEMx.Unlock()
                c.JSON(http.StatusTooManyRequests, gin.H{
                        "error":  "too_many_sse_connections",
                        "hint":   "Close unused admin tabs or increase the cap in handlers/admin_sse.go",
                        "active": adminSSECount,
                        "limit":  maxAdminSSEConns,
                })
                return
        }
        adminSSECount++
        adminSSEMx.Unlock()
        defer func() {
                adminSSEMx.Lock()
                adminSSECount--
                adminSSEMx.Unlock()
        }()

        types := map[string]bool{"*": true}
        if t := c.Query("types"); t != "" {
                types = map[string]bool{}
                for _, raw := range splitCommas(t) {
                        types[raw] = true
                }
                // Always include stats for the dashboard header
                types["stats"] = true
        }

        sub := &adminSubscriber{
                ch:    make(chan sseEvent, 64),
                types: types,
        }
        adminSubsMu.Lock()
        adminSubs[sub] = true
        adminSubsMu.Unlock()
        defer func() {
                adminSubsMu.Lock()
                delete(adminSubs, sub)
                adminSubsMu.Unlock()
                sub.mu.Lock()
                sub.closed = true
                close(sub.ch)
                sub.mu.Unlock()
        }()

        // SSE headers
        c.Writer.Header().Set("Content-Type", "text/event-stream")
        c.Writer.Header().Set("Cache-Control", "no-cache")
        c.Writer.Header().Set("Connection", "keep-alive")
        c.Writer.Header().Set("X-Accel-Buffering", "no")
        c.Writer.WriteHeader(http.StatusOK)
        flusher, ok := c.Writer.(http.Flusher)
        if !ok {
                // Should never happen with Gin's ResponseWriter
                return
        }

        // Send an immediate hello + stats snapshot so the client can render
        // something on connect without waiting for the next broadcast.
        writeSSE(c.Writer, "hello", gin.H{"ts": time.Now().UnixMilli()})
        if stats, err := buildAdminStatsSnapshot(); err == nil {
                writeSSE(c.Writer, "stats", stats)
        }
        writeSSE(c.Writer, "online", gin.H{"online_users": websocket.GetOnlineUserCount()})
        flusher.Flush()

        // Heartbeat ticker — keeps the connection alive through proxies and
        // also acts as a periodic stats refresh (every 10s) so the admin
        // dashboard numbers don't drift even without explicit events.
        heartbeat := time.NewTicker(10 * time.Second)
        defer heartbeat.Stop()

        clientGone := c.Request.Context().Done()

        for {
                select {
                case <-clientGone:
                        return
                case evt, ok := <-sub.ch:
                        if !ok {
                                return
                        }
                        if err := writeSSE(c.Writer, evt.eventType, evt.payload); err != nil {
                                return
                        }
                        flusher.Flush()
                case <-heartbeat.C:
                        // Every heartbeat also pushes a fresh stats + online snapshot.
                        if stats, err := buildAdminStatsSnapshot(); err == nil {
                                if sub.types["stats"] || sub.types["*"] {
                                        writeSSE(c.Writer, "stats", stats)
                                }
                        }
                        if sub.types["online"] || sub.types["*"] {
                                writeSSE(c.Writer, "online", gin.H{"online_users": websocket.GetOnlineUserCount()})
                        }
                        // Light ping comment to keep the stream warm
                        fmt.Fprintf(c.Writer, ": ping %d\n\n", time.Now().Unix())
                        flusher.Flush()
                }
        }
}

func writeSSE(w io.Writer, event string, payload any) error {
        data, err := json.Marshal(payload)
        if err != nil {
                return err
        }
        if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(data)); err != nil {
                return err
        }
        return nil
}

func splitCommas(s string) []string {
        out := []string{}
        cur := ""
        for _, r := range s {
                if r == ',' {
                        if cur != "" {
                                out = append(out, cur)
                        }
                        cur = ""
                        continue
                }
                cur += string(r)
        }
        if cur != "" {
                out = append(out, cur)
        }
        return out
}

// buildAdminStatsSnapshot — same shape as GetAdminStats, but callable inline.
func buildAdminStatsSnapshot() (gin.H, error) {
        var totalUsers, totalOrders, totalTx int64
        var pendingDep, pendingWd, pendingKYC int64

        if err := database.DB.Model(&models.User{}).Count(&totalUsers).Error; err != nil {
                return nil, err
        }
        if err := database.DB.Model(&models.Order{}).Count(&totalOrders).Error; err != nil {
                return nil, err
        }
        if err := database.DB.Model(&models.Transaction{}).Count(&totalTx).Error; err != nil {
                return nil, err
        }
        if err := database.DB.Model(&models.Transaction{}).
                Where("type = ? AND status = ?", "DEPOSIT", "PENDING").
                Count(&pendingDep).Error; err != nil {
                return nil, err
        }
        if err := database.DB.Model(&models.Transaction{}).
                Where("type = ? AND status = ?", "WITHDRAWAL", "PENDING").
                Count(&pendingWd).Error; err != nil {
                return nil, err
        }
        if err := database.DB.Model(&models.KYCRequest{}).
                Where("status = ?", "PENDING").
                Count(&pendingKYC).Error; err != nil {
                return nil, err
        }

        return gin.H{
                "totalUsers":         totalUsers,
                "totalOrders":        totalOrders,
                "totalTransactions":  totalTx,
                "pendingDeposits":    pendingDep,
                "pendingWithdrawals": pendingWd,
                "pendingKYC":         pendingKYC,
                "onlineUsers":        websocket.GetOnlineUserCount(),
                "ts":                 time.Now().UnixMilli(),
        }, nil
}
