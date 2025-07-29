#!/bin/bash

# Script para iniciar ngrok com domínio fixo

echo "🌐 Iniciando ngrok com domínio fixo..."

# Verifica se o ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não está instalado. Por favor, instale primeiro."
    exit 1
fi

# Inicia o túnel com o nome configurado no ngrok.yml
echo "📡 Iniciando túnel para claudecodeui..."
ngrok start claudecodeui

# Nota: Se você quiser usar um subdomínio personalizado (recurso pago),
# você precisa primeiro reservá-lo no dashboard do ngrok em:
# https://dashboard.ngrok.com/cloud-edge/domains
#
# Depois, atualize o arquivo ngrok.yml com:
# domain: seu-subdominio.ngrok-free.app
# ou
# domain: seu-dominio-customizado.com (se você configurou um domínio próprio)