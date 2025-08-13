#!/bin/bash

set -euo pipefail

echo "🚀 Iniciando Claude Code UI (PRODUÇÃO) em background..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Configurações
SERVER_PORT=8080
VIBE_PORT=8081
DOMAIN="claudecode.ngrok.app"

# Localiza binário do ngrok
NGROK_BIN="${NGROK_BIN:-}"
if [ -z "${NGROK_BIN}" ]; then
  if command -v ngrok >/dev/null 2>&1; then
    NGROK_BIN="$(command -v ngrok)"
  elif [ -x "/opt/homebrew/bin/ngrok" ]; then
    NGROK_BIN="/opt/homebrew/bin/ngrok"
  else
    echo "❌ ngrok não encontrado. Instale com 'brew install ngrok' ou ajuste a variável NGROK_BIN."
    exit 1
  fi
fi

# Verifica e para modo desenvolvimento se necessário
echo "🔍 Verificando modo atual..."
if command -v node >/dev/null 2>&1 && [ -f "scripts/port-management.js" ]; then
  CURRENT_MODE=$(node scripts/port-management.js detect 2>/dev/null | grep "Current mode:" | cut -d: -f2 | xargs || echo "UNKNOWN")
  
  if [ "$CURRENT_MODE" = "DEVELOPMENT" ]; then
    echo "⚠️  Modo desenvolvimento detectado. Parando para evitar conflitos..."
    node scripts/port-management.js stop-dev
    sleep 3
  elif [ "$CURRENT_MODE" = "MIXED" ]; then
    echo "⚠️  Processos conflitantes detectados. Limpando..."
    node scripts/port-management.js stop-all
    sleep 3
  fi
fi

# Mata processos anteriores (método tradicional como backup)
echo "🧹 Limpando processos anteriores..."
pkill -f "node.*server/index.js" 2>/dev/null || true
pkill -f "cargo.*vibe-kanban" 2>/dev/null || true
pkill -f "vibe-kanban.*target/release" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 2

# Gera build do frontend
echo "📦 Gerando build do frontend (vite build)..."
npm run build

# Inicia servidor Node (serve dist em 8080)
export NODE_ENV=production
nohup npm run server > prod-server.log 2>&1 &
SERVER_PID=$!
echo "🟢 Server (Node) iniciado na porta ${SERVER_PORT} (PID: ${SERVER_PID})"

# Inicia Vibe Kanban (Rust) em 8081 se existir
if [ -d "vibe-kanban/backend" ]; then
  echo "🦀 Iniciando Vibe Kanban (Rust) na porta ${VIBE_PORT}..."
  (cd vibe-kanban/backend && PORT=${VIBE_PORT} VIBE_NO_BROWSER=true nohup cargo run --release > "${ROOT_DIR}/prod-vibe.log" 2>&1 & echo $! > "${ROOT_DIR}/.vibe.pid")
  if [ -f .vibe.pid ]; then
    VIBE_PID=$(cat .vibe.pid || true)
    rm -f .vibe.pid || true
    echo "🟣 Vibe Kanban iniciado (PID: ${VIBE_PID})"
  else
    echo "⚠️  Não foi possível capturar o PID do Vibe Kanban (verifique prod-vibe.log)"
  fi
else
  echo "⚠️  Diretório 'vibe-kanban/backend' não encontrado. Pulando Vibe Kanban."
fi

# Aguarda servidor ficar pronto (até 30s)
echo "⏳ Aguardando server (health) ficar pronto..."
for i in {1..30}; do
  if curl -sf "http://localhost:${SERVER_PORT}/api/health" >/dev/null; then
    echo "✅ Server OK"
    break
  fi
  sleep 1
done

# Inicia túnel ngrok para o servidor Node (8080) com verificação e retry
echo "🔒 Iniciando túnel ngrok -> http://localhost:${SERVER_PORT}"
nohup "${NGROK_BIN}" http --domain="${DOMAIN}" ${SERVER_PORT} > "${ROOT_DIR}/prod-ngrok.log" 2>&1 &
NGROK_PID=$!
echo "🛡️  Ngrok iniciado (PID: ${NGROK_PID})"

# Aguarda ngrok conectar (até 30s)
echo "⏳ Aguardando ngrok conectar..."
for i in {1..30}; do
  if curl -sf "http://localhost:4040/api/tunnels" | grep -q "${SERVER_PORT}"; then
    echo "✅ Ngrok conectado"
    break
  fi
  sleep 1
done

echo ""
echo "✅ Ambiente de PRODUÇÃO rodando em background!"
echo "🌐 URL pública: https://${DOMAIN}/"
echo "📊 Dashboard ngrok: http://localhost:4040"
echo ""
echo "📜 Logs:"
echo "  - Servidor: tail -f prod-server.log"
echo "  - Vibe:     tail -f prod-vibe.log"
echo "  - Ngrok:    tail -f prod-ngrok.log"
echo ""
echo "⏹️  Para parar tudo:"
echo "  pkill -f 'node.*server' && pkill -f 'vibe-kanban' && pkill ngrok"
echo ""
echo "ℹ️  Dica: use sempre a URL sem 'www': https://${DOMAIN}/"