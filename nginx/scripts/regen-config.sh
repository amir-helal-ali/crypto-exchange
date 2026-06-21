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
  echo "[regen-config] WARNING: backend unreachable, using defaults" >&2
  # Fallback to environment variables or safe defaults
  FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-eg-money.local}"
  BACKEND_DOMAIN="${BACKEND_DOMAIN:-api.eg-money.local}"
  ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.eg-money.local}"
  MAIN_DOMAIN="${MAIN_DOMAIN:-eg-money.local}"
  SSL_ENABLED="${SSL_ENABLED:-true}"
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

# Build SSL-related blocks
if [ "$SSL_ENABLED" = "true" ]; then
  SSL_DIRECTIVES="listen 443 ssl;\n    http2 on;\n    ssl_certificate $SSL_CERT_PATH;\n    ssl_certificate_key $SSL_KEY_PATH;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_ciphers HIGH:!aNULL:!MD5;\n    ssl_session_cache shared:SSL:10m;\n    ssl_session_timeout 10m;"
  SSL_REDIRECT_OR_FALLTHROUGH="return 301 https://\$host\$request_uri;"
  LISTEN_DIRECTIVE="listen 443 ssl;"
else
  SSL_DIRECTIVES="# SSL disabled"
  SSL_REDIRECT_OR_FALLTHROUGH="# SSL disabled — serving over HTTP\n    location / { proxy_pass \$upstream; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; }"
  LISTEN_DIRECTIVE="# SSL disabled"
fi

# Generate the final config
TMP_OUTPUT="${OUTPUT}.tmp"

# Substitute placeholders. We use envsubst if available, otherwise sed.
# envsubst is in gettext package; nginx:alpine doesn't have it by default.
# Use sed for portability.
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

# Insert the multi-line SSL_DIRECTIVES (sed doesn't handle \n well)
# Use awk for the SSL_DIRECTIVES substitution
if [ "$SSL_ENABLED" = "true" ]; then
  awk -v ssl="$SSL_DIRECTIVES" '{gsub(/\$\{SSL_DIRECTIVES\}/, ssl)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
  mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"
  awk -v redir="$SSL_REDIRECT_OR_FALLTHROUGH" '{gsub(/\$\{SSL_REDIRECT_OR_FALLTHROUGH\}/, redir)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
  mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"
  awk -v listen="$LISTEN_DIRECTIVE" '{gsub(/\$\{LISTEN_DIRECTIVE\}/, listen)} 1' "$TMP_OUTPUT" > "${TMP_OUTPUT}.2"
  mv "${TMP_OUTPUT}.2" "$TMP_OUTPUT"
fi

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
