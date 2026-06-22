// Package pubsub provides cross-instance event broadcasting via Redis
// Pub/Sub.
//
// Why this exists
// ---------------
// In a single-instance deployment, when a deposit is approved the
// backend can push a notification directly to the user's WebSocket
// (and to all admin SSE subscribers) because all connections live in
// the same process. In a multi-instance deployment behind a load
// balancer, the admin who approves the deposit may hit instance A
// while the user's WebSocket is connected to instance B — instance
// B never sees the event and the user never gets notified.
//
// Redis Pub/Sub fixes this: every instance subscribes to a shared
// set of channels. When instance A processes the deposit, it
// publishes a "user_event" message containing the user ID and the
// event payload. Instance B receives the message and forwards it
// to the user's local WebSocket connection. Same for admin events.
//
// If Redis is unavailable, the package falls back to local-only
// broadcast — meaning single-instance deployments still work.
package pubsub

import (
        "context"
        "encoding/json"
        "log"
        "os"
        "sync"
        "time"

        "github.com/redis/go-redis/v9"
)

// Channels — fixed strings so publishers and subscribers agree.
const (
        ChanUserEvent  = "exchange:user_event"  // payload: { user_id, type, data }
        ChanAdminEvent = "exchange:admin_event" // payload: { type, data }
        ChanMarketTick = "exchange:market_tick" // payload: ticker JSON (for cross-instance market data sharing)
)

// ── Subscription registry ─────────────────────────────────────────

type UserEventHandler func(userID uint, eventType string, data any)
type AdminEventHandler func(eventType string, data any)
type MarketTickHandler func(payload []byte)

var (
        mu               sync.RWMutex
        userHandlers     = []UserEventHandler{}
        adminHandlers    = []AdminEventHandler{}
        marketHandlers   = []MarketTickHandler{}
        client           *redis.Client
        subscribeCtx     context.Context
        subscribeCancel  context.CancelFunc
        subscribeOnce    sync.Once
        subscriberActive bool
)

// Init connects to Redis (if REDIS_URL is set) and starts a background
// subscriber goroutine. Safe to call multiple times — only the first
// call actually subscribes.
func Init() {
        subscribeOnce.Do(func() {
                url := os.Getenv("REDIS_URL")
                if url == "" {
                        log.Println("[PubSub] REDIS_URL not set — running in single-instance mode (local broadcast only)")
                        return
                }
                opt, err := redis.ParseURL(url)
                if err != nil {
                        log.Printf("[PubSub] Failed to parse REDIS_URL: %v — running in local-only mode", err)
                        return
                }
                client = redis.NewClient(opt)
                ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
                defer cancel()
                if err := client.Ping(ctx).Err(); err != nil {
                        log.Printf("[PubSub] Redis ping failed: %v — running in local-only mode", err)
                        client = nil
                        return
                }
                log.Println("[PubSub] Connected — cross-instance event broadcasting enabled")

                subscribeCtx, subscribeCancel = context.WithCancel(context.Background())
                go runSubscriber()
        })
}

// IsEnabled returns true if Redis pub/sub is active.
func IsEnabled() bool {
        mu.RLock()
        defer mu.RUnlock()
        return client != nil && subscriberActive
}

// ── Public subscribe APIs ─────────────────────────────────────────

// OnUserEvent registers a handler for user-targeted events. The handler
// is called for EVERY user event published — the handler itself must
// filter by userID (typically by looking up which user IDs have active
// WebSocket connections on this instance).
func OnUserEvent(h UserEventHandler) {
        mu.Lock()
        defer mu.Unlock()
        userHandlers = append(userHandlers, h)
}

// OnAdminEvent registers a handler for admin-targeted events.
func OnAdminEvent(h AdminEventHandler) {
        mu.Lock()
        defer mu.Unlock()
        adminHandlers = append(adminHandlers, h)
}

// OnMarketTick registers a handler for market ticker broadcasts from
// other instances. Used when only ONE instance connects to Binance
// and shares the data with peers.
func OnMarketTick(h MarketTickHandler) {
        mu.Lock()
        defer mu.Unlock()
        marketHandlers = append(marketHandlers, h)
}

// ── Public publish APIs ───────────────────────────────────────────

type userEventPayload struct {
        UserID uint   `json:"user_id"`
        Type   string `json:"type"`
        Data   any    `json:"data"`
}

type adminEventPayload struct {
        Type string `json:"type"`
        Data any    `json:"data"`
}

// PublishUserEvent broadcasts a user-targeted event to all instances.
// If Redis is unavailable, the event is delivered to local handlers
// only (single-instance fallback).
func PublishUserEvent(userID uint, eventType string, data any) {
        payload := userEventPayload{UserID: userID, Type: eventType, Data: data}

        // Always deliver locally — ensures the originating instance
        // processes the event even if Redis publish fails.
        deliverUserEvent(payload)

        if client == nil {
                return
        }
        raw, err := json.Marshal(payload)
        if err != nil {
                return
        }
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        if err := client.Publish(ctx, ChanUserEvent, raw).Err(); err != nil {
                log.Printf("[PubSub] publish user_event failed: %v", err)
        }
}

// PublishAdminEvent broadcasts an admin event to all instances.
func PublishAdminEvent(eventType string, data any) {
        payload := adminEventPayload{Type: eventType, Data: data}
        deliverAdminEvent(payload)

        if client == nil {
                return
        }
        raw, err := json.Marshal(payload)
        if err != nil {
                return
        }
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        if err := client.Publish(ctx, ChanAdminEvent, raw).Err(); err != nil {
                log.Printf("[PubSub] publish admin_event failed: %v", err)
        }
}

// PublishMarketTick broadcasts a market ticker to all peer instances.
// Used when only one instance maintains the upstream Binance connection.
func PublishMarketTick(payload []byte) {
        if client == nil {
                return
        }
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel()
        if err := client.Publish(ctx, ChanMarketTick, payload).Err(); err != nil {
                // non-fatal — drop silently, the next tick will re-broadcast
                _ = err
        }
}

// ── Subscriber goroutine ──────────────────────────────────────────

func runSubscriber() {
        pubsub := client.Subscribe(subscribeCtx, ChanUserEvent, ChanAdminEvent, ChanMarketTick)
        defer pubsub.Close()

        // Wait for subscription confirmation
        ch := pubsub.Channel()

        mu.Lock()
        subscriberActive = true
        mu.Unlock()
        log.Printf("[PubSub] subscriber active on channels: %s, %s, %s", ChanUserEvent, ChanAdminEvent, ChanMarketTick)

        for {
                select {
                case <-subscribeCtx.Done():
                        mu.Lock()
                        subscriberActive = false
                        mu.Unlock()
                        return
                case msg, ok := <-ch:
                        if !ok {
                                // channel closed — try to resubscribe
                                log.Println("[PubSub] subscriber channel closed — attempting reconnect in 3s")
                                time.Sleep(3 * time.Second)
                                go runSubscriber()
                                return
                        }
                        handleIncoming(msg)
                }
        }
}

func handleIncoming(msg *redis.Message) {
        switch msg.Channel {
        case ChanUserEvent:
                var p userEventPayload
                if err := json.Unmarshal([]byte(msg.Payload), &p); err != nil {
                        return
                }
                deliverUserEvent(p)
        case ChanAdminEvent:
                var p adminEventPayload
                if err := json.Unmarshal([]byte(msg.Payload), &p); err != nil {
                        return
                }
                deliverAdminEvent(p)
        case ChanMarketTick:
                mu.RLock()
                handlers := make([]MarketTickHandler, len(marketHandlers))
                copy(handlers, marketHandlers)
                mu.RUnlock()
                for _, h := range handlers {
                        go func(h MarketTickHandler) {
                                defer func() { _ = recover() }()
                                h([]byte(msg.Payload))
                        }(h)
                }
        }
}

func deliverUserEvent(p userEventPayload) {
        mu.RLock()
        handlers := make([]UserEventHandler, len(userHandlers))
        copy(handlers, userHandlers)
        mu.RUnlock()
        for _, h := range handlers {
                go func(h UserEventHandler) {
                        defer func() { _ = recover() }()
                        h(p.UserID, p.Type, p.Data)
                }(h)
        }
}

func deliverAdminEvent(p adminEventPayload) {
        mu.RLock()
        handlers := make([]AdminEventHandler, len(adminHandlers))
        copy(handlers, adminHandlers)
        mu.RUnlock()
        for _, h := range handlers {
                go func(h AdminEventHandler) {
                        defer func() { _ = recover() }()
                        h(p.Type, p.Data)
                }(h)
        }
}

// Close shuts down the subscriber. Used in tests and graceful shutdown.
func Close() {
        if subscribeCancel != nil {
                subscribeCancel()
        }
        if client != nil {
                _ = client.Close()
        }
}
