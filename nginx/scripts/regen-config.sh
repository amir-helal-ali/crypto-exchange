#!/bin/sh
# regen-config.sh — regenerate /etc/nginx/nginx.conf from current DB settings
#
# Reads domain/SSL configuration from the backend /api/v1/config endpoint
# and substitutes into nginx.conf.template to produce the final nginx.conf.
#
# Usage:
#   regen-config.sh            # generate + reload
#   regen-config.sh --check    # generate + test, no reload (dry run)
#   regen-config.sh --once     # generate only if config changed
#
# Exit codes: 0=success, 1=fetch failed, 2=template missing, 3=nginx -t failed

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

# ── Fetch settings from backend ──────────────────────────────────
SETTINGS_URL="$BACKEND_URL/api/v1/config"
echo "[regen-config] fetching settings from $SETTINGS_URL"
RESPONSE=$(wget -q -O - "$SETTINGS_URL" 2>/dev/null || echo "")

if [ -z "$RESPONSE" ]; then
  echo "[regen-config] WARNING: backend unreachable, using env/defaults" >&2
  FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-localhost}"
  BACKEND_DOMAIN="${BACKEND_DOMAIN:-localhost}"
  ADMIN_DOMAIN="${ADMIN_DOMAIN:-localhost}"
  MAIN_DOMAIN="${MAIN_DOMAIN:-localhost}"
  SSL_ENABLED="${SSL_ENABLED:-false}"
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/local.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/local-key.pem}"
else
  FRONTEND_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"frontend_domain":"\([^"]*\)".*/\1/p')
  BACKEND_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"backend_domain":"\([^"]*\)".*/\1/p')
  ADMIN_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"admin_domain":"\([^"]*\)".*/\1/p')
  MAIN_DOMAIN=$(echo "$RESPONSE" | sed -n 's/.*"main_domain":"\([^"]*\)".*/\1/p' 2>/dev/null)
  [ -z "$MAIN_DOMAIN" ] && MAIN_DOMAIN="$FRONTEND_DOMAIN"
  SSL_ENABLED=$(echo "$RESPONSE" | sed -n 's/.*"ssl_enabled":\([^,}]*\).*/\1/p')
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/local.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/local-key.pem}"
fi

echo "[regen-config] frontend=$FRONTEND_DOMAIN backend=$BACKEND_DOMAIN admin=$ADMIN_DOMAIN main=$MAIN_DOMAIN ssl=$SSL_ENABLED"

# ── Derived values ───────────────────────────────────────────────
ALL_DOMAINS="$MAIN_DOMAIN $FRONTEND_DOMAIN $BACKEND_DOMAIN $ADMIN_DOMAIN"
BACKEND_DOMAIN_REGEX=$(echo "$BACKEND_DOMAIN" | sed 's/\./\\./g')
ADMIN_DOMAIN_REGEX=$(echo "$ADMIN_DOMAIN" | sed 's/\./\\./g')

FRONTEND_UPSTREAM_URL="http://frontend_upstream"
BACKEND_UPSTREAM_URL="http://backend_upstream"
ADMIN_UPSTREAM_URL="http://admin_upstream"

# ── Shared proxy location blocks ─────────────────────────────────
# These are used in whichever server block handles traffic.
PROXY_LOCATIONS='# Default location — proxies to the routed upstream
    location / {
      proxy_pass $upstream;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 60s;
      proxy_send_timeout 60s;
    }

    # WebSocket routes — always go to backend
    location /ws/ {
      proxy_pass http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_read_timeout 86400;
      proxy_send_timeout 86400;
    }

    # Server-Sent Events (admin live stream)
    location /api/v1/admin/stream {
      proxy_pass http://backend_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Connection "";
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      chunked_transfer_encoding on;
    }

    # Static uploads — served by backend
    location /uploads/ {
      proxy_pass http://backend_upstream;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      expires 30d;
      add_header Cache-Control "public, immutable";
    }'

SECURITY_HEADERS='# Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10M;'

# ── Build server blocks based on SSL mode ────────────────────────
if [ "$SSL_ENABLED" = "true" ]; then
  # SSL ON: HTTP = redirect only, HTTPS = full proxy
  HTTP_BLOCK_CONTENT="return 301 https://\$host\$request_uri;"

  HTTPS_SERVER_BLOCK="server {
    listen 443 ssl;
    http2 on;
    server_name $ALL_DOMAINS;

    ssl_certificate $SSL_CERT_PATH;
    ssl_certificate_key $SSL_KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    $SECURITY_HEADERS

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
      default_type \"text/plain\";
      auth_basic off;
      try_files \$uri =404;
    }

    $PROXY_LOCATIONS
  }"
else
  # SSL OFF: HTTP = full proxy, no HTTPS server block
  HTTP_BLOCK_CONTENT="$SECURITY_HEADERS

    $PROXY_LOCATIONS"

  HTTPS_SERVER_BLOCK="# HTTPS server disabled — SSL is off. All traffic served on port 80."
fi

# ── Substitute placeholders ──────────────────────────────────────
TMP_OUTPUT="${OUTPUT}.tmp"

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

# Insert multi-line blocks using awk
awk -v block="$HTTP_BLOCK_CONTENT" '{gsub(/\$\{HTTP_BLOCK_CONTENT\}/, block)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"

awk -v block="$HTTPS_SERVER_BLOCK" '{gsub(/\$\{HTTPS_SERVER_BLOCK\}/, block)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"

# ── Validate and apply ───────────────────────────────────────────
if [ -f "$OUTPUT" ] && [ "$ONCE" = "1" ]; then
  if diff -q "$OUTPUT" "$TMP_OUTPUT" > /dev/null 2>&1; then
    echo "[regen-config] config unchanged, skipping reload"
    rm -f "$TMP_OUTPUT"
    exit 0
  fi
fi

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

echo "[regen-config] reloading nginx..."
nginx -s reload
echo "[regen-config] done"
