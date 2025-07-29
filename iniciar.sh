#!/bin/bash

# Claude Code UI - Script de Inicialização com Ngrok
# Atualizado em: $(date)

clear
echo "🚀 Claude Code UI - Inicialização Completa"
echo "=========================================="
echo ""

# Função para graceful shutdown
graceful_shutdown() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo "   Encerrando processos na porta $port..."
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

# Limpa processos antigos
echo "🧹 Limpando processos anteriores..."
echo "   Encerrando npm run dev..."
pkill -TERM -f "npm run dev" 2>/dev/null
echo "   Encerrando ngrok..."
pkill -TERM -f ngrok 2>/dev/null
echo "   Encerrando processos Rust/Vibe..."
pkill -TERM -f "cargo run" 2>/dev/null

# Graceful shutdown para cada porta
graceful_shutdown 9000  # Frontend Vite
graceful_shutdown 8080  # Backend Node.js
graceful_shutdown 8081  # Vibe Kanban Rust

sleep 2

# Verifica dependências
echo "📋 Verificando dependências..."

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    echo "   Por favor, instale Node.js v18+ de: https://nodejs.org"
    exit 1
fi

# Verifica Rust (opcional para Vibe Kanban)
if command -v cargo &> /dev/null; then
    echo "✅ Rust detectado - Vibe Kanban será iniciado"
    VIBE_ENABLED=true
else
    echo "⚠️  Rust não detectado - Vibe Kanban não será iniciado"
    echo "   Para instalar: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    VIBE_ENABLED=false
fi

# Verifica ngrok
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok não está instalado!"
    echo "   Por favor, instale ngrok de: https://ngrok.com/download"
    exit 1
fi

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Inicia os servidores
echo ""
echo "🚀 Iniciando servidores..."
npm run dev > /dev/null 2>&1 &
DEV_PID=$!

# Aguarda servidores iniciarem
echo "⏳ Aguardando inicialização..."
for i in {1..15}; do
    if lsof -ti:9000 >/dev/null 2>&1 && lsof -ti:8080 >/dev/null 2>&1; then
        echo "✅ Servidores principais rodando!"
        break
    fi
    sleep 1
done

# Verifica se servidores estão rodando
if ! lsof -ti:9000 >/dev/null 2>&1; then
    echo "❌ Erro ao iniciar frontend (porta 9000)!"
    exit 1
fi

if ! lsof -ti:8080 >/dev/null 2>&1; then
    echo "❌ Erro ao iniciar backend (porta 8080)!"
    exit 1
fi

# Função de limpeza
cleanup() {
    echo -e "\n\n👋 Encerrando Claude Code UI..."
    kill $DEV_PID 2>/dev/null
    pkill -f ngrok 2>/dev/null
    graceful_shutdown 9000
    graceful_shutdown 8080
    graceful_shutdown 8081
    echo "✅ Tudo encerrado com sucesso!"
    exit 0
}

trap cleanup EXIT INT TERM

# Inicia ngrok
echo ""
echo "🌐 Iniciando acesso remoto com Ngrok..."
echo ""

# Mostra informações
cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 ACESSO LOCAL E REMOTO ATIVADO!

   Local:  http://localhost:9000
   
   Remoto: Aguardando URL do Ngrok...
   
   Status dos Serviços:
   - Frontend (Vite): ✅ Porta 9000
   - Backend (Node):  ✅ Porta 8080
   - Vibe Kanban:     $(if [ "$VIBE_ENABLED" = true ]; then echo "✅ Porta 8081"; else echo "⏭️  Desativado"; fi)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Pressione Ctrl+C para parar tudo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo ""
echo "🔗 URL do Ngrok aparecerá abaixo:"
echo ""

# Inicia ngrok com domínio fixo configurado
ngrok start claudecodeui