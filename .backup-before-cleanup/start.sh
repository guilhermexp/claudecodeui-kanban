#!/bin/bash

# Claude Code UI - URL Fixa (sem domínio personalizado)

clear
echo "🚀 Claude Code UI - URL Fixa ngrok"
echo "==================================="
echo ""

# Limpa processos antigos
pkill -f "npm run dev" 2>/dev/null
pkill -f ngrok 2>/dev/null
lsof -ti:9000,8080,8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Inicia servidor
echo "📦 Iniciando servidor..."
npm run dev > dev.log 2>&1 &
DEV_PID=$!

echo "⏳ Aguardando inicialização..."
sleep 10

# Verifica se iniciou
if ! lsof -ti:9000 >/dev/null 2>&1; then
    echo "❌ Erro ao iniciar servidor!"
    exit 1
fi

echo "✅ Servidor rodando!"
echo ""

# Função de limpeza
cleanup() {
    echo -e "\n👋 Encerrando..."
    kill $DEV_PID 2>/dev/null
    pkill -f ngrok 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

echo "🌐 Iniciando ngrok com URL fixa..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 SUA URL FIXA APARECERÁ ABAIXO:"
echo ""
echo "Procure por: https://[codigo-fixo].ngrok-free.app"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Dicas:"
echo "• A URL será sempre a mesma enquanto você"
echo "  mantiver sua conta ngrok"
echo "• Salve a URL nos favoritos do celular"
echo "• Funciona de qualquer lugar"
echo ""
echo "🛑 Pressione Ctrl+C para parar"
echo ""

# Inicia ngrok com configuração que mantém URL fixa
ngrok http 9000 --authtoken=2zgsJ084oO0vw07DFGtRhOsbA1b_7aAKmSfic2fpqskF6qqwP