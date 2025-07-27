#!/bin/bash

echo "📤 Enviando código para o GitHub..."
echo ""

# Envia o código
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Sucesso! Código enviado para:"
    echo "https://github.com/guilhermexp/claudecodeui-main"
    echo ""
    echo "🔒 Repositório privado criado!"
else
    echo ""
    echo "❌ Erro ao enviar. Verifique se:"
    echo "1. Você criou o repositório no GitHub"
    echo "2. O nome está correto: claudecodeui-main"
    echo "3. Está logado no git"
fi