#!/bin/bash
# ================================
# EC2 초기 설정 스크립트
# Amazon Linux 2023 / Ubuntu 22.04 지원
# 사용법: curl -sSL https://raw.githubusercontent.com/<user>/<repo>/main/scripts/deploy/setup-ec2.sh | bash
# ================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Solor Insight EC2 초기 설정${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# OS 감지
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}지원하지 않는 OS입니다.${NC}"
    exit 1
fi

echo -e "${YELLOW}감지된 OS: $OS${NC}"

# ================================
# 1. 시스템 패키지 업데이트
# ================================
echo -e "${GREEN}[1/5] 시스템 패키지 업데이트...${NC}"

if [ "$OS" = "amzn" ]; then
    sudo yum update -y
    sudo yum install -y git
elif [ "$OS" = "ubuntu" ]; then
    sudo apt-get update
    sudo apt-get upgrade -y
    sudo apt-get install -y git curl
fi

# ================================
# 2. Docker 설치
# ================================
echo -e "${GREEN}[2/5] Docker 설치...${NC}"

if ! command -v docker &> /dev/null; then
    if [ "$OS" = "amzn" ]; then
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    elif [ "$OS" = "ubuntu" ]; then
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker $USER
    fi
    echo -e "${GREEN}Docker 설치 완료${NC}"
else
    echo -e "${YELLOW}Docker가 이미 설치되어 있습니다.${NC}"
fi

# ================================
# 3. Docker Compose 설치
# ================================
echo -e "${GREEN}[3/5] Docker Compose 설치...${NC}"

if ! command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose ${COMPOSE_VERSION} 설치 완료${NC}"
else
    echo -e "${YELLOW}Docker Compose가 이미 설치되어 있습니다.${NC}"
fi

# ================================
# 4. 프로젝트 디렉토리 생성
# ================================
echo -e "${GREEN}[4/5] 프로젝트 디렉토리 설정...${NC}"

PROJECT_DIR="$HOME/solor-insight"
mkdir -p "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/backups"
mkdir -p "$PROJECT_DIR/nginx/ssl"

# ================================
# 5. 완료 메시지
# ================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  초기 설정 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo ""
echo "1. 새 터미널을 열거나 다시 로그인하세요 (docker 그룹 적용)"
echo "   $ exit"
echo "   $ ssh ec2-user@<EC2_IP>"
echo ""
echo "2. 프로젝트를 클론하세요:"
echo "   $ cd ~/solor-insight"
echo "   $ git clone https://github.com/<user>/<repo>.git ."
echo ""
echo "3. 환경 변수를 설정하세요:"
echo "   $ cp .env.example .env"
echo "   $ nano .env  # 실제 값으로 수정"
echo ""
echo "4. 배포 스크립트를 실행하세요:"
echo "   $ ./scripts/deploy/deploy.sh"
echo ""
