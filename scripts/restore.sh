#!/bin/sh
# ============================================================
# EgMoney Crypto Exchange — Restore from backup
# ============================================================
# Usage:
#   ./scripts/restore.sh backups/2026-06-23_0315
#   ./scripts/restore.sh /mnt/nfs/2026-06-23_0315
#
# Restores:
#   - PostgreSQL database (DROP+CREATE+RELOAD)
#   - Redis state (stop, copy dump.rdb, start)
#   - SSL certificates
#   - Let's Encrypt state
#
# WARNING: This is destructive — it overwrites current state with
# the backup contents. Always test on a staging environment first.
# The script will prompt for confirmation before proceeding.
# ============================================================

set -eu

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <backup_dir>"
    echo "Example: $0 backups/2026-06-23_0315"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: backup directory '$BACKUP_DIR' not found"
    exit 1
fi

if [ ! -f "$BACKUP_DIR/manifest.txt" ]; then
    echo "ERROR: '$BACKUP_DIR/manifest.txt' not found — not a valid backup"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "============================================================"
echo " EgMoney Restore"
echo "============================================================"
echo " Backup:     $BACKUP_DIR"
echo " Project:    $PROJECT_ROOT"
echo ""
echo " Manifest summary:"
head -10 "$BACKUP_DIR/manifest.txt"
echo ""
echo " WARNING: This will OVERWRITE the current database, Redis state,"
echo " SSL certs, and Let's Encrypt state with the backup contents."
echo ""
printf "Type 'RESTORE' (uppercase) to proceed: "
read -r CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "==> [restore] Step 1/4: PostgreSQL"
if [ -f "$BACKUP_DIR/postgres.sql.gz" ]; then
    echo "    decompressing + restoring..."
    gunzip -c "$BACKUP_DIR/postgres.sql.gz" | \
        docker exec -i crypto-exchange-db psql \
            -U "${POSTGRES_USER:-egmoney}" \
            -d "${POSTGRES_DB:-crypto_exchange}" \
            >/dev/null
    echo "    PostgreSQL restored OK"
else
    echo "    [skip] postgres.sql.gz not found"
fi

echo ""
echo "==> [restore] Step 2/4: Redis"
if [ -f "$BACKUP_DIR/redis.rdb" ]; then
    echo "    stopping Redis..."
    docker stop crypto-exchange-redis >/dev/null
    echo "    copying dump.rdb..."
    docker cp "$BACKUP_DIR/redis.rdb" crypto-exchange-redis:/data/dump.rdb
    echo "    starting Redis..."
    docker start crypto-exchange-redis >/dev/null
    echo "    Redis restored OK"
else
    echo "    [skip] redis.rdb not found"
fi

echo ""
echo "==> [restore] Step 3/4: SSL certificates"
if [ -d "$BACKUP_DIR/certs" ] && [ "$(ls -A "$BACKUP_DIR/certs" 2>/dev/null)" ]; then
    mkdir -p "$PROJECT_ROOT/certs"
    cp -a "$BACKUP_DIR/certs/." "$PROJECT_ROOT/certs/"
    echo "    SSL certs restored OK"
else
    echo "    [skip] certs/ is empty or missing"
fi

echo ""
echo "==> [restore] Step 4/4: Let's Encrypt state"
if [ -d "$BACKUP_DIR/letsencrypt" ] && [ "$(ls -A "$BACKUP_DIR/letsencrypt" 2>/dev/null)" ]; then
    docker exec crypto-exchange-api mkdir -p /etc/letsencrypt 2>/dev/null || true
    docker cp "$BACKUP_DIR/letsencrypt/." crypto-exchange-api:/etc/letsencrypt/
    echo "    Let's Encrypt state restored OK"
else
    echo "    [skip] letsencrypt/ is empty or missing"
fi

echo ""
echo "==> [restore] reloading nginx to pick up restored certs..."
docker exec crypto-exchange-api sh -c 'echo "restored" > /shared/nginx/.reload-trigger' 2>/dev/null || true

echo ""
echo "============================================================"
echo " Restore complete."
echo "============================================================"
echo ""
echo " Verify with:"
echo "   docker compose ps"
echo "   curl -k https://localhost/api/health/live"
echo ""
echo " If Redis keys look stale, flush + reload from DB:"
echo "   docker exec crypto-exchange-redis redis-cli FLUSHDB"
echo ""
