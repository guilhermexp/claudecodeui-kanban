# ⚠️ IMPORTANTE - VIBE KANBAN

## REGRA ABSOLUTA

**O VIBE KANBAN DEVE SEMPRE FUNCIONAR!**

- ✅ NUNCA remover funcionalidades do Vibe Kanban
- ✅ NUNCA fazer bypass das rotas do Vibe Kanban
- ✅ NUNCA esconder ou desabilitar features do Vibe Kanban
- ✅ SEMPRE manter o backend rodando na porta 8081
- ✅ SEMPRE verificar se as rotas estão funcionando

## Como Iniciar

```bash
# Opção 1 - Script dedicado
./start-vibe-backend.sh

# Opção 2 - NPM
npm run vibe-backend

# Opção 3 - Tudo junto
npm run dev
```

## Verificação de Funcionamento

```bash
# Verificar se está rodando
curl http://localhost:8081/api/config

# Verificar porta
lsof -i :8081
```

## Rotas Importantes

- `/api/vibe-kanban/config` - Configurações
- `/api/vibe-kanban/projects` - Projetos
- `/api/vibe-kanban/tasks` - Tarefas
- `/api/vibe-kanban/stream` - WebSocket

## Proxy no Vite

O Vite está configurado para fazer proxy de todas as rotas `/api/vibe-kanban/*` para `http://localhost:8081/api/*`.

## ⚠️ ATENÇÃO

Se o usuário tem o Vibe Kanban no projeto, é porque ele QUER USAR!
- Não questione
- Não sugira remover
- Não faça bypass
- FAÇA FUNCIONAR!