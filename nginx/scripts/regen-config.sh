#!/bin/sh
# regen-config.sh — regenerate /etc/nginx/nginx.conf from current DB settings
#
# This script reads the current domain/SSL configuration from the
# system_settings table (via the backend /api/v1/config endpoint) and
# substitutes those values into nginx.conf.template to produce the
# final /etc/nginx/nginx.conf. After regeneration, it tests the new
# config with `nginx -t` and, if valid, sends a reload signal.
#
# Usage:
#   regen-config.sh            # generate + reload
#   regen-config.sh --check    # generate + test, no reload (dry run)
#   regen-config.sh --once     # generate only if config changed
#
# Environment:
#   BACKEND_URL  — URL of the backend API (default: http://backend:3000)
#   TEMPLATE     — path to the template (default: /etc/nginx/nginx.conf.template)
#   OUTPUT       — path to the output config (default: /etc/nginx/nginx.conf)
#
# Exit codes:
#   0 — success
#   1 — failed to fetch settings
#   2 — template not found
#   3 — nginx config test failed

set -eu

BACKEND_URL="${BACKEND_URL:-http://backend:3000}"
TEMPLATE="${TEMPLATE:-/etc/nginx/nginx.conf.template}"
OUTPUT="${OUTPUT:-/etc/nginx/nginx.conf}"
DRY_RUN=0
ONCE=0

for arg in "$@"; do
  case "$arg" in
    --check) DRY_RUN=1 ;;
    --once)  ONCE=1 ;;
  esac
done

if [ ! -f "$TEMPLATE" ]; then
  echo "[regen-config] ERROR: template not found: $TEMPLATE" >&2
  exit 2
fi

# Fetch current settings from backend. Use wget (busybox-compatible) since
# this script runs in the nginx:alpine container which only has busybox.
SETTINGS_URL="$BACKEND_URL/api/v1/config"
echo "[regen-config] fetching settings from $SETTINGS_URL"
RESPONSE=$(wget -q -O - "$SETTINGS_URL" 2>/dev/null || echo "")

if [ -z "$RESPONSE" ]; then
  echo "[regen-config] WARNING: backend unreachable, using env/defaults" >&2
  # Fallback to environment variables or safe localhost defaults
  FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-localhost}"
  BACKEND_DOMAIN="${BACKEND_DOMAIN:-localhost}"
  ADMIN_DOMAIN="${ADMIN_DOMAIN:-localhost}"
  MAIN_DOMAIN="${MAIN_DOMAIN:-localhost}"
  SSL_ENABLED="${SSL_ENABLED:-false}"
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/local.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/local-key.pem}"
else
  # Parse JSON with shell + sed (no jq in busybox). The /api/v1/config
  # endpoint returns a flat JSON object, so simple regex extraction works.
  FRONTEND_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"frontend_domain":"\([^"]*\)".*/\1/p')
  BACKEND_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"backend_domain":"\([^"]*\)".*/\1/p')
  ADMIN_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"admin_domain":"\([^"]*\)".*/\1/p')
  MAIN_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"main_domain":"\([^"]*\)".*/\1/p' 2>/dev/null)
  [ -z "$MAIN_DOMAIN" ] && MAIN_DOMAIN="$FRONTEND_DOMAIN"
  SSL_ENABLED=$(echo "$RESPONSE" | sed -n 's/.*"ssl_enabled":\([^,}]*\).*/\1/p')
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/local.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/local-key.pem}"
fi

echo "[regen-config] frontend_domain=$FRONTEND_DOMAIN"
echo "[regen-config] backend_domain=$BACKEND_DOMAIN"
echo "[regen-config] admin_domain=$ADMIN_DOMAIN"
echo "[regen-config] main_domain=$MAIN_DOMAIN"
echo "[regen-config] ssl_enabled=$SSL_ENABLED"

# Build derived values
ALL_DOMAINS="$MAIN_DOMAIN $FRONTEND_DOMAIN $BACKEND_DOMAIN $ADMIN_DOMAIN"

# Convert domains to regex (escape dots)
BACKEND_DOMAIN_REGEX=$(echo "$BACKEND_DOMAIN" | sed 's/\./\\./g')
ADMIN_DOMAIN_REGEX=$(echo "$ADMIN_DOMAIN" | sed 's/\./\\./g')

# Upstream URLs (always HTTP internally — docker network is private)
FRONTEND_UPSTREAM_URL="http://frontend_upstream"
BACKEND_UPSTREAM_URL="http://backend_upstream"
ADMIN_UPSTREAM_URL="http://admin_upstream"

# ===========================================
# Build HTTP_BLOCK_CONTENT (for port 80 server block)
# ===========================================
# When SSL is enabled: just redirect to HTTPS
# When SSL is disabled: serve full proxy with all location blocks
if [ "$SSL_ENABLED" = "true" ]; then
  HTTP_BLOCK_CONTENT="return 301 https://\$host\$request_uri;"
  SSL_DIRECTIVES="listen 443 ssl;
    http2 on;
    ssl_certificate $SSL_CERT_PATH;
    ssl_certificate_key $SSL_KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;"
  LISTEN_DIRECTIVE="listen 443 ssl;"
else
  # Full proxy configuration in HTTP server block
  HTTP_BLOCK_CONTENT="# Security headers
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;
    add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;

    client_max_body_size 10M;

    # Default location — proxies to the routed upstream
    location / {
      proxy_pass \$upstream;
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \$connection_upgrade;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_read_timeout 60s;
      proxy_send_timeout 60s;
    }

    # WebSocket routes — always go to backend
    location /ws/ {
      proxy_pass http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \"upgrade\";
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_read_timeout 86400;
      proxy_send_timeout 86400;
    }

    # Server-Sent Events (admin live stream)
    location /api/v1/admin/stream {
      proxy_pass http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Connection \"\";
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      chunked_transfer_encoding on;
    }

    # Static uploads — served by backend
    location /uploads/ {
      proxy_pass http://backend_upstream;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      expires 30d;
      add_header Cache-Control \"public, immutable\";
    }"
  SSL_DIRECTIVES="# SSL disabled — entire HTTPS server block is hidden"
  LISTEN_DIRECTIVE="listen 443 ssl;
    # This block is intentionally incomplete — SSL is disabled
    # and traffic is served from the HTTP server block above.
    # We keep this server block only as a placeholder.
    server_name _;
    return 444;"
fi

# Generate the final config
TMP_OUTPUT="${OUTPUT}.tmp"

# Substitute flat placeholders with sed
sed \
  -e "s|\${MAIN_DOMAIN}|$MAIN_DOMAIN|g" \
  -e "s|\${FRONTEND_DOMAIN}|$FRONTEND_DOMAIN|g" \
  -e "s|\${BACKEND_DOMAIN}|$BACKEND_DOMAIN|g" \
  -e "s|\${ADMIN_DOMAIN}|$ADMIN_DOMAIN|g" \
  -e "s|\${ALL_DOMAINS}|$ALL_DOMAINS|g" \
  -e "s|\${BACKEND_DOMAIN_REGEX}|$BACKEND_DOMAIN_REGEX|g" \
  -e "s|\${ADMIN_DOMAIN_REGEX}|$ADMIN_DOMAIN_REGEX|g" \
  -e "s|\${FRONTEND_UPSTREAM_URL}|$FRONTEND_UPSTREAM_URL|g" \
  -e "s|\${BACKEND_UPSTREAM_URL}|$BACKEND_UPSTREAM_URL|g" \
  -e "s|\${ADMIN_UPSTREAM_URL}|$ADMIN_UPSTREAM_URL|g" \
  -e "s|\${SSL_ENABLED}|$SSL_ENABLED|g" \
  -e "s|\${SSL_CERT_PATH}|$SSL_CERT_PATH|g" \
  -e "s|\${SSL_KEY_PATH}|$SSL_KEY_PATH|g" \
  "$TEMPLATE" > "$TMP_OUTPUT"

# Insert multi-line blocks using awk (sed can't handle \n reliably)
awk -v block="$HTTP_BLOCK_CONTENT" '{gsub(/\$\{HTTP_BLOCK_CONTENT\}/, block)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"

awk -v ssl="$SSL_DIRECTIVES" '{gsub(/\$\{SSL_DIRECTIVES\}/, ssl)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"

awk -v listen="$LISTEN_DIRECTIVE" '{gsub(/\$\{LISTEN_DIRECTIVE\}/, listen)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"

# Compare with current config — skip reload if unchanged
if [ -f "$OUTPUT" ] && [ "$ONCE" = "1" ]; then
  if diff -q "$OUTPUT" "$TMP_OUTPUT" > /dev/null 2>&1; then
    echo "[regen-config] config unchanged, skipping reload"
    rm -f "$TMP_OUTPUT"
    exit 0
  fi
fi

# Test the new config
mv "$TMP_OUTPUT" "$OUTPUT"
echo "[regen-config] testing new config..."
if ! nginx -t 2>&1; then
  echo "[regen-config] ERROR: nginx config test failed" >&2
  exit 3
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[regen-config] dry run complete (no reload)"
  exit 0
fi

# Reload nginx
echo "[regen-config] reloading nginx..."
nginx -s reload
echo "[regen-config] done"
