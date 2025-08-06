#!/bin/bash

# Claude Code UI - Script de Inicialização com Ngrok (Modo Dev Otimizado)
# Este script força atualizações mais agressivas para desenvolvimento via ngrok

clear
echo "🚀 Claude Code UI - Modo Dev com Ngrok Otimizado"
echo "================================================"
echo ""

# Função para graceful shutdown
graceful_shutdown() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo "   Encerrando processos na porta $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 1
        
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "   Forçando encerramento na porta $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    fi
}

# Limpa processos antigos
echo "🧹 Limpando processos anteriores..."
pkill -TERM -f "npm run dev" 2>/dev/null
pkill -TERM -f ngrok 2>/dev/null
pkill -TERM -f "cargo run" 2>/dev/null

# Limpa portas
graceful_shutdown 9000
graceful_shutdown 8080
graceful_shutdown 8081

sleep 2

# Verifica dependências básicas
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    exit 1
fi

if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok não está instalado!"
    exit 1
fi

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Função de limpeza
cleanup() {
    echo -e "\n\n👋 Encerrando Claude Code UI..."
    
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null
    fi
    
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null
    fi
    
    pkill -f ngrok 2>/dev/null
    pkill -f "npm run dev" 2>/dev/null
    
    graceful_shutdown 9000
    graceful_shutdown 8080
    graceful_shutdown 8081
    
    echo "✅ Tudo encerrado!"
    exit 0
}

trap cleanup EXIT INT TERM

# Configura variáveis de ambiente para melhor compatibilidade com ngrok
export VITE_FORCE_OPTIMIZE_DEPS=true
export VITE_LEGACY_BROWSER_SUPPORT=true
export VITE_NGROK_DOMAIN=https://www.claudecode.ngrok.app

echo ""
echo "🚀 Iniciando servidores com otimizações para ngrok..."
echo ""

# Inicia os servidores com flag especial
npm run dev &
DEV_PID=$!

# Aguarda servidores
echo "⏳ Aguardando servidores..."
for i in {1..30}; do
    if lsof -ti:8080 >/dev/null 2>&1 && lsof -ti:9000 >/dev/null 2>&1; then
        echo "✅ Servidores prontos!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Inicia ngrok
echo ""
echo "🌐 Iniciando Ngrok..."

# Mata sessões antigas do ngrok
pkill -f "ngrok.*claudecodeui" 2>/dev/null
sleep 1

# Inicia ngrok
ngrok start claudecodeui &
NGROK_PID=$!

# Aguarda ngrok
echo "⏳ Conectando ao ngrok..."
for i in {1..15}; do
    sleep 1
    if curl -s http://localhost:4040/api/tunnels >/dev/null 2>&1; then
        echo " Conectado!"
        break
    fi
    echo -n "."
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLAUDE CODE UI - PRONTO!"
echo ""
echo "🌐 Acesso:"
echo "   Local:  http://localhost:9000"
echo "   Remoto: https://www.claudecode.ngrok.app"
echo ""
echo "🔄 IMPORTANTE - Para atualizar mudanças via ngrok:"
echo ""
echo "   MÉTODO 1 (Recomendado):"
echo "   1. Abra DevTools (F12)"
echo "   2. Vá para aba Network"
echo "   3. Marque ☑️ Disable cache"
echo "   4. Mantenha DevTools aberto enquanto desenvolve"
echo ""
echo "   MÉTODO 2 (Manual):"
echo "   - Pressione Ctrl+Shift+R (forçar reload)"
echo "   - Ou recarregue a página 2x seguidas"
echo ""
echo "📊 Dashboard Ngrok: http://localhost:4040"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Pressione Ctrl+C para parar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Mantém rodando
wait $DEV_PID