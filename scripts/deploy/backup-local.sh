#!/bin/bash
# ================================
# 로컬 PostgreSQL 데이터 백업 스크립트
# Docker를 통해 버전 호환성 문제 해결
# 사용법: ./scripts/deploy/backup-local.sh
# ================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  로컬 데이터베이스 백업 시작${NC}"
echo -e "${GREEN}========================================${NC}"

# 설정
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/solar_insight_${TIMESTAMP}.sql"

# 로컬 DB 설정 (필요시 수정)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-solar_insight}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

# PostgreSQL 버전 확인
PG_VERSION=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT split_part(version(), ' ', 2);" 2>/dev/null | tr -d ' ' | cut -d'.' -f1)

if [ -z "$PG_VERSION" ]; then
    echo -e "${RED}오류: PostgreSQL에 연결할 수 없습니다.${NC}"
    echo -e "${YELLOW}로컬 PostgreSQL을 먼저 실행해주세요.${NC}"
    exit 1
fi

echo -e "${YELLOW}백업 중...${NC}"
echo "  - 호스트: $DB_HOST:$DB_PORT"
echo "  - 데이터베이스: $DB_NAME"
echo "  - PostgreSQL 버전: $PG_VERSION"
echo "  - 백업 파일: $BACKUP_FILE"

# Docker를 통해 pg_dump 실행 (버전 호환성 보장)
docker run --rm \
    --network host \
    -e PGPASSWORD="$DB_PASSWORD" \
    -v "$(pwd)/$BACKUP_DIR:/backups" \
    postgres:${PG_VERSION}-alpine \
    pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
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
BACKUP_FILE="${BACKUP_FILE}.gz"

# 결과 출력
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  백업 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  파일: $BACKUP_FILE"
echo "  크기: $FILE_SIZE"
echo ""
echo -e "${YELLOW}EC2로 전송하려면:${NC}"
echo "  scp $BACKUP_FILE ec2-user@<EC2_IP>:~/solor-insight/backups/"
