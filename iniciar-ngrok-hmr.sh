#!/bin/bash

# Claude Code UI - Script de Inicialização com Ngrok e HMR melhorado
# Este script configura o HMR do Vite para funcionar corretamente com ngrok

clear
echo "🚀 Claude Code UI - Inicialização com Ngrok (HMR Otimizado)"
echo "==========================================================="
echo ""

# Função para graceful shutdown
graceful_shutdown() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo "   Encerrando processos na porta $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 1
    fi
}

# Limpa processos antigos
echo "🧹 Limpando processos anteriores..."
pkill -TERM -f "npm run dev" 2>/dev/null
pkill -TERM -f ngrok 2>/dev/null
pkill -TERM -f "cargo run" 2>/dev/null

graceful_shutdown 9000
graceful_shutdown 8080
graceful_shutdown 8081

sleep 2

# Verifica dependências
echo "📋 Verificando dependências..."

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
    pkill -f "npm run dev" 2>/dev/null
    pkill -f ngrok 2>/dev/null
    graceful_shutdown 9000
    graceful_shutdown 8080  
    graceful_shutdown 8081
    echo "✅ Tudo encerrado com sucesso!"
    exit 0
}

trap cleanup EXIT INT TERM

# Inicia os servidores
echo ""
echo "🚀 Iniciando servidores..."

# Inicia com variável de ambiente para indicar que está usando ngrok
export VITE_USE_NGROK=true
npm run dev &
DEV_PID=$!

# Aguarda servidores iniciarem
echo "⏳ Aguardando inicialização..."
for i in {1..30}; do
    if lsof -ti:8080 >/dev/null 2>&1 && lsof -ti:9000 >/dev/null 2>&1; then
        echo "✅ Servidores rodando!"
        break
    fi
    sleep 1
done

# Inicia ngrok em background e captura a URL
echo ""
echo "🌐 Iniciando Ngrok..."
ngrok start claudecodeui > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Aguarda ngrok iniciar e pega a URL
sleep 3
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    # Tenta com domínio fixo se configurado
    NGROK_URL="https://www.claudecode.ngrok.app"
fi

# Mostra informações
cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 ACESSO LOCAL E REMOTO ATIVADO!

   Local:  http://localhost:9000
   Remoto: $NGROK_URL
   
   Status dos Serviços:
   - Frontend (Vite): ✅ Porta 9000 (HMR ativo)
   - Backend (Node):  ✅ Porta 8080
   
   ⚡ Hot Reload está funcionando em ambas URLs!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Pressione Ctrl+C para parar tudo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

# Mantém o script rodando
wait $DEV_PID