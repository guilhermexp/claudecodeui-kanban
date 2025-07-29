#!/bin/bash

# Script para iniciar ngrok com domínio customizado fixo

echo "🌐 Claude Code UI - Ngrok com Domínio Fixo"
echo "=========================================="
echo ""

# Verifica se o ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não está instalado. Por favor, instale primeiro."
    echo "   Visite: https://ngrok.com/download"
    exit 1
fi

# Verifica se o servidor está rodando
echo "🔍 Verificando se o servidor está rodando na porta 9000..."
if ! nc -z localhost 9000 2>/dev/null; then
    echo "⚠️  Servidor não está rodando na porta 9000"
    echo "   Execute primeiro: npm run dev"
    echo ""
    read -p "Deseja iniciar o servidor agora? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "🚀 Iniciando servidor..."
        cd "$(dirname "$0")/.." && npm run dev &
        sleep 5
    else
        exit 1
    fi
fi

# Inicia o ngrok com o domínio fixo
echo ""
echo "📡 Iniciando túnel ngrok..."
echo "🔗 Seu app estará disponível em: https://www.claudecode.ngrok.app"
echo ""
echo "✅ Este é um domínio FIXO - sempre será o mesmo!"
echo "🔒 HTTPS habilitado automaticamente"
echo ""
echo "Pressione Ctrl+C para parar o túnel"
echo "=========================================="
echo ""

# Inicia o túnel
ngrok start claudecodeui