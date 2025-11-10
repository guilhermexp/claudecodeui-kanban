#!/bin/bash

# Script rápido de teste do Gemini
echo "🧪 Teste Rápido da Integração Gemini"
echo "===================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar variáveis de ambiente
echo -e "\n📋 Verificando configuração..."

if [ -n "$GEMINI_API_KEY" ] || [ -n "$GOOGLE_API_KEY" ]; then
    echo -e "${GREEN}✅ Chave API configurada${NC}"
else
    echo -e "${YELLOW}⚠️  Chave API não encontrada${NC}"
    echo "   Configure GEMINI_API_KEY ou GOOGLE_API_KEY no .env"
    echo "   Obtenha em: https://makersuite.google.com/app/apikey"
fi

# Verificar Python e google-genai
echo -e "\n📦 Verificando dependências..."

if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✅ Python3 instalado${NC}"
    
    if python3 -c "import google.genai" 2>/dev/null; then
        echo -e "${GREEN}✅ google-genai instalado${NC}"
    else
        echo -e "${YELLOW}⚠️  google-genai não instalado${NC}"
        echo "   Instale com: pip3 install --user --break-system-packages google-genai"
    fi
else
    echo -e "${RED}❌ Python3 não encontrado${NC}"
fi

# Verificar servidor
echo -e "\n🌐 Verificando servidor..."

if curl -s http://localhost:7347/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor rodando na porta 7347${NC}"
else
    echo -e "${RED}❌ Servidor não está rodando${NC}"
    echo "   Execute: npm run dev"
    exit 1
fi

# Teste simples de análise (sem autenticação para teste rápido)
echo -e "\n🤖 Testando endpoint de análise..."

TEST_CONTENT='# Exemplo
Crie um componente React
{nome}: Nome do usuário
```javascript
console.log("test");
```
API_KEY=test123'

# Criar token dummy para teste
TOKEN="dummy_test_token"

RESPONSE=$(curl -s -X POST http://localhost:7347/api/ai/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"content\": \"$TEST_CONTENT\"}" 2>/dev/null)

if echo "$RESPONSE" | grep -q "source"; then
    SOURCE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('source', 'unknown'))" 2>/dev/null)
    
    if [ "$SOURCE" = "gemini" ]; then
        echo -e "${GREEN}✅ Análise com Gemini funcionando${NC}"
    elif [ "$SOURCE" = "local" ] || [ "$SOURCE" = "local-fallback" ]; then
        echo -e "${YELLOW}⚠️  Usando análise local (fallback)${NC}"
        echo "   Verifique a configuração da chave API"
    else
        echo -e "${RED}❌ Resposta inesperada${NC}"
    fi
else
    echo -e "${RED}❌ Endpoint não respondeu corretamente${NC}"
    echo "   Resposta: $RESPONSE"
fi

echo -e "\n===================================="
echo "📊 Resumo:"

if [ -n "$GEMINI_API_KEY" ] || [ -n "$GOOGLE_API_KEY" ]; then
    if python3 -c "import google.genai" 2>/dev/null; then
        echo -e "${GREEN}✅ Sistema pronto para usar Gemini${NC}"
        echo ""
        echo "Próximos passos:"
        echo "1. Abra a aplicação: http://localhost:5892"
        echo "2. Vá para PromptsHub (ícone no canto direito)"
        echo "3. Cole conteúdo e veja a análise automática"
        echo "4. Use 'Summarize' e 'Speak' nos índices de repositórios"
    else
        echo -e "${YELLOW}⚠️  Instale google-genai para TTS${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Configure a chave API para ativar Gemini${NC}"
    echo ""
    echo "1. Copie .env.gemini-test para .env"
    echo "2. Adicione sua chave API"
    echo "3. Reinicie o servidor (npm run dev)"
fi