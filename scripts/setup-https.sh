#!/bin/bash

# Script para gerar certificados HTTPS locais
# Permite usar microfone sem depender de túnel externo

echo "🔐 Configurando HTTPS local..."
echo ""

# Criar diretório para certificados
mkdir -p certs
cd certs

# Verificar se certificados já existem
if [ -f "localhost.pem" ] && [ -f "localhost-key.pem" ]; then
    echo "✅ Certificados já existem!"
    echo ""
    exit 0
fi

# Verificar se mkcert está instalado
if ! command -v mkcert &> /dev/null; then
    echo "📦 Instalando mkcert..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install mkcert
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt install libnss3-tools
        wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
        chmod +x mkcert
        sudo mv mkcert /usr/local/bin/
    fi
fi

echo "🔑 Instalando certificado raiz local..."
mkcert -install

echo "📜 Gerando certificados para localhost e IPs locais..."
# Pegar IP local
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

# Gerar certificado para localhost e IP local
mkcert localhost 127.0.0.1 $LOCAL_IP ::1

# Renomear para nomes padrão
mv localhost+3.pem localhost.pem
mv localhost+3-key.pem localhost-key.pem

echo ""
echo "✅ Certificados criados com sucesso!"
echo ""
echo "📱 Você pode acessar via HTTPS em:"
echo "   https://localhost:5892"
echo "   https://$LOCAL_IP:5892"
echo ""
echo "🎤 Microfone funcionará em ambas URLs!"
echo ""