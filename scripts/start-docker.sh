#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Iniciando Cloud Kanban no Docker...${NC}"
echo ""

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando. Por favor, inicie o Docker Desktop primeiro.${NC}"
    exit 1
fi

# Verificar Docker Compose
if ! docker compose version > /dev/null 2>&1; then
    if ! docker-compose version > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose não está instalado.${NC}"
        exit 1
    fi
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# Criar diretórios necessários
echo -e "${YELLOW}📁 Criando diretórios necessários...${NC}"
mkdir -p data uploads temp projects

# Verificar arquivo de ambiente
if [ ! -f .env.docker ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env.docker não encontrado.${NC}"
    if [ -f .env.docker.example ]; then
        echo -e "${YELLOW}📝 Copiando template...${NC}"
        cp .env.docker.example .env.docker
        echo -e "${RED}❗ Por favor, configure o arquivo .env.docker com suas credenciais:${NC}"
        echo "   - CLAUDE_API_KEY"
        echo "   - NGROK_AUTHTOKEN"
        echo "   - JWT_SECRET (mude o padrão!)"
        echo ""
        echo -e "${YELLOW}Depois de configurar, execute este script novamente.${NC}"
        exit 1
    fi
fi

# Carregar variáveis de ambiente
source .env.docker

# Verificar configurações essenciais
if [ -z "$NGROK_AUTHTOKEN" ]; then
    echo -e "${YELLOW}⚠️  NGROK_AUTHTOKEN não configurado.${NC}"
    echo "   O ngrok não funcionará sem o token."
    echo "   Obtenha em: https://dashboard.ngrok.com/get-started/your-authtoken"
fi

if [ -z "$CLAUDE_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  CLAUDE_API_KEY não configurado.${NC}"
    echo "   O Claude CLI não funcionará sem a API key."
fi

# Parar containers antigos se existirem
echo -e "${YELLOW}🛑 Parando containers antigos...${NC}"
$COMPOSE_CMD down 2>/dev/null

# Build das imagens
echo -e "${BLUE}🔨 Construindo imagens Docker...${NC}"
$COMPOSE_CMD build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao construir imagens Docker.${NC}"
    exit 1
fi

# Iniciar containers
echo -e "${GREEN}🚀 Iniciando containers...${NC}"
$COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao iniciar containers.${NC}"
    exit 1
fi

# Aguardar serviços iniciarem
echo -e "${YELLOW}⏳ Aguardando serviços iniciarem...${NC}"
sleep 10

# Verificar status dos containers
echo ""
echo -e "${BLUE}📊 Status dos containers:${NC}"
$COMPOSE_CMD ps

# Verificar saúde dos serviços
echo ""
echo -e "${BLUE}🏥 Verificando saúde dos serviços...${NC}"

# Backend
if curl -s -f http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend Node.js está rodando${NC}"
else
    echo -e "${YELLOW}⚠️  Backend ainda está iniciando...${NC}"
fi

# Vibe Kanban
if curl -s -f http://localhost:8081/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Vibe Kanban está rodando${NC}"
else
    echo -e "${YELLOW}⚠️  Vibe Kanban ainda está iniciando...${NC}"
fi

# Frontend
if curl -s -f http://localhost:9000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend está rodando${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend ainda está iniciando...${NC}"
fi

# Obter URL do ngrok
echo ""
echo -e "${BLUE}🌐 URLs de acesso:${NC}"
echo -e "   ${GREEN}Local:${NC} http://localhost:9000"

# Tentar obter URL pública do ngrok
sleep 5
NGROK_URL=$(curl -s localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ ! -z "$NGROK_URL" ]; then
    echo -e "   ${GREEN}Público (ngrok):${NC} $NGROK_URL"
    echo ""
    echo -e "${YELLOW}📱 Você pode acessar de qualquer lugar usando a URL do ngrok!${NC}"
else
    echo -e "   ${YELLOW}Ngrok ainda está conectando...${NC}"
    echo -e "   Verifique em: http://localhost:4040"
fi

echo ""
echo -e "${BLUE}📊 Dashboards:${NC}"
echo -e "   Ngrok Dashboard: http://localhost:4040"
echo ""
echo -e "${GREEN}✅ Cloud Kanban está rodando no Docker!${NC}"
echo ""
echo -e "${BLUE}Comandos úteis:${NC}"
echo "   Ver logs:        $COMPOSE_CMD logs -f"
echo "   Parar tudo:      ./scripts/stop-docker.sh"
echo "   Reiniciar:       $COMPOSE_CMD restart"
echo "   Status:          $COMPOSE_CMD ps"
echo ""