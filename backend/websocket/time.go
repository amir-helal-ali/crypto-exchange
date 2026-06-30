package websocket

import "time"

// timeNowMs returns the current Unix time in milliseconds.
// Centralised here so observability helpers don't need to import time
// directly (keeps the package's import graph tidy).
func timeNowMs() int64 {
	return time.Now().UnixMilli()
}
