#!/bin/bash

# Script para iniciar ngrok com domínio personalizado
# URL: https://claudecode.ngrok.app/

echo "🔒 Iniciando túnel HTTPS com ngrok..."
echo ""
echo "📡 URL personalizada: https://claudecode.ngrok.app/"
echo ""

# Verifica se o ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não está instalado!"
    echo ""
    echo "Para instalar:"
    echo "  brew install ngrok"
    echo "ou"
    echo "  npm install -g ngrok"
    echo ""
    exit 1
fi

# Porta do frontend
PORT=9000

echo "🚀 Iniciando túnel na porta $PORT..."
echo ""
echo "Acessível em: https://claudecode.ngrok.app/"
echo ""
echo "✅ Microfone funcionará em dispositivos móveis (HTTPS)"
echo ""
echo "Pressione Ctrl+C para parar o túnel"
echo "----------------------------------------"
echo ""

# Inicia o ngrok com domínio personalizado
ngrok http --domain=claudecode.ngrok.app $PORT