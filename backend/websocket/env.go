package websocket

import "os"

// getenv is a tiny helper so upgrader.go can read env vars without
// each call site reinventing os.Getenv. Centralised here to keep
// imports tidy across the package.
func getenv(key string) string {
	return os.Getenv(key)
}
