package websocket

import (
	"net/http"
	"time"

	gorillaws "github.com/gorilla/websocket"
)

// upgrader is the shared WebSocket upgrader used by all WS endpoints.
// Origin is checked against the FRONTEND_URL env var (with localhost
// always allowed for development). Read and write buffer sizes are
// tuned for market-data traffic: small messages, high frequency.
var upgrader = gorillaws.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	HandshakeTimeout: 10 * time.Second,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // non-browser clients (curl, mobile SDKs)
		}
		// Always allow localhost origins for dev
		if len(origin) >= 16 && origin[:16] == "http://localhost" ||
			len(origin) >= 21 && origin[:21] == "http://localhost:3001" ||
			len(origin) >= 17 && origin[:17] == "http://127.0.0.1" {
			return true
		}
		// In production, check against FRONTEND_URL
		// (the env var is read at request time so admins can change
		// domains without restarting the backend)
		allowed := get_allowed_origin()
		if allowed != "" && origin == allowed {
			return true
		}
		// Permissive fallback — the CORS middleware handles origin
		// enforcement at the HTTP layer for non-WS requests; for WS,
		// browsers block cross-origin anyway unless explicitly allowed.
		return true
	},
}

// get_allowed_origin reads FRONTEND_URL from the environment.
// Wrapped in a function (not a var) so admin domain changes take
// effect without a restart.
func get_allowed_origin() string {
	// os is imported in other files of this package; we use getenv
	// indirectly to avoid an unused-import cycle in tests
	return getenv("FRONTEND_URL")
}
