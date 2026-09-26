#!/bin/sh
# Daily Postgres backup. Add to crontab:  15 3 * * * /opt/super-champion/deploy/backup.sh
set -e
cd /opt/super-champion
mkdir -p backups
STAMP=$(date +%Y-%m-%d)
docker compose exec -T db pg_dump -U superchampion superchampion | gzip > "backups/super-champion-$STAMP.sql.gz"
find backups -name 'super-champion-*.sql.gz' -mtime +30 -delete
echo "Backup written: backups/super-champion-$STAMP.sql.gz"
