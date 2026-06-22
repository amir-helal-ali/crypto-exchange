package handlers

import (
        "net/http"
        "runtime"
        "time"

        "crypto-exchange-backend/pubsub"
        "crypto-exchange-backend/websocket"

        "github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────────────────
// /api/v1/admin/metrics — observability endpoint for production monitoring.
//
// Returns real-time stats about the backend's live-data infrastructure:
//   - WebSocket connection counts (market + user)
//   - SSE connection count (admin)
//   - Binance upstream stream status
//   - Redis Pub/Sub status
//   - Per-symbol ticker freshness (ms since last update)
//   - Go runtime stats (goroutines, memory, GC)
//
// This endpoint is intended for Prometheus-style scraping (polling by a
// monitoring agent IS appropriate here — metrics are NOT user-facing data,
// and Prometheus's pull model is the standard observability pattern).
// The endpoint is admin-only so we don't leak internal stats publicly.
// ──────────────────────────────────────────────────────────────────────────

// MetricsResponse is the JSON shape returned by /api/v1/admin/metrics.
type MetricsResponse struct {
        Timestamp int64                  `json:"ts"`
        WebSocket webSocketMetrics       `json:"websocket"`
        SSE       sseMetrics             `json:"sse"`
        Upstream  upstreamMetrics        `json:"upstream"`
        Runtime   runtimeMetrics         `json:"runtime"`
        Tickers   []tickerFreshnessMetric `json:"tickers"`
}

type webSocketMetrics struct {
        MarketClients int `json:"market_clients"`
        UserClients   int `json:"user_clients"`
        OnlineUsers   int `json:"online_users"`
}

type sseMetrics struct {
        AdminSubscribers int `json:"admin_subscribers"`
        ActiveConns      int `json:"active_conns"`
        MaxConns         int `json:"max_conns"`
}

type upstreamMetrics struct {
        BinanceConnected    bool   `json:"binance_connected"`
        BinanceSymbols      int    `json:"binance_symbols"`
        BinanceIntervals    int    `json:"binance_intervals"`
        BinanceSubStreams   int    `json:"binance_sub_streams"`
        RedisPubSubEnabled  bool   `json:"redis_pubsub_enabled"`
}

type runtimeMetrics struct {
        Goroutines    int    `json:"goroutines"`
        HeapAllocMB   int    `json:"heap_alloc_mb"`
        HeapInUseMB   int    `json:"heap_in_use_mb"`
        NumGC         uint32 `json:"num_gc"`
        GCPauseMs     uint64 `json:"gc_pause_ms_total"`
        GoVersion     string `json:"go_version"`
        NumCPU        int    `json:"num_cpu"`
}

type tickerFreshnessMetric struct {
        Symbol     string `json:"symbol"`
        Price      float64 `json:"price"`
        AgeMs      int64  `json:"age_ms"`
        Stale      bool   `json:"stale"`
}

// GetMetrics returns live infrastructure metrics for monitoring.
// Admin-only — registered under /api/v1/admin/metrics.
func GetMetrics(c *gin.Context) {
        now := time.Now().UnixMilli()

        // WebSocket counts
        wsClients := websocket.GetMarketClientCount()
        userClients := websocket.GetUserClientCount()
        onlineUsers := websocket.GetOnlineUserCount()

        // SSE counts
        adminSubsMu.RLock()
        sseSubs := len(adminSubs)
        adminSubsMu.RUnlock()
        adminSSEMx.Lock()
        sseActive := adminSSECount
        adminSSEMx.Unlock()

        // Upstream status
        binanceConnected := websocket.IsBinanceConnected()
        binanceSymbols := websocket.GetSupportedSymbolCount()
        binanceIntervals := websocket.GetSupportedIntervalCount()
        binanceSubStreams := binanceSymbols * (2 + binanceIntervals + 1) // miniTicker + trade + klines + depth
        pubsubEnabled := pubsub.IsEnabled()

        // Runtime stats
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        gcPauseNs := uint64(0)
        for _, p := range m.PauseNs {
                gcPauseNs += p
        }
        gcPauseMs := gcPauseNs / 1e6

        // Per-symbol ticker freshness
        tickers := websocket.GlobalMarketHub.GetAllTickers()
        tickerMetrics := make([]tickerFreshnessMetric, 0, len(tickers))
        for _, t := range tickers {
                age := now - t.UpdatedAt
                tickerMetrics = append(tickerMetrics, tickerFreshnessMetric{
                        Symbol: t.Symbol,
                        Price:  t.Price,
                        AgeMs:  age,
                        Stale:  age > 15000, // stale if no update in 15s
                })
        }

        resp := MetricsResponse{
                Timestamp: now,
                WebSocket: webSocketMetrics{
                        MarketClients: wsClients,
                        UserClients:   userClients,
                        OnlineUsers:   onlineUsers,
                },
                SSE: sseMetrics{
                        AdminSubscribers: sseSubs,
                        ActiveConns:      sseActive,
                        MaxConns:         maxAdminSSEConns,
                },
                Upstream: upstreamMetrics{
                        BinanceConnected:   binanceConnected,
                        BinanceSymbols:     binanceSymbols,
                        BinanceIntervals:   binanceIntervals,
                        BinanceSubStreams:  binanceSubStreams,
                        RedisPubSubEnabled: pubsubEnabled,
                },
                Runtime: runtimeMetrics{
                        Goroutines:  runtime.NumGoroutine(),
                        HeapAllocMB: int(m.HeapAlloc / 1024 / 1024),
                        HeapInUseMB: int(m.HeapInuse / 1024 / 1024),
                        NumGC:       m.NumGC,
                        GCPauseMs:   gcPauseMs,
                        GoVersion:   runtime.Version(),
                        NumCPU:      runtime.NumCPU(),
                },
                Tickers: tickerMetrics,
        }

        c.JSON(http.StatusOK, resp)
}
