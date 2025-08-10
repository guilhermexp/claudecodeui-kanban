#!/bin/bash

echo "🔍 Verificando túnel ngrok..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="claudecode.ngrok.app"

# 1. Verifica se o ngrok está rodando
echo "1️⃣ Verificando processo ngrok..."
if pgrep -f "ngrok.*${DOMAIN}" > /dev/null; then
    echo -e "${GREEN}✅ Ngrok está rodando${NC}"
    NGROK_PID=$(pgrep -f "ngrok.*${DOMAIN}")
    echo "   PID: ${NGROK_PID}"
else
    echo -e "${RED}❌ Ngrok NÃO está rodando${NC}"
    echo "   Execute: ./start-background-prod.sh"
    exit 1
fi

# 2. Verifica API local do ngrok
echo ""
echo "2️⃣ Verificando API local do ngrok (localhost:4040)..."
if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    TUNNEL_INFO=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['tunnels']:
    tunnel = data['tunnels'][0]
    print(f\"URL Pública: {tunnel['public_url']}\")
    print(f\"Encaminha para: {tunnel['config']['addr']}\")
    print(f\"Conexões ativas: {tunnel['metrics']['conns']['gauge']}\")
else:
    print('Nenhum túnel ativo')
" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$TUNNEL_INFO" ]; then
        echo -e "${GREEN}✅ API do ngrok respondendo${NC}"
        echo "$TUNNEL_INFO" | sed 's/^/   /'
    else
        echo -e "${YELLOW}⚠️ API respondendo mas sem túneis ativos${NC}"
    fi
else
    echo -e "${RED}❌ API do ngrok não está acessível${NC}"
fi

# 3. Verifica se o servidor Node está rodando
echo ""
echo "3️⃣ Verificando servidor Node.js..."
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor Node.js está rodando na porta 8080${NC}"
else
    echo -e "${RED}❌ Servidor Node.js NÃO está respondendo${NC}"
    echo "   Verifique: tail -f prod-server.log"
fi

# 4. Testa acesso EXTERNO via internet
echo ""
echo "4️⃣ Testando acesso GLOBAL (via internet)..."
echo "   Testando: https://${DOMAIN}/api/health"

# Usa um timeout de 10 segundos
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/api/health" 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ TÚNEL FUNCIONANDO GLOBALMENTE!${NC}"
    echo ""
    echo "   🌍 Sua aplicação está acessível de QUALQUER LUGAR via:"
    echo "      https://${DOMAIN}"
    echo ""
    echo "   📱 Você pode acessar de:"
    echo "      • Qualquer rede WiFi"
    echo "      • Dados móveis (4G/5G)"
    echo "      • Outra casa/escritório"
    echo "      • Qualquer lugar do mundo!"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ Não foi possível conectar ao túnel${NC}"
    echo "   Possíveis causas:"
    echo "   • Sem conexão com internet"
    echo "   • Firewall bloqueando"
    echo "   • Domínio ngrok expirado"
else
    echo -e "${YELLOW}⚠️ Túnel respondeu mas com erro HTTP ${HTTP_STATUS}${NC}"
    echo "   Verifique os logs: tail -f prod-*.log"
fi

# 5. Informações adicionais
echo ""
echo "📊 Dashboard do ngrok: http://localhost:4040"
echo "📜 Logs disponíveis:"
echo "   • tail -f prod-server.log (Node.js)"
echo "   • tail -f prod-ngrok.log (Ngrok)"
echo "   • tail -f prod-vibe.log (Vibe Kanban)"

# 6. Teste de latência (opcional)
echo ""
echo "5️⃣ Testando latência do túnel..."
if command -v ping > /dev/null 2>&1; then
    echo "   Fazendo ping em ${DOMAIN}..."
    ping -c 3 ${DOMAIN} 2>/dev/null | grep -E "min/avg/max" | sed 's/^/   /' || echo "   Ping não disponível"
fi

echo ""
echo "✨ Verificação concluída!"