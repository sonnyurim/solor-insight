#!/bin/bash
# ================================
# EC2에서 데이터베이스 복원 스크립트
# 사용법: ./scripts/deploy/restore-db.sh [백업파일.sql.gz]
# ================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  데이터베이스 복원 시작${NC}"
echo -e "${GREEN}========================================${NC}"

# 백업 파일 확인
BACKUP_FILE="${1:-$(ls -t ./backups/*.sql.gz 2>/dev/null | head -1)}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}오류: 백업 파일을 찾을 수 없습니다.${NC}"
    echo "사용법: $0 [백업파일.sql.gz]"
    echo ""
    echo "사용 가능한 백업 파일:"
    ls -la ./backups/*.sql.gz 2>/dev/null || echo "  (없음)"
    exit 1
fi

echo -e "${YELLOW}복원할 백업 파일: ${BACKUP_FILE}${NC}"

# .env에서 DB 설정 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-solar_insight}"

# Docker 컨테이너 확인
if ! docker ps | grep -q solor-db; then
    echo -e "${RED}오류: DB 컨테이너가 실행 중이 아닙니다.${NC}"
    echo "먼저 docker-compose up -d db 를 실행하세요."
    exit 1
fi

# 압축 해제 및 복원
echo -e "${YELLOW}복원 중...${NC}"

# 임시 파일로 압축 해제
TEMP_SQL="/tmp/restore_$(date +%s).sql"
gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"

# Docker를 통해 복원
docker exec -i solor-db psql \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    < "$TEMP_SQL"

# 임시 파일 삭제
rm -f "$TEMP_SQL"

# Prisma 마이그레이션 적용 (스키마 변경 있을 경우)
echo -e "${YELLOW}Prisma 마이그레이션 확인...${NC}"
docker exec solor-app npx prisma migrate deploy 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  복원 완료!${NC}"
echo -e "${GREEN}========================================${NC}"

# 데이터 확인
echo -e "${YELLOW}데이터 확인:${NC}"
docker exec solor-db psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
    (SELECT COUNT(*) FROM regions) as regions,
    (SELECT COUNT(*) FROM raw_generation) as raw_generation,
    (SELECT COUNT(*) FROM agg_daily) as agg_daily;
"
