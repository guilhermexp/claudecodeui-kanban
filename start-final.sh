#!/bin/bash

# Script FINAL - Funcionamento completo garantido

clear
echo "🚀 Claude Code UI + Vibe Kanban - Completo"
echo "=========================================="
echo ""

BASE_DIR="<home>/Downloads/claudecodeui-main"
cd "$BASE_DIR"

# Mata processos
echo "🧹 Limpando processos..."
pkill -f "npm" 2>/dev/null
pkill -f "node" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "cargo" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
lsof -ti:9000,8080,8081 | xargs kill -9 2>/dev/null || true

sleep 2

# 1. Backend Claude (8080)
echo "1️⃣ Iniciando Backend Claude Code UI..."
PORT=8080 node server/index.js &
PID1=$!

# 2. Backend Vibe (8081) - usando desenvolvimento rápido
echo "2️⃣ Iniciando Backend Vibe Kanban..."
cd vibe-kanban/backend
# Usa a build que já compilamos!
if [ -f "target/debug/vibe-kanban" ]; then
    echo "   ✅ Usando build existente (rápido)"
    PORT=8081 ./target/debug/vibe-kanban &
else
    echo "   🔨 Compilando Vibe Kanban (aguarde)..."
    PORT=8081 cargo run &
fi
PID2=$!
cd ../..

# 3. Frontend (9000)
echo "3️⃣ Iniciando Frontend..."
VITE_PORT=9000 npx vite --host --port 9000 &
PID3=$!

echo ""
echo "⏳ Aguardando serviços iniciarem..."

# Aguarda mais tempo para o Vibe compilar se necessário
for i in {1..40}; do
    printf "\r   %d segundos..." $((40-i))
    
    # Verifica se o Vibe já está rodando
    if [ $i -gt 10 ] && lsof -ti:8081 >/dev/null 2>&1; then
        echo -e "\r   ✅ Vibe Kanban iniciou!"
        break
    fi
    
    sleep 1
done
echo ""
echo ""

# Verifica status final
echo "🔍 Status dos serviços:"
echo ""

ALL_OK=true

if lsof -ti:9000 >/dev/null 2>&1; then
    echo "✅ Frontend: Rodando (porta 9000)"
else
    echo "❌ Frontend: FALHOU"
    ALL_OK=false
fi

if lsof -ti:8080 >/dev/null 2>&1; then
    echo "✅ Claude Backend: Rodando (porta 8080)"
else
    echo "❌ Claude Backend: FALHOU"
    ALL_OK=false
fi

if lsof -ti:8081 >/dev/null 2>&1; then
    echo "✅ Vibe Backend: Rodando (porta 8081)"
else
    echo "❌ Vibe Backend: FALHOU"
    ALL_OK=false
fi

echo ""

if [ "$ALL_OK" = true ]; then
    echo "🎉 TODOS OS SERVIÇOS FUNCIONANDO!"
else
    echo "⚠️  Alguns serviços falharam"
fi

echo ""
echo "🌐 Iniciando ngrok..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 SUA URL FIXA APARECERÁ ABAIXO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cleanup() {
    echo -e "\n\n👋 Encerrando todos os serviços..."
    kill $PID1 $PID2 $PID3 2>/dev/null
    pkill -f ngrok 2>/dev/null
    pkill -f vibe-kanban 2>/dev/null
    echo "✅ Encerrado!"
}

trap cleanup EXIT INT TERM

ngrok http 9000 --authtoken=2zgsJ084oO0vw07DFGtRhOsbA1b_7aAKmSfic2fpqskF6qqwP