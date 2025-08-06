#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Parando Cloud Kanban...${NC}"

# Verificar Docker Compose
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ Docker Compose não está instalado.${NC}"
    exit 1
fi

# Parar containers
$COMPOSE_CMD down

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloud Kanban parado com sucesso.${NC}"
else
    echo -e "${RED}❌ Erro ao parar Cloud Kanban.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Para iniciar novamente, execute:${NC}"
echo "   ./scripts/start-docker.sh"