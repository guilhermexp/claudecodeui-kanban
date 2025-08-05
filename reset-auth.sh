#!/bin/bash

# Script para resetar autenticação do Claude Code UI
clear
echo "🔐 Reset de Autenticação - Claude Code UI"
echo "========================================="
echo ""

# Função para confirmar ação
confirm() {
    read -p "$1 (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "❌ Operação cancelada."
        exit 0
    fi
}

echo "⚠️  ATENÇÃO: Este script irá:"
echo "   - Remover o banco de dados de autenticação"
echo "   - Limpar tokens salvos no navegador"
echo "   - Permitir novo cadastro de senha"
echo ""

confirm "Deseja continuar?"

echo ""
echo "🗑️  Removendo banco de dados..."

# Remove o banco de dados
DB_PATH="server/database/auth.db"
if [ -f "$DB_PATH" ]; then
    rm -f "$DB_PATH"
    echo "✅ Banco de dados removido"
else
    echo "ℹ️  Banco de dados não encontrado"
fi

# Remove backup se existir
if [ -f "${DB_PATH}.backup" ]; then
    rm -f "${DB_PATH}.backup"
    echo "✅ Backup removido"
fi

echo ""
echo "🧹 Limpando localStorage..."
echo ""
echo "Para completar o reset, você precisa:"
echo ""
echo "1. Abrir o navegador em http://localhost:9000"
echo "2. Abrir o Console (F12 > Console)"
echo "3. Executar os comandos:"
echo ""
echo "   localStorage.removeItem('auth-token');"
echo "   localStorage.removeItem('auth-user');"
echo "   localStorage.clear();"
echo "   location.reload();"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Reset concluído!"
echo ""
echo "Agora você pode:"
echo "1. Iniciar o servidor: npm run dev"
echo "2. Acessar http://localhost:9000"
echo "3. Cadastrar uma nova senha"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"