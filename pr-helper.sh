#!/bin/bash

# Script helper para facilitar trabalho com PRs
# Uso: ./pr-helper.sh [número-da-pr]

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${BLUE}📋 PRs abertas no repositório:${NC}"
    gh pr list || git ls-remote origin 'refs/pull/*/head' | awk -F'/' '{print "PR #" $3}'
    echo ""
    echo -e "${YELLOW}Uso: $0 <número-da-pr>${NC}"
    echo -e "Exemplo: $0 7"
    exit 1
fi

PR_NUMBER=$1

echo -e "${BLUE}🔄 Buscando PR #${PR_NUMBER}...${NC}"

# Fazer checkout da PR
git fetch origin pull/${PR_NUMBER}/head:pr-${PR_NUMBER}

echo -e "${GREEN}✅ PR #${PR_NUMBER} baixada!${NC}"
echo ""
echo -e "${BLUE}Opções disponíveis:${NC}"
echo "1) Testar a PR:     git checkout pr-${PR_NUMBER}"
echo "2) Ver mudanças:    git diff main..pr-${PR_NUMBER}"
echo "3) Fazer merge:     git checkout main && git merge pr-${PR_NUMBER}"
echo "4) Cherry-pick:     git cherry-pick pr-${PR_NUMBER}"
echo ""
echo -e "${YELLOW}Dica: Para fazer merge direto, use:${NC}"
echo "   gh pr merge ${PR_NUMBER}"