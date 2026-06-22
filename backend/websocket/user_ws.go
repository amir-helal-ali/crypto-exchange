package websocket

import (
        "encoding/json"
        "log"
        "net/http"
        "sync"
        "time"

        "crypto-exchange-backend/jwtutil"
        "crypto-exchange-backend/pubsub"

        "github.com/gin-gonic/gin"
        gorillaws "github.com/gorilla/websocket"
)

const maxConnectionsPerUser = 5

// UserEvent represents a real-time event sent to a specific user.
type UserEvent struct {
        Type string      `json:"type"` // "order_fill", "order_trigger", "deposit_approved", "withdrawal_processed", "kyc_approved", "kyc_rejected"
        Data interface{} `json:"data"`
}

// UserClient represents a single WebSocket connection for a user.
type UserClient struct {
        UserID   uint
        Conn     *gorillaws.Conn
        Send     chan []byte
        Hub      *UserHub
}

// UserHub manages all user WebSocket connections.
type UserHub struct {
        clients    map[uint][]*UserClient // userID -> list of clients
        register   chan *UserClient
        unregister chan *UserClient
        mu         sync.RWMutex
}

var GlobalUserHub = &UserHub{
        clients:    make(map[uint][]*UserClient),
        register:   make(chan *UserClient),
        unregister: make(chan *UserClient),
}

func init() {
        go GlobalUserHub.run()
        // Subscribe to cross-instance user events from Redis Pub/Sub.
        // When instance A approves a deposit for user 42 (whose WebSocket
        // is on instance B), instance A publishes a user_event; this
        // subscriber on instance B receives it and delivers it to the
        // user's local WebSocket connection. Falls back gracefully to
        // local-only delivery when Redis is unavailable.
        pubsub.Init()
        pubsub.OnUserEvent(func(userID uint, eventType string, data any) {
                // Cross-instance delivery — only deliver locally, do NOT
                // re-publish (would cause infinite loop).
                deliverLocalUserEvent(userID, eventType, data)
        })
}

// NotifyUser is the public entry point for sending a real-time event
// to a user. It publishes to Redis Pub/Sub (so other instances can
// deliver to the user if their WebSocket is connected there) AND
// delivers locally in case the user is connected to this instance.
//
// If Redis is unavailable, only local delivery happens (single-instance
// mode still works).
func NotifyUser(userID uint, eventType string, data interface{}) {
        // Deliver locally first so latency-sensitive in-process callers
        // get immediate notification even if Redis is slow.
        deliverLocalUserEvent(userID, eventType, data)
        // Then broadcast to peer instances.
        pubsub.PublishUserEvent(userID, eventType, data)
}

// deliverLocalUserEvent sends an event to all local WebSocket
// connections of the given user. Called from NotifyUser (for local
// events) and from the PubSub subscriber (for remote events).
func deliverLocalUserEvent(userID uint, eventType string, data interface{}) {
        event := UserEvent{
                Type: eventType,
                Data: data,
        }
        payload, err := json.Marshal(event)
        if err != nil {
                log.Printf("[UserWS] Failed to marshal event for user %d: %v", userID, err)
                return
        }

        GlobalUserHub.mu.RLock()
        clients := GlobalUserHub.clients[userID]
        GlobalUserHub.mu.RUnlock()

        for _, client := range clients {
                select {
                case client.Send <- payload:
                default:
                        // Buffer full, skip this client
                        log.Printf("[UserWS] Client buffer full for user %d, skipping", userID)
                }
        }
}

func (h *UserHub) run() {
        for {
                select {
                case client := <-h.register:
                        h.mu.Lock()
                        h.clients[client.UserID] = append(h.clients[client.UserID], client)
                        h.mu.Unlock()
                        log.Printf("[UserWS] User %d connected (%d connections)", client.UserID, len(h.clients[client.UserID]))

                case client := <-h.unregister:
                        h.mu.Lock()
                        if clients, ok := h.clients[client.UserID]; ok {
                                for i, c := range clients {
                                        if c == client {
                                                h.clients[client.UserID] = append(clients[:i], clients[i+1:]...)
                                                break
                                        }
                                }
                                if len(h.clients[client.UserID]) == 0 {
                                        delete(h.clients, client.UserID)
                                }
                        }
                        h.mu.Unlock()
                        close(client.Send)
                        log.Printf("[UserWS] User %d disconnected", client.UserID)
                }
        }
}

// NotifyUser sends a real-time event to all connections of a specific user.
// (Deprecated direct-implementation — kept for backward compatibility.
// The actual logic now lives in the NotifyUser wrapper above which also
// publishes to Redis Pub/Sub for multi-instance delivery.)
//
// To avoid duplicate code, this function is removed. Use the top-level
// NotifyUser defined above which handles both local delivery and cross-
// instance broadcast.

// HandleUserWebSocket handles WebSocket connections for authenticated users.
// The user must pass a valid JWT token as a query parameter.
func HandleUserWebSocket(c *gin.Context) {
        tokenStr := c.Query("token")
        if tokenStr == "" {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
                return
        }

        // Validate JWT
        claims, err := jwtutil.Validate(tokenStr)
        if err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                return
        }

        // Check max connections per user
        GlobalUserHub.mu.RLock()
        currentConns := len(GlobalUserHub.clients[claims.UserID])
        GlobalUserHub.mu.RUnlock()
        if currentConns >= maxConnectionsPerUser {
                c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many WebSocket connections. Close existing connections and try again."})
                return
        }

        // Upgrade to WebSocket
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                log.Printf("[UserWS] Upgrade failed: %v", err)
                return
        }

        client := &UserClient{
                UserID: claims.UserID,
                Conn:   conn,
                Send:   make(chan []byte, 256),
                Hub:    GlobalUserHub,
        }

        GlobalUserHub.register <- client

        go client.writePump()
        go client.readPump()
}

func (c *UserClient) readPump() {
        defer func() {
                c.Hub.unregister <- c
                c.Conn.Close()
        }()

        c.Conn.SetReadLimit(512)
        c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        c.Conn.SetPongHandler(func(string) error {
                c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
                return nil
        })

        for {
                _, _, err := c.Conn.ReadMessage()
                if err != nil {
                        break
                }
        }
}

func (c *UserClient) writePump() {
        ticker := time.NewTicker(30 * time.Second)
        defer func() {
                ticker.Stop()
                c.Conn.Close()
        }()

        for {
                select {
                case message, ok := <-c.Send:
                        c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if !ok {
                                c.Conn.WriteMessage(gorillaws.CloseMessage, []byte{})
                                return
                        }

                        w, err := c.Conn.NextWriter(gorillaws.TextMessage)
                        if err != nil {
                                return
                        }
                        w.Write(message)

                        // Batch queued messages
                        n := len(c.Send)
                        for i := 0; i < n; i++ {
                                w.Write([]byte{'\n'})
                                w.Write(<-c.Send)
                        }

                        if err := w.Close(); err != nil {
                                return
                        }

                case <-ticker.C:
                        c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if err := c.Conn.WriteMessage(gorillaws.PingMessage, nil); err != nil {
                                return
                        }
                }
        }
}

// --- Helper functions to send specific events ---

// NotifyUserOrderFilled sends a real-time notification when an order is filled.
func NotifyUserOrderFilled(userID uint, symbol string, side string, orderType string, quantity float64, fillPrice float64, orderID uint, fee float64, feeCurrency string) {
        data := map[string]interface{}{
                "order_id":     orderID,
                "symbol":       symbol,
                "side":         side,
                "type":         orderType,
                "quantity":     quantity,
                "fill_price":   fillPrice,
                "fee":          fee,
                "fee_currency": feeCurrency,
        }
        NotifyUser(userID, "order_fill", data)
}

// NotifyUserOrderTriggered sends a real-time notification when a conditional order is triggered.
func NotifyUserOrderTriggered(userID uint, symbol string, side string, orderType string, triggerPrice float64, orderID uint) {
        data := map[string]interface{}{
                "order_id":      orderID,
                "symbol":        symbol,
                "side":          side,
                "type":          orderType,
                "trigger_price": triggerPrice,
        }
        NotifyUser(userID, "order_trigger", data)
}

// NotifyUserDepositApproved sends a real-time notification when a deposit is approved.
func NotifyUserDepositApproved(userID uint, currency string, amount float64) {
        data := map[string]interface{}{
                "currency": currency,
                "amount":   amount,
        }
        NotifyUser(userID, "deposit_approved", data)
}

// NotifyUserWithdrawalProcessed sends a real-time notification when a withdrawal is processed.
func NotifyUserWithdrawalProcessed(userID uint, currency string, amount float64, approved bool) {
        data := map[string]interface{}{
                "currency": currency,
                "amount":   amount,
                "approved": approved,
        }
        eventType := "withdrawal_approved"
        if !approved {
                eventType = "withdrawal_rejected"
        }
        NotifyUser(userID, eventType, data)
}

// NotifyUserKYCUpdate sends a real-time notification when KYC status changes.
func NotifyUserKYCUpdate(userID uint, status string, reason string) {
        data := map[string]interface{}{
                "status": status,
        }
        if reason != "" {
                data["rejection_reason"] = reason
        }
        NotifyUser(userID, "kyc_"+status, data)
}

// GetOnlineUserCount returns the number of users currently connected via WebSocket.
func GetOnlineUserCount() int {
        GlobalUserHub.mu.RLock()
        defer GlobalUserHub.mu.RUnlock()
        return len(GlobalUserHub.clients)
}
