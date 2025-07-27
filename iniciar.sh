#!/bin/bash

# Script SUPER SIMPLES - Só executar!

# Limpa tela
clear

# Mata tudo que estiver rodando
pkill -f "npm run dev" 2>/dev/null
pkill -f ngrok 2>/dev/null
lsof -ti:9000,8080,8081 | xargs kill -9 2>/dev/null || true

# Espera um pouco
sleep 2

# Executa o script com URL fixa (sem domínio personalizado)
./start.sh