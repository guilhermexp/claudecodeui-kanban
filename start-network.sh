#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Claude Code UI - Modo Rede Local                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
fi

echo -e "${YELLOW}${BOLD}⚠️  AVISO DE SEGURANÇA${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Esta aplicação terá acesso a:${NC}"
echo "  • Executar comandos no sistema"
echo "  • Ler e modificar arquivos"
echo "  • Claude CLI com sua API key"
echo ""
echo -e "${YELLOW}Use APENAS em rede local confiável!${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}${BOLD}🌐 Acesso:${NC}"
echo -e "  Local:    ${BLUE}http://localhost:9000${NC}"
echo -e "  Na rede:  ${BLUE}http://$LOCAL_IP:9000${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if password is set
if [ ! -f "server/database/users.db" ]; then
    echo -e "${RED}${BOLD}⚠️  ATENÇÃO: Nenhuma senha configurada!${NC}"
    echo -e "${RED}Configure uma senha ao acessar pela primeira vez.${NC}"
    echo ""
fi

echo -e "${CYAN}Pressione Ctrl+C para parar${NC}"
echo ""

# Export environment variables
export HOST=0.0.0.0
export VITE_HOST=0.0.0.0
export VITE_API_URL="http://$LOCAL_IP:8080"
export VITE_WS_URL="ws://$LOCAL_IP:8080"

# Start the application
npm run dev:network