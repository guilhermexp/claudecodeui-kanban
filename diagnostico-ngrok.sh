#!/bin/bash

# Script de diagnóstico para problema do ngrok

clear
echo "🔍 Diagnóstico Ngrok - Claude Code UI"
echo "====================================="
echo ""

# 1. Verifica versão do ngrok
echo "1️⃣ Versão do Ngrok:"
ngrok version
echo ""

# 2. Verifica configuração do ngrok
echo "2️⃣ Configuração do Ngrok:"
echo "   Config path: ~/Library/Application Support/ngrok/ngrok.yml"
if [ -f "$HOME/Library/Application Support/ngrok/ngrok.yml" ]; then
    echo "   ✅ Arquivo de configuração encontrado"
    echo "   Tunnel configurado: claudecodeui -> localhost:9000"
else
    echo "   ❌ Arquivo de configuração não encontrado"
fi
echo ""

# 3. Verifica se há processos ngrok rodando
echo "3️⃣ Processos Ngrok ativos:"
ps aux | grep -v grep | grep ngrok || echo "   Nenhum processo ngrok encontrado"
echo ""

# 4. Verifica portas em uso
echo "4️⃣ Status das portas:"
echo -n "   Frontend (9000): "
lsof -ti:9000 >/dev/null 2>&1 && echo "✅ Em uso" || echo "❌ Livre"
echo -n "   Backend (8080): "
lsof -ti:8080 >/dev/null 2>&1 && echo "✅ Em uso" || echo "❌ Livre"
echo ""

# 5. Testa resposta do frontend
echo "5️⃣ Teste de resposta do Frontend:"
if lsof -ti:9000 >/dev/null 2>&1; then
    echo "   Testando http://localhost:9000..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9000)
    echo "   Código HTTP: $RESPONSE"
    
    if [[ "$RESPONSE" == "200" ]] || [[ "$RESPONSE" == "304" ]]; then
        echo "   ✅ Frontend respondendo corretamente"
        
        # Pega um trecho do HTML para verificar versão
        echo ""
        echo "   Preview do HTML:"
        curl -s http://localhost:9000 | head -n 20 | grep -E "(title|script|Claude)" | sed 's/^/   /'
    else
        echo "   ❌ Frontend não está respondendo corretamente"
    fi
else
    echo "   ❌ Frontend não está rodando"
fi
echo ""

# 6. Verifica cache do navegador
echo "6️⃣ Possíveis soluções para cache:"
echo "   • Force refresh no navegador: Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows/Linux)"
echo "   • Limpe o cache do navegador completamente"
echo "   • Teste em uma aba anônima/privada"
echo "   • Adicione um parâmetro de query: ?v=$(date +%s)"
echo ""

# 7. Sugestão de comando ngrok
echo "7️⃣ Comandos sugeridos:"
echo ""
echo "   Opção 1 - Usar domínio configurado:"
echo "   ngrok start claudecodeui"
echo ""
echo "   Opção 2 - Ngrok direto (novo URL a cada vez):"
echo "   ngrok http 9000"
echo ""
echo "   Opção 3 - Ngrok com headers customizados:"
echo "   ngrok http 9000 --host-header=rewrite"
echo ""

# 8. Verifica se Vite está em modo desenvolvimento
echo "8️⃣ Verificando modo do Vite:"
if ps aux | grep -v grep | grep -q "vite.*--host"; then
    echo "   ✅ Vite rodando em modo network (--host)"
else
    echo "   ⚠️  Vite pode não estar acessível externamente"
    echo "   Certifique-se que está usando: npm run dev (que inclui --host)"
fi