#!/bin/bash

# Script para resetar autenticação do Claude Code UI

echo "🔐 Resetando autenticação do Claude Code UI"
echo "========================================="
echo ""

# Para todos os processos
echo "Parando serviços..."
pkill -f "npm run dev" 2>/dev/null
pkill -f "node server" 2>/dev/null
pkill -f "cargo run" 2>/dev/null
sleep 2

# Remove bancos de dados antigos
echo "Removendo bancos de dados antigos..."
rm -f data/*.db
rm -f *.db

echo ""
echo "✅ Reset concluído!"
echo ""
echo "Próximos passos:"
echo "1. Execute: ./iniciar.sh"
echo "2. Acesse: http://localhost:9000"
echo "3. Crie um novo usuário administrador"
echo ""
echo "Requisitos mínimos:"
echo "- Username: mínimo 3 caracteres"
echo "- Password: mínimo 6 caracteres"