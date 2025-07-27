#!/bin/bash

# Claude Code UI - Solução SIMPLES e DIRETA

clear
echo "🚀 Claude Code UI - Acesso Remoto Simplificado"
echo "=============================================="
echo ""

# Limpa processos antigos
echo "🧹 Limpando processos..."
pkill -f "npm run dev" 2>/dev/null
pkill -f ngrok 2>/dev/null
lsof -ti:9000,8080,8081 | xargs kill -9 2>/dev/null || true

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