#!/bin/bash

# Script de gerenciamento do serviço Claude Code UI

PLIST_NAME="com.claudecode.app"
PLIST_FILE="$(pwd)/com.claudecode.app.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

case "$1" in
    install)
        echo "📦 Instalando serviço Claude Code (produção)..."
        
        # Criar diretório se não existir
        mkdir -p "$LAUNCH_AGENTS_DIR"
        
        # Copiar plist
        cp "$PLIST_FILE" "$LAUNCH_AGENTS_DIR/"
        
        # Carregar serviço
        launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
        
        echo "✅ Serviço instalado e iniciado (auto-start no login)!"
        echo "📡 URL pública: https://claudecode.ngrok.app/"
        echo ""
        echo "O app inicia automaticamente quando você liga o Mac."
        ;;
        
    uninstall)
        echo "🗑️  Removendo serviço Claude Code..."
        
        # Parar e remover serviço
        launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist" 2>/dev/null
        rm -f "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
        
        echo "✅ Serviço removido!"
        ;;
        
    start)
        echo "▶️  Iniciando Claude Code..."
        # kickstart força a execução do job mesmo já carregado (macOS 10.13+)
        if launchctl kickstart -k "gui/$UID/$PLIST_NAME" 2>/dev/null; then
          echo "✅ Serviço iniciado via kickstart!"
        else
          echo "ℹ️  kickstart indisponível, recarregando..."
          launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist" 2>/dev/null || true
          sleep 1
          launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
          echo "✅ Serviço recarregado!"
        fi
        echo "📡 URL pública: https://claudecode.ngrok.app/"
        ;;
        
    stop)
        echo "⏹️  Parando Claude Code..."
        launchctl stop "$PLIST_NAME"
        pkill -f "node.*server/index.js"
        pkill -f "vite"
        pkill -f "cargo.*vibe-kanban"
        pkill -f "ngrok"
        echo "✅ Serviço parado!"
        ;;
        
    restart)
        echo "🔄 Reiniciando Claude Code..."
        # Unload + load garante reexecução do script de inicialização
        launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist" 2>/dev/null || true
        pkill -f "node.*server/index.js" 2>/dev/null || true
        pkill -f "cargo.*vibe-kanban" 2>/dev/null || true
        pkill -f "vibe-kanban.*target/release" 2>/dev/null || true
        pkill -f "ngrok" 2>/dev/null || true
        sleep 1
        launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
        echo "✅ Serviço reiniciado!"
        echo "📡 URL pública: https://claudecode.ngrok.app/"
        ;;
        
    status)
        echo "📊 Status do serviço:"
        launchctl list | grep "$PLIST_NAME" || echo "Serviço não está rodando"
        echo ""
        echo "🔍 Processos ativos:"
        ps aux | grep -E "(node.*server|vite|ngrok|vibe-kanban)" | grep -v grep || echo "Nenhum processo encontrado"
        ;;
        
    logs)
        echo "📜 Logs recentes:"
        echo "--- Output ---"
        tail -20 claudecode.log 2>/dev/null || echo "Sem logs de output"
        echo ""
        echo "--- Erros ---"
        tail -20 claudecode.error.log 2>/dev/null || echo "Sem logs de erro"
        ;;
        
    *)
        echo "Claude Code UI - Gerenciador de Serviço"
        echo ""
        echo "Uso: $0 {install|uninstall|start|stop|restart|status|logs}"
        echo ""
        echo "Comandos:"
        echo "  install   - Instala e inicia o serviço (inicia com o Mac)"
        echo "  uninstall - Remove o serviço completamente"
        echo "  start     - Inicia o serviço manualmente"
        echo "  stop      - Para o serviço"
        echo "  restart   - Reinicia o serviço"
        echo "  status    - Mostra status do serviço"
        echo "  logs      - Mostra logs recentes"
        echo ""
        echo "Após instalar, o app estará disponível em:"
        echo "📡 https://claudecode.ngrok.app/"
        ;;
esac