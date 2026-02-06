#!/bin/bash
# ================================
# EC2 Docker PostgreSQL 백업 스크립트
# 사용법: ./scripts/deploy/backup-db.sh
# ================================

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/../.."

# .env 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-solar_insight}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/solar_insight_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}데이터베이스 백업 시작...${NC}"

# Docker를 통해 백업
docker exec solor-db pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F p \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "$BACKUP_FILE"

# 압축
gzip "$BACKUP_FILE"

echo -e "${GREEN}백업 완료: ${BACKUP_FILE}.gz${NC}"

# 오래된 백업 삭제 (7일 이상)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true

echo -e "${YELLOW}현재 백업 파일:${NC}"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null || echo "  (없음)"
