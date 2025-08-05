#!/bin/bash

# Script para verificar status dos serviços Claude Code UI

echo "🔍 Claude Code UI - Verificação de Status"
echo "========================================"
echo ""

# Função para verificar porta
check_port() {
    local port=$1
    local service=$2
    
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "✅ $service (porta $port): ATIVO"
        return 0
    else
        echo "❌ $service (porta $port): INATIVO"
        return 1
    fi
}

# Verifica serviços
echo "📊 Status dos Serviços:"
check_port 9000 "Frontend (Vite)"
FRONTEND=$?

check_port 8080 "Backend (Node.js)"
BACKEND=$?

check_port 8081 "Vibe Kanban (Rust)"
VIBE=$?

echo ""

# Verifica ngrok
echo "🌐 Status do Ngrok:"
if pgrep -f "ngrok" >/dev/null 2>&1; then
    echo "✅ Ngrok: ATIVO"
    
    # Tenta obter a URL do ngrok
    if command -v curl >/dev/null 2>&1; then
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | grep -o 'http[^"]*' | head -1)
        if [ ! -z "$NGROK_URL" ]; then
            echo "   URL: $NGROK_URL"
        else
            echo "   URL configurada: https://www.claudecode.ngrok.app"
        fi
    fi
else
    echo "❌ Ngrok: INATIVO"
fi

echo ""

# Verifica processos relacionados
echo "🔄 Processos em execução:"
ps aux | grep -E "(npm run dev|ngrok|cargo run)" | grep -v grep | while read -r line; do
    echo "   $(echo "$line" | awk '{print $2, $11, $12, $13}')"
done

echo ""

# URLs de acesso
if [ $FRONTEND -eq 0 ]; then
    echo "🔗 URLs de Acesso:"
    echo "   Local: http://localhost:9000"
    echo "   Remoto: https://www.claudecode.ngrok.app"
fi

echo ""

# Recomendações
if [ $FRONTEND -ne 0 ] || [ $BACKEND -ne 0 ]; then
    echo "💡 Recomendação:"
    echo "   Execute ./iniciar.sh para iniciar todos os serviços"
fi

echo ""
echo "✨ Verificação concluída!"