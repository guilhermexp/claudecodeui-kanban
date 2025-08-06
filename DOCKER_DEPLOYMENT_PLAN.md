# 🐳 Plano de Dockerização do Cloud Kanban

## Objetivo
Containerizar toda a aplicação Cloud Kanban para rodar persistentemente com Docker + ngrok, eliminando a necessidade de iniciar manualmente o terminal toda vez.

## Vantagens desta Abordagem
✅ **Aplicação sempre rodando** - Não precisa abrir terminal  
✅ **Acesso via ngrok** - URL pública persistente  
✅ **Terminal funcional** - Executa no container (ambiente isolado)  
✅ **Fácil manutenção** - `docker-compose up -d` e pronto  
✅ **Backup simples** - Volumes Docker para persistência  
✅ **Portável** - Roda em qualquer máquina com Docker  

## Arquitetura Docker

```
┌─────────────────────────────────────────┐
│           Docker Compose                 │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   Frontend   │  │  Backend Node   │ │
│  │  (Port 9000) │  │  (Port 8080)    │ │
│  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Vibe Kanban  │  │     Ngrok       │ │
│  │  (Port 8081) │  │   (Túnel)       │ │
│  └──────────────┘  └─────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │        Volumes Persistentes         │ │
│  │  - Database  - Projects  - Configs  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Estrutura de Arquivos

```
cloud-kanban/
├── docker/
│   ├── frontend/
│   │   └── Dockerfile
│   ├── backend/
│   │   └── Dockerfile
│   ├── vibe-kanban/
│   │   └── Dockerfile
│   └── ngrok/
│       └── ngrok.yml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.docker
└── scripts/
    ├── start-docker.sh
    └── stop-docker.sh
```

## Implementação Passo a Passo

### Fase 1: Dockerfiles Individuais

#### 1.1 Frontend Dockerfile
```dockerfile
# docker/frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 9000
```

#### 1.2 Backend Node.js Dockerfile
```dockerfile
# docker/backend/Dockerfile
FROM node:20-alpine

# Instalar dependências do sistema para node-pty e Claude CLI
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    curl

# Instalar Claude CLI
RUN npm install -g @anthropic-ai/claude-cli

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server/ ./server/
COPY .env.docker .env

# Criar diretórios necessários
RUN mkdir -p /root/.claude/projects \
    && mkdir -p /app/data \
    && mkdir -p /app/uploads

EXPOSE 8080

CMD ["node", "server/index.js"]
```

#### 1.3 Vibe Kanban Dockerfile
```dockerfile
# docker/vibe-kanban/Dockerfile
FROM rust:1.75 AS builder

WORKDIR /app
COPY vibe-kanban/ .

RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/vibe-kanban /usr/local/bin/

EXPOSE 8081

CMD ["vibe-kanban"]
```

### Fase 2: Docker Compose

#### 2.1 docker-compose.yml Principal
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: 
      context: .
      dockerfile: docker/frontend/Dockerfile
    ports:
      - "9000:9000"
    depends_on:
      - backend
      - vibe-kanban
    networks:
      - cloud-kanban
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_PATH=/app/data/database.sqlite
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - HOST=0.0.0.0
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - claude-projects:/root/.claude/projects
      - claude-config:/root/.claude
    depends_on:
      - vibe-kanban
    networks:
      - cloud-kanban
    restart: unless-stopped

  vibe-kanban:
    build:
      context: .
      dockerfile: docker/vibe-kanban/Dockerfile
    ports:
      - "8081:8081"
    environment:
      - DATABASE_URL=/app/data/database.sqlite
      - PORT=8081
    volumes:
      - ./data:/app/data
    networks:
      - cloud-kanban
    restart: unless-stopped

  ngrok:
    image: ngrok/ngrok:latest
    environment:
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
    command: 
      - "http"
      - "frontend:9000"
      - "--domain=${NGROK_DOMAIN}"  # Se você tem domínio fixo
    ports:
      - "4040:4040"  # Interface web do ngrok
    networks:
      - cloud-kanban
    restart: unless-stopped

networks:
  cloud-kanban:
    driver: bridge

volumes:
  claude-projects:
  claude-config:
```

### Fase 3: Configuração de Ambiente

#### 3.1 Arquivo .env.docker
```env
# .env.docker
# Autenticação
JWT_SECRET=seu-jwt-secret-seguro-aqui

# Claude API
CLAUDE_API_KEY=sua-chave-claude-aqui

# Ngrok
NGROK_AUTHTOKEN=seu-token-ngrok-aqui
NGROK_DOMAIN=seu-dominio.ngrok-free.app  # Opcional: domínio fixo

# Database
DATABASE_PATH=/app/data/database.sqlite

# Modo
NODE_ENV=production
```

### Fase 4: Scripts de Automação

#### 4.1 Script de Inicialização
```bash
#!/bin/bash
# scripts/start-docker.sh

echo "🚀 Iniciando Cloud Kanban no Docker..."

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Inicie o Docker primeiro."
    exit 1
fi

# Criar diretórios necessários
mkdir -p data uploads

# Verificar arquivo de ambiente
if [ ! -f .env.docker ]; then
    echo "⚠️  Arquivo .env.docker não encontrado. Copiando template..."
    cp .env.docker.example .env.docker
    echo "📝 Por favor, configure o arquivo .env.docker"
    exit 1
fi

# Build e iniciar containers
docker-compose build
docker-compose up -d

# Aguardar serviços iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Mostrar status
docker-compose ps

# Obter URL do ngrok
echo ""
echo "✅ Cloud Kanban está rodando!"
echo "📱 Acesse localmente: http://localhost:9000"

# Tentar obter URL do ngrok
NGROK_URL=$(curl -s localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'http[^"]*' | head -1)
if [ ! -z "$NGROK_URL" ]; then
    echo "🌐 Acesso público via ngrok: $NGROK_URL"
fi

echo ""
echo "📊 Dashboard ngrok: http://localhost:4040"
echo "🛑 Para parar: ./scripts/stop-docker.sh"
```

#### 4.2 Script de Parada
```bash
#!/bin/bash
# scripts/stop-docker.sh

echo "🛑 Parando Cloud Kanban..."
docker-compose down
echo "✅ Cloud Kanban parado."
```

### Fase 5: Configuração do Ngrok Persistente

#### 5.1 Configurar Domínio Fixo no Ngrok
1. Criar conta no ngrok.com
2. Obter authtoken
3. (Opcional) Reservar domínio fixo gratuito

#### 5.2 docker-compose com Ngrok Alternativo
```yaml
# docker-compose.prod.yml (com restart automático)
version: '3.8'

services:
  # ... outros serviços ...
  
  ngrok:
    image: ngrok/ngrok:latest
    environment:
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
    volumes:
      - ./docker/ngrok/ngrok.yml:/etc/ngrok.yml
    command: start frontend
    restart: always  # Sempre reinicia
    networks:
      - cloud-kanban
```

### Fase 6: Melhorias e Otimizações

#### 6.1 Health Checks
```yaml
# Adicionar ao docker-compose.yml
services:
  backend:
    # ... configurações existentes ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 6.2 Backup Automático
```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker run --rm -v cloud-kanban_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/backup_$DATE.tar.gz /data
```

## Cronograma de Implementação

| Fase | Tarefa | Tempo Estimado |
|------|--------|---------------|
| 1 | Criar Dockerfiles | 2-3 horas |
| 2 | Configurar docker-compose | 1-2 horas |
| 3 | Testar integração | 2-3 horas |
| 4 | Configurar ngrok | 1 hora |
| 5 | Scripts de automação | 1 hora |
| 6 | Testes finais | 1-2 horas |
| **Total** | | **8-12 horas** |

## Comandos Úteis

```bash
# Iniciar tudo
docker-compose up -d

# Ver logs
docker-compose logs -f

# Reiniciar um serviço
docker-compose restart backend

# Executar comando no container
docker-compose exec backend bash

# Limpar tudo
docker-compose down -v

# Rebuild após mudanças
docker-compose build --no-cache
```

## Resultado Final

Com esta implementação você terá:

✅ **URL Persistente**: Acesso via ngrok sempre disponível  
✅ **Zero Configuração Manual**: Apenas `./start-docker.sh`  
✅ **Terminal Funcional**: Rodando dentro do container  
✅ **Dados Persistentes**: Volumes Docker mantém seus dados  
✅ **Fácil Manutenção**: Um comando para atualizar  
✅ **Acesso de Qualquer Lugar**: URL pública do ngrok  

## Próximos Passos

1. **Implementar os Dockerfiles** baseados nos templates acima
2. **Configurar o docker-compose.yml**
3. **Obter token do ngrok** e configurar
4. **Testar a solução** completa
5. **Configurar auto-start** no boot do sistema (opcional)

Esta solução resolve seu problema principal: **não precisar abrir o terminal toda vez**, mantendo a aplicação sempre disponível através do Docker + ngrok!