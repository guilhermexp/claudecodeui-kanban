#!/bin/bash

# Script para iniciar o Vibe Kanban backend

echo "🚀 Iniciando Vibe Kanban backend..."

# Verifica se o Rust está instalado
if ! command -v cargo &> /dev/null; then
    echo "❌ Erro: Rust não está instalado!"
    echo "📦 Para instalar o Rust, execute:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Navega para o diretório do backend
cd vibe-kanban/backend || exit 1

# Verifica se já existe um processo rodando na porta 8081
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Vibe Kanban backend já está rodando na porta 8081"
    exit 0
fi

# Inicia o backend
echo "🔨 Compilando e iniciando o backend Rust..."
PORT=8081 cargo run --release
