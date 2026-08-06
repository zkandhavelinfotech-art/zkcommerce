#!/bin/bash
# ZKCommerce v4.1 -- Database Backup Script
# Usage: bash deployment/backups/backup.sh [environment]
# Schedule: Add to crontab for automatic backups
# Example cron: 0 2 * * * /path/to/zkcommerce/deployment/backups/backup.sh production

ENV=${1:-development}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$(dirname "$0")"
LOG_DIR="$(dirname "$0")/../logs"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

log() { echo "[$(date -Iseconds)] [BACKUP] $1" | tee -a "$LOG_DIR/backup.log"; }

# Load env
ENV_FILE="$(dirname "$0")/../environments/.env.$ENV"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
  log "Loaded environment: $ENV"
else
  log "WARNING: $ENV_FILE not found, using system env"
fi

if [ -z "$DATABASE_URL" ]; then
  log "ERROR: DATABASE_URL not set"
  exit 1
fi

OUTFILE="$BACKUP_DIR/zkcommerce-${ENV}-${TIMESTAMP}.sql"
log "Starting backup to: $OUTFILE"

pg_dump "$DATABASE_URL" \
  --format=plain \
  --clean \
  --no-owner \
  --no-acl \
  -f "$OUTFILE" 2>> "$LOG_DIR/backup.log"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$OUTFILE" | cut -f1)
  log "Backup complete: $OUTFILE ($SIZE)"
  # Compress
  gzip "$OUTFILE"
  log "Compressed: ${OUTFILE}.gz"
  # Retention: keep last 14 backups
  ls -t "$BACKUP_DIR"/zkcommerce-${ENV}-*.gz 2>/dev/null | tail -n +15 | xargs -r rm
  log "Retention policy applied (kept last 14)"
else
  log "ERROR: pg_dump failed"
  exit 1
fi
