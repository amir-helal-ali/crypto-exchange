#!/bin/sh
# nginx-entrypoint.sh — init script for the nginx container
#
# This script runs once at container startup. It:
# 1. Generates the initial nginx.conf from the template using current
#    settings (fetched from backend).
# 2. Starts a background watcher that monitors a trigger file. When the
#    trigger file is touched (by the admin via POST /api/v1/admin/nginx/reload),
#    it regenerates the config and reloads nginx.
# 3. Execs nginx in the foreground (so the container stays alive).

set -eu

# Wait for backend to be reachable (max 60s)
echo "[nginx-entrypoint] waiting for backend..."
for i in $(seq 1 60); do
  if wget -q -O /dev/null http://backend:3000/api/health/live 2>/dev/null; then
    echo "[nginx-entrypoint] backend is up"
    break
  fi
  sleep 1
done

# Initial config generation
echo "[nginx-entrypoint] generating initial nginx.conf..."
/etc/nginx/scripts/regen-config.sh --check || {
  echo "[nginx-entrypoint] initial config generation failed, retrying with defaults" >&2
  # Fallback: use localhost defaults so nginx can start
  SSL_ENABLED=false \
  FRONTEND_DOMAIN=localhost \
  BACKEND_DOMAIN=localhost \
  ADMIN_DOMAIN=localhost \
  MAIN_DOMAIN=localhost \
  /etc/nginx/scripts/regen-config.sh --check
}

# Generate for real (no --check) to write the actual config
/etc/nginx/scripts/regen-config.sh || true

# Start the trigger-file watcher in the background
TRIGGER_FILE="${NGINX_RELOAD_TRIGGER:-/shared/nginx/.reload-trigger}"
WATCH_INTERVAL="${NGINX_WATCH_INTERVAL:-2}"

if [ -d "$(dirname "$TRIGGER_FILE")" ]; then
  echo "[nginx-entrypoint] starting trigger watcher (file: $TRIGGER_FILE, interval: ${WATCH_INTERVAL}s)"
  LAST_HASH=""
  (
    while true; do
      if [ -f "$TRIGGER_FILE" ]; then
        CURRENT_HASH=$(md5sum "$TRIGGER_FILE" 2>/dev/null | cut -d' ' -f1)
        if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
          echo "[nginx-watcher] trigger detected, regenerating config..."
          /etc/nginx/scripts/regen-config.sh || echo "[nginx-watcher] regen failed" >&2
          LAST_HASH="$CURRENT_HASH"
        fi
      fi
      sleep "$WATCH_INTERVAL"
    done
  ) &
else
  echo "[nginx-entrypoint] WARNING: $(dirname "$TRIGGER_FILE") not writable — trigger watcher disabled" >&2
  echo "[nginx-entrypoint] admin nginx reload will not work. Run regen-config.sh manually." >&2
fi

echo "[nginx-entrypoint] starting nginx..."
exec nginx -g 'daemon off;'
