# 🐳 Cloud Kanban - Instalação Docker

## Configuração Rápida (5 minutos)

### 1. Pré-requisitos
- Docker Desktop instalado ([Download](https://www.docker.com/products/docker-desktop))
- Conta no ngrok ([Criar conta gratuita](https://ngrok.com/))
- Claude API Key ([Obter key](https://console.anthropic.com/))

### 2. Configuração Inicial

```bash
# Clone o repositório (se ainda não tiver)
git clone <seu-repo>
cd cloud-kanban

# Copie o arquivo de configuração
cp .env.docker.example .env.docker

# Edite o arquivo .env.docker e adicione:
# - CLAUDE_API_KEY=sk-ant-api03-xxxxx
# - NGROK_AUTHTOKEN=xxxxx
# - JWT_SECRET=um-secret-seguro
```

### 3. Iniciar Aplicação

```bash
# Dar permissão aos scripts
chmod +x scripts/*.sh

# Iniciar tudo
./scripts/start-docker.sh
```

Pronto! 🎉 Acesse:
- **Local**: http://localhost:9000
- **Público**: URL mostrada no terminal (ngrok)

## Comandos Úteis

```bash
# Parar aplicação
./scripts/stop-docker.sh

# Ver logs
./scripts/docker-logs.sh

# Ver logs de serviço específico
./scripts/docker-logs.sh backend
./scripts/docker-logs.sh frontend
./scripts/docker-logs.sh vibe-kanban
./scripts/docker-logs.sh ngrok

# Reiniciar serviço
docker compose restart backend

# Limpar tudo (CUIDADO: apaga dados)
docker compose down -v
```

## Estrutura dos Containers

| Container | Porta | Descrição |
|-----------|-------|-----------|
| frontend | 9000 | Interface React |
| backend | 8080 | API Node.js + Terminal |
| vibe-kanban | 8081 | Task Manager (Rust) |
| ngrok | 4040 | Dashboard do túnel |

## Desenvolvimento Local

Para desenvolvimento com hot-reload:

```bash
# Usar compose de desenvolvimento
docker compose -f docker-compose.dev.yml up
```

## Solução de Problemas

### Container não inicia
```bash
# Ver logs detalhados
docker compose logs backend -f

# Reconstruir imagens
docker compose build --no-cache
```

### Ngrok não conecta
1. Verifique o NGROK_AUTHTOKEN no .env.docker
2. Acesse http://localhost:4040 para ver status
3. Verifique limites da conta gratuita

### Terminal não funciona
O terminal roda DENTRO do container Docker, não na sua máquina local.
Para executar comandos locais, use:
```bash
docker compose exec backend bash
```

### Dados perdidos após reiniciar
Os dados são salvos em volumes Docker. Para backup:
```bash
# Backup
docker run --rm -v cloud-kanban_claude-projects:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data

# Restore
docker run --rm -v cloud-kanban_claude-projects:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /
```

## Configuração Avançada

### Domínio Fixo no Ngrok
1. Crie conta paga no ngrok
2. Reserve um domínio
3. Adicione no .env.docker:
```env
NGROK_DOMAIN=seu-app.ngrok-free.app
```

### Auto-start no Boot (Linux/Mac)
```bash
# Adicionar ao crontab
@reboot cd /path/to/cloud-kanban && ./scripts/start-docker.sh
```

### Auto-start no Boot (Windows)
Use o Task Scheduler para executar `start-docker.sh` na inicialização.

## Segurança

⚠️ **IMPORTANTE**:
- Mude o JWT_SECRET padrão
- Use senhas fortes
- Mantenha CLAUDE_API_KEY segura
- Configure firewall se expor portas

## Suporte

Problemas? Abra uma issue no GitHub ou consulte a documentação completa.