#!/bin/bash

# Cores para output
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar Docker Compose
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "Docker Compose não está instalado."
    exit 1
fi

if [ -z "$1" ]; then
    echo -e "${BLUE}📋 Mostrando logs de todos os serviços...${NC}"
    $COMPOSE_CMD logs -f --tail=100
else
    echo -e "${BLUE}📋 Mostrando logs do serviço: $1${NC}"
    $COMPOSE_CMD logs -f --tail=100 $1
fi