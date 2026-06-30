#!/bin/sh
# ============================================================
# EgMoney Crypto Exchange — Database + Redis + SSL Backup
# ============================================================
# Usage:
#   ./scripts/backup.sh                 # one-time backup → ./backups/
#   ./scripts/backup.sh /mnt/nfs        # backup to custom location
#   CRON: 0 3 * * *  /opt/crypto-exchange/scripts/backup.sh
#
# Produces:
#   backups/YYYY-MM-DD_HHMM/
#     postgres.sql.gz       — full Postgres dump (compressed)
#     redis.rdb             — Redis snapshot (BGSAVE copy)
#     certs/                — SSL certs (mkcert local + any LE certs)
#     letsencrypt/          — Let's Encrypt state (accounts, certs, renewal config)
#     manifest.txt          — manifest with sizes + checksums
#
# Retention: keeps last 30 days of backups by default (configurable
# via BACKUP_RETENTION_DAYS env var).
# ============================================================

set -eu

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
BACKUP_DIR="$DEST/$TIMESTAMP"

mkdir -p "$BACKUP_DIR/certs" "$BACKUP_DIR/letsencrypt"

echo "==> [backup] target directory: $BACKUP_DIR"

# ------------------------------------------------------------
# 1. PostgreSQL backup (via docker exec, no host psql required)
# ------------------------------------------------------------
echo "==> [backup] dumping PostgreSQL..."
docker exec crypto-exchange-db pg_dump \
    -U "${POSTGRES_USER:-egmoney}" \
    -d "${POSTGRES_DB:-crypto_exchange}" \
    --no-owner --clean --if-exists \
    --format=plain \
  | gzip -9 > "$BACKUP_DIR/postgres.sql.gz"
echo "    size: $(du -h "$BACKUP_DIR/postgres.sql.gz" | cut -f1)"

# ------------------------------------------------------------
# 2. Redis backup (BGSAVE + copy dump.rdb from container)
# ------------------------------------------------------------
echo "==> [backup] snapshotting Redis..."
LAST_SAVE=""
docker exec crypto-exchange-redis redis-cli BGSAVE >/dev/null 2>&1 || true
# Wait for BGSAVE to finish (max 60s)
for i in $(seq 1 60); do
    PENDING=$(docker exec crypto-exchange-redis redis-cli LASTSAVE 2>/dev/null || echo 0)
    if [ "$PENDING" != "0" ] && [ "$PENDING" = "$LAST_SAVE" ]; then
        break
    fi
    LAST_SAVE="$PENDING"
    sleep 1
done
docker cp crypto-exchange-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb" 2>/dev/null || \
    echo "    [warn] redis.rdb copy skipped (redis container not present)"
echo "    size: $(du -h "$BACKUP_DIR/redis.rdb" 2>/dev/null | cut -f1 || echo 'n/a')"

# ------------------------------------------------------------
# 3. SSL certificates backup
# ------------------------------------------------------------
echo "==> [backup] copying SSL certificates..."
if [ -d "$PROJECT_ROOT/certs" ]; then
    cp -a "$PROJECT_ROOT/certs/." "$BACKUP_DIR/certs/"
    echo "    copied $(ls "$BACKUP_DIR/certs/" | wc -l) file(s)"
fi

# ------------------------------------------------------------
# 4. Let's Encrypt state backup (accounts + renewal config)
# ------------------------------------------------------------
echo "==> [backup] copying Let's Encrypt state..."
docker cp crypto-exchange-api:/etc/letsencrypt/. "$BACKUP_DIR/letsencrypt/" 2>/dev/null || \
    echo "    [info] /etc/letsencrypt not present (no LE certs yet)"

# ------------------------------------------------------------
# 5. Manifest with sizes + checksums
# ------------------------------------------------------------
echo "==> [backup] generating manifest..."
{
    echo "EgMoney Backup — $TIMESTAMP"
    echo "Generated:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Hostname:     $(hostname)"
    echo ""
    echo "=== Files ==="
    (cd "$BACKUP_DIR" && find . -type f -exec sha256sum {} \;) | sort
    echo ""
    echo "=== Sizes ==="
    du -sh "$BACKUP_DIR"/* 2>/dev/null | sort
} > "$BACKUP_DIR/manifest.txt"
echo "    manifest: $BACKUP_DIR/manifest.txt"

# ------------------------------------------------------------
# 6. Retention: prune backups older than $RETENTION_DAYS
# ------------------------------------------------------------
echo "==> [backup] pruning backups older than $RETENTION_DAYS days..."
find "$DEST" -maxdepth 1 -type d -name "20*-*-*_*" -mtime +"$RETENTION_DAYS" -print | while read -r old_dir; do
    echo "    removing: $(basename "$old_dir")"
    rm -rf "$old_dir"
done

echo "==> [backup] done OK"
echo "    backup: $BACKUP_DIR"
echo "    total:  $(du -sh "$BACKUP_DIR" | cut -f1)"
