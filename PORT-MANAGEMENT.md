# Port Management & Mode Switching

Claude Code UI possui sistema inteligente de gerenciamento de portas que previne conflitos entre modos de desenvolvimento e produção.

## 🛡️ **Sistema de Proteção de Portas**

### Portas Protegidas
- **9000** - Cliente Vite (apenas desenvolvimento)
- **8080** - Servidor Node.js (desenvolvimento e produção)
- **8081** - Vibe Kanban Backend (desenvolvimento e produção)

### Funcionalidades
- **Monitoramento contínuo** das portas a cada 5 segundos
- **Terminação automática** de processos não autorizados
- **Whitelist inteligente** para processos do Claude Code UI
- **Logs detalhados** de todas as ações de proteção

## 🔄 **Modos de Operação**

### Modo Desenvolvimento (`npm run dev`)
- **Frontend**: Vite dev server na porta 9000
- **Backend**: Node.js server na porta 8080
- **Vibe Kanban**: Rust backend na porta 8081
- **Proteção**: Ativa automaticamente

### Modo Produção (`./start-background-prod.sh`)
- **Frontend**: Servido estaticamente pelo Node.js
- **Backend**: Node.js server na porta 8080
- **Vibe Kanban**: Rust backend na porta 8081
- **Túnel**: Ngrok para acesso externo

## 📋 **Comandos Disponíveis**

### Status e Detecção
```bash
# Verificar modo atual e portas em uso
npm run port-status
```

### Troca de Modos
```bash
# Para produção (para desenvolvimento e sugere comando)
npm run switch-to-prod

# Para desenvolvimento (para produção e sugere comando)  
npm run switch-to-dev
```

### Parada de Processos
```bash
# Para todos os processos Claude Code UI
npm run stop-all

# Para apenas desenvolvimento
node scripts/port-management.js stop-dev

# Para apenas produção
node scripts/port-management.js stop-prod
```

### Proteção de Portas
```bash
# Executar apenas proteção (sem serviços)
npm run protect-ports
```

## 🚦 **Workflow Recomendado**

### Para usar Produção
```bash
# Se estiver em desenvolvimento, pare primeiro
npm run switch-to-prod

# Inicie produção
./start-background-prod.sh

# Verificar status
./check-tunnel.sh
```

### Para voltar ao Desenvolvimento
```bash  
# Se estiver em produção, pare primeiro
npm run switch-to-dev

# Inicie desenvolvimento
npm run dev
```

## 🔧 **Resolução de Problemas**

### ❌ Erro: "EADDRINUSE" (Porta em uso)
```bash
# Detectar qual modo está ativo
npm run port-status

# Parar todos os processos
npm run stop-all

# Esperar 5 segundos e tentar novamente
```

### ❌ Conflitos entre Dev e Prod
O script `start-background-prod.sh` agora detecta automaticamente modo desenvolvimento e para os processos antes de iniciar produção.

### ❌ Proteção mata processos válidos
Isso não deveria acontecer, pois processos autorizados são registrados automaticamente. Se ocorrer:

1. Verifique logs da proteção
2. Use `npm run stop-all` para limpar tudo
3. Reinicie o modo desejado

## 🧹 **Scripts Deprecated**

Os seguintes scripts foram descontinuados e redirecionam automaticamente:
- `iniciar-com-ngrok.sh` → Use `./start-background-prod.sh`
- `start-background.sh` → Use `./start-background-prod.sh`

## 📊 **Monitoramento**

### Logs da Proteção
```bash
# Desenvolvimento com proteção
npm run dev

# Apenas proteção (background)
npm run protect-ports
```

### Logs de Produção
```bash
tail -f prod-server.log    # Servidor Node.js
tail -f prod-vibe.log      # Vibe Kanban
tail -f prod-ngrok.log     # Túnel Ngrok
```

## ⚡ **Performance**

- **Detecção de modo**: ~100ms
- **Troca de modo**: 3-5 segundos
- **Monitoramento**: Impacto mínimo (<1% CPU)
- **Proteção**: Resposta em ~1 segundo

## 🛠️ **Desenvolvimento**

### Arquivos Principais
- `scripts/port-protection.js` - Serviço de proteção
- `scripts/port-management.js` - Gerenciamento de modos
- `scripts/dev.js` - Desenvolvimento com proteção
- `start-background-prod.sh` - Produção com detecção

### Estrutura do Sistema
```
Port Protection Service
├── Monitor (5s intervals)
├── Whitelist Management
├── Process Detection
└── Termination Logic

Port Management
├── Mode Detection
├── Safe Shutdown
├── Conflict Resolution
└── Status Reporting
```

## ✨ **Benefícios**

- **Zero configuração** - Funciona automaticamente
- **Prevenção de conflitos** - Nunca mais "porta ocupada"
- **Troca segura** - Sem perda de dados ou estado
- **Logs claros** - Transparência total das operações
- **Compatibilidade** - Funciona com scripts existentes