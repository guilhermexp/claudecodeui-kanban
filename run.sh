#!/bin/bash

# Claude Code UI - Solução SIMPLES e DIRETA

clear
echo "🚀 Claude Code UI - Acesso Remoto Simplificado"
echo "=============================================="
echo ""

# Função para graceful shutdown
graceful_shutdown() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo "   Enviando SIGTERM para processos na porta $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Aguarda até 5 segundos para processo encerrar
        local count=0
        while [ $count -lt 5 ] && lsof -ti:$port >/dev/null 2>&1; do
            sleep 1
            count=$((count + 1))
        done
        
        # Se ainda estiver rodando, força com SIGKILL
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "   Forçando encerramento na porta $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    fi
}

# Limpa processos antigos com graceful shutdown
echo "🧹 Limpando processos..."
echo "   Encerrando npm run dev..."
pkill -TERM -f "npm run dev" 2>/dev/null
echo "   Encerrando ngrok..."
pkill -TERM -f ngrok 2>/dev/null

# Graceful shutdown para cada porta
graceful_shutdown 9000
graceful_shutdown 8080
graceful_shutdown 8081

sleep 2

# Inicia os servidores (com reinicialização forçada)
echo "📦 Iniciando servidores (configuração atualizada)..."
npm run dev > /dev/null 2>&1 &
DEV_PID=$!

# Aguarda servidores iniciarem
echo "⏳ Aguardando inicialização (10 segundos)..."
sleep 10

# Verifica se frontend está rodando
if ! lsof -ti:9000 >/dev/null 2>&1; then
    echo "❌ Erro ao iniciar servidores!"
    exit 1
fi

echo "✅ Servidores rodando!"
echo ""

# Inicia ngrok DIRETO no frontend
echo "🌐 Abrindo acesso remoto..."
echo ""

# Mostra informações
cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 ACESSO REMOTO ATIVADO!

   URL: https://www.claudecode.ngrok.app

   Status: Conectando...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛑 Pressione Ctrl+C para parar

EOF

# Função de limpeza
cleanup() {
    echo -e "\n👋 Encerrando..."
    kill $DEV_PID 2>/dev/null
    pkill -f ngrok 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

# Inicia ngrok com URL fixa (sem domínio personalizado)
ngrok http 9000