#!/bin/bash
# ================================
# 메인 배포 스크립트
# EC2에서 GitHub 풀 받고 실행
# 사용법: ./scripts/deploy/deploy.sh
# ================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 프로젝트 루트로 이동
cd "$(dirname "$0")/../.."
PROJECT_ROOT=$(pwd)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Solor Insight 배포 시작${NC}"
echo -e "${BLUE}========================================${NC}"
echo "  프로젝트 경로: $PROJECT_ROOT"
echo ""

# ================================
# 1. 환경 변수 확인
# ================================
echo -e "${GREEN}[1/6] 환경 변수 확인...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}오류: .env 파일이 없습니다.${NC}"
    echo "cp .env.example .env 로 생성 후 값을 설정하세요."
    exit 1
fi

# 필수 환경 변수 체크
source .env
REQUIRED_VARS=("DB_PASSWORD" "DATA_GO_KR_API_KEY" "KNOWLEDGE_BASE_ID")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}오류: $var 가 설정되지 않았습니다.${NC}"
        exit 1
    fi
done

echo -e "${GREEN}  환경 변수 확인 완료${NC}"

# ================================
# 2. 최신 코드 풀
# ================================
echo -e "${GREEN}[2/6] 최신 코드 가져오기...${NC}"

if [ -d .git ]; then
    git fetch origin
    git reset --hard origin/main
    echo -e "${GREEN}  코드 업데이트 완료${NC}"
else
    echo -e "${YELLOW}  Git 저장소가 아닙니다. 건너뜁니다.${NC}"
fi

# ================================
# 3. 기존 컨테이너 정리
# ================================
echo -e "${GREEN}[3/6] 기존 컨테이너 정리...${NC}"

docker-compose down --remove-orphans 2>/dev/null || true

# ================================
# 4. Docker 이미지 빌드
# ================================
echo -e "${GREEN}[4/6] Docker 이미지 빌드...${NC}"

docker-compose build --no-cache app

# ================================
# 5. 컨테이너 시작
# ================================
echo -e "${GREEN}[5/6] 컨테이너 시작...${NC}"

# DB 먼저 시작
docker-compose up -d db

# DB 준비 대기
echo -e "${YELLOW}  DB 준비 대기 중...${NC}"
sleep 10

# DB 연결 확인
MAX_RETRIES=30
RETRY_COUNT=0
until docker exec solor-db pg_isready -U ${DB_USER:-postgres} > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}오류: DB 연결 실패${NC}"
        exit 1
    fi
    echo -e "${YELLOW}  DB 연결 대기 중... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 2
done

echo -e "${GREEN}  DB 연결 확인됨${NC}"

# Prisma 마이그레이션 실행 (앱 컨테이너의 로컬 prisma 사용)
echo -e "${YELLOW}  Prisma 마이그레이션 실행...${NC}"
docker-compose run --rm app ./node_modules/.bin/prisma migrate deploy

# 나머지 서비스 시작
docker-compose up -d

# ================================
# 6. 상태 확인
# ================================
echo -e "${GREEN}[6/6] 배포 상태 확인...${NC}"

sleep 5

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  컨테이너 상태${NC}"
echo -e "${BLUE}========================================${NC}"
docker-compose ps

echo ""

# 헬스체크
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$APP_STATUS" = "200" ]; then
    echo -e "${GREEN}앱 상태: 정상 (HTTP $APP_STATUS)${NC}"
else
    echo -e "${YELLOW}앱 상태: 확인 필요 (HTTP $APP_STATUS)${NC}"
    echo "로그 확인: docker-compose logs app"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  앱 URL: http://$(curl -s ifconfig.me):80"
echo ""
echo -e "${YELLOW}유용한 명령어:${NC}"
echo "  로그 확인: docker-compose logs -f"
echo "  앱 재시작: docker-compose restart app"
echo "  DB 백업:   ./scripts/deploy/backup-db.sh"
echo "  DB 복원:   ./scripts/deploy/restore-db.sh <백업파일>"
echo ""
