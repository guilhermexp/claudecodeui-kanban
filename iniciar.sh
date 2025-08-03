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

# Inicia o script dev.js que gerencia todos os serviços
npm run dev &
DEV_PID=$!

# Aguarda servidores iniciarem com feedback
echo "⏳ Aguardando inicialização..."
sleep 3  # Tempo inicial para processos começarem

# Verifica servidores em loop com timeout maior
for i in {1..30}; do
    SERVER_UP=$(lsof -ti:8080 >/dev/null 2>&1 && echo "true" || echo "false")
    CLIENT_UP=$(lsof -ti:9000 >/dev/null 2>&1 && echo "true" || echo "false")
    
    if [ "$SERVER_UP" = "true" ] && [ "$CLIENT_UP" = "true" ]; then
        echo "✅ Servidores principais rodando!"
        echo "   - Backend (Node.js): ✅ Porta 8080"
        echo "   - Frontend (Vite): ✅ Porta 9000"
        break
    elif [ "$SERVER_UP" = "true" ]; then
        echo "   Backend iniciado, aguardando frontend... ($i/30)"
    elif [ "$CLIENT_UP" = "true" ]; then
        echo "   Frontend iniciado, aguardando backend... ($i/30)"
    else
        echo "   Aguardando serviços... ($i/30)"
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
    
    # Para o processo dev.js principal
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null
        echo "   Parando processo principal..."
    fi
    
    # Para o ngrok
    pkill -f ngrok 2>/dev/null
    echo "   Parando ngrok..."
    
    # Para processos específicos das portas
    graceful_shutdown 9000
    graceful_shutdown 8080  
    graceful_shutdown 8081
    
    # Para processos npm/node/cargo que possam ter ficado
    pkill -f "npm run dev" 2>/dev/null
    pkill -f "node scripts/dev.js" 2>/dev/null
    pkill -f "cargo run" 2>/dev/null
    
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
echo "💡 Dica: Se o hot reload não funcionar via ngrok:"
echo "   1. Use Ctrl+Shift+R (ou Cmd+Shift+R no Mac) para forçar reload"
echo "   2. Ou desative o cache nas DevTools (F12 > Network > Disable cache)"
echo ""

# Inicia ngrok com domínio fixo configurado
ngrok start claudecodeui