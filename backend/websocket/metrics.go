package websocket

import (
	"strings"
)

// ──────────────────────────────────────────────────────────────────────────
// Observability helpers for the MarketHub.
//
// These functions are read-only and safe to call from any goroutine.
// They exist primarily so the /api/v1/admin/metrics endpoint can
// report live infrastructure stats without exposing internal types.
// ──────────────────────────────────────────────────────────────────────────

// GetMarketClientCount returns the number of clients currently
// connected to /ws/market, /ws/kline, /ws/trades, or /ws/orderbook.
// Each open socket counts as one client.
func GetMarketClientCount() int {
	GlobalMarketHub.mu.RLock()
	defer GlobalMarketHub.mu.RUnlock()
	return len(GlobalMarketHub.clients)
}

// GetUserClientCount returns the total number of authenticated user
// WebSocket connections across all users (sum of per-user connections).
// Different from GetOnlineUserCount which counts unique users.
func GetUserClientCount() int {
	GlobalUserHub.mu.RLock()
	defer GlobalUserHub.mu.RUnlock()
	total := 0
	for _, conns := range GlobalUserHub.clients {
		total += len(conns)
	}
	return total
}

// IsBinanceConnected returns true if the upstream Binance combined
// stream is currently connected. False means the backend is operating
// in degraded mode — REST snapshots are still served but live updates
// will not flow until the connection is re-established.
//
// We determine "connected" by checking ticker freshness: if we have
// received a tick in the last 15 seconds, the stream is healthy.
// (Binance sends miniTicker updates roughly every 1s per symbol.)
func IsBinanceConnected() bool {
	GlobalMarketHub.mu.RLock()
	defer GlobalMarketHub.mu.RUnlock()
	if len(GlobalMarketHub.tickers) == 0 {
		return false
	}
	// Check the freshest ticker
	var newest int64
	for _, t := range GlobalMarketHub.tickers {
		if t.UpdatedAt > newest {
			newest = t.UpdatedAt
		}
	}
	// 15-second tolerance — Binance sends ~1 tick/s per symbol, so
	// any ticker older than 15s indicates the stream has stalled.
	return newest > 0 && (nowMs()-newest) < 15000
}

// GetSupportedSymbolCount returns the number of Binance symbols the
// MarketHub subscribes to.
func GetSupportedSymbolCount() int {
	return len(supportedSymbols)
}

// GetSupportedIntervalCount returns the number of kline intervals
// the MarketHub subscribes to.
func GetSupportedIntervalCount() int {
	return len(supportedIntervals)
}

// GetSupportedSymbols returns a copy of the supported symbols list
// (uppercased) for external consumers.
func GetSupportedSymbols() []string {
	out := make([]string, len(supportedSymbols))
	for i, s := range supportedSymbols {
		out[i] = strings.ToUpper(s)
	}
	return out
}

// nowMs is a small helper to avoid importing time in this file
// (time is already imported by other files in the package; we keep
// this file focused on observability helpers).
func nowMs() int64 {
	return timeNowMs()
}
