#!/bin/bash

echo "🎤 Configuração do Whisper (Voice-to-Text)"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env a partir do .env.example..."
    cp .env.example .env
    echo "✅ Arquivo .env criado!"
else
    echo "📋 Arquivo .env já existe."
fi

echo ""
echo "⚠️  IMPORTANTE: Segurança da API Key"
echo "======================================"
echo "1. NUNCA compartilhe sua chave da API publicamente"
echo "2. Se você acidentalmente expôs sua chave, revogue-a imediatamente em:"
echo "   https://platform.openai.com/api-keys"
echo "3. Crie uma nova chave e use-a no lugar"
echo ""

# Check if OPENAI_API_KEY is already set in .env
if grep -q "^OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    echo "✅ OPENAI_API_KEY já está configurada no .env"
    echo ""
    echo "🎤 O botão de voz no terminal está pronto para uso!"
    echo "   - Conecte-se ao terminal"
    echo "   - Clique no botão flutuante azul/roxo"
    echo "   - Fale seu comando!"
else
    echo "❌ OPENAI_API_KEY não está configurada"
    echo ""
    echo "Para configurar manualmente:"
    echo "1. Abra o arquivo .env"
    echo "2. Substitua 'your_openai_api_key_here' pela sua chave"
    echo "3. Salve o arquivo"
    echo "4. Reinicie o servidor"
    echo ""
    echo "Ou execute:"
    echo "export OPENAI_API_KEY='sua-chave-aqui' (temporário)"
fi

echo ""
echo "📚 Documentação completa em: WHISPER_SETUP.md"