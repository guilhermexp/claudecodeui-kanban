#!/bin/bash

# Script alternativo que inicia o ngrok diretamente na porta 9000
# sem usar a configuração do arquivo ngrok.yml

clear
echo "🚀 Claude Code UI - Ngrok Direto"
echo "================================"
echo ""

# Mata processos ngrok anteriores
echo "🧹 Limpando ngrok anterior..."
pkill -f ngrok 2>/dev/null
sleep 2

# Verifica se o frontend está rodando
if ! lsof -ti:9000 >/dev/null 2>&1; then
    echo "⚠️  Frontend não está rodando na porta 9000!"
    echo "   Por favor, execute primeiro: npm run dev"
    echo "   Em outro terminal"
    exit 1
fi

echo "✅ Frontend detectado na porta 9000"
echo ""

# Testa se o frontend está respondendo
echo "🔍 Verificando resposta do frontend..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9000)
if [[ "$RESPONSE" == "200" ]] || [[ "$RESPONSE" == "304" ]]; then
    echo "✅ Frontend respondendo corretamente!"
else
    echo "⚠️  Frontend não está respondendo (HTTP $RESPONSE)"
    echo "   Aguarde o build completar e tente novamente"
    exit 1
fi

echo ""
echo "🌐 Iniciando Ngrok..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 URLs de Acesso:"
echo ""
echo "   Local:  http://localhost:9000"
echo "   Remoto: Aguardando URL do Ngrok..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Pressione Ctrl+C para parar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Inicia ngrok diretamente na porta 9000
# Usa --log=stdout para ver os logs
ngrok http 9000 --log=stdout