# Claude Code UI

🚀 **Interface web moderna e inteligente para Claude Code CLI** com sistema integrado de gerenciamento de tarefas, proteção de portas e acesso público via túnel.

## ✨ **Recursos Principais**

### 🖥️ **Interface Completa**
- **Terminal Integrado**: Execute Claude Code diretamente na interface web
- **Explorador de Arquivos**: Navegue e edite arquivos com syntax highlighting  
- **Git Integrado**: Gerencie branches, commits e operações git
- **Dashboard Analytics**: Acompanhe tokens, custos e estatísticas de uso
- **Sistema de Tarefas**: Vibe Kanban integrado para gerenciamento de projetos

### 🛡️ **Proteção Inteligente** (NOVO)
- **Proteção Automática de Portas**: Previne conflitos entre dev e produção
- **Detecção de Conflitos**: Identifica e resolve automaticamente interferências
- **Troca Segura de Modos**: Switching inteligente entre desenvolvimento e produção
- **Monitoramento Contínuo**: Supervisão em tempo real dos processos

### 🌐 **Acesso Público**
- **Túnel Ngrok**: Acesso global via `https://claudecode.ngrok.app`
- **Modo Produção**: Deploy automático com build otimizado
- **Verificação de Conectividade**: Ferramentas para testar acesso público

### 📱 **Experiência Moderna**
- **Totalmente Responsivo**: Interface otimizada para desktop e mobile
- **PWA Support**: Instalação como app nativo
- **Modo Escuro**: Tema adaptável automático
- **Transcrição de Voz**: Comandos por voz com OpenAI Whisper

## 🚀 **Início Rápido**

### 📦 **Instalação**
```bash
# Clone e instale
git clone https://github.com/seu-usuario/claudecodeui.git
cd claudecodeui
npm install
```

### 💻 **Desenvolvimento Local**
```bash
# Inicia todos os serviços com proteção de portas
npm run dev
```
**Acesse:** http://localhost:9000  
**Portas usadas:** Frontend(9000), Backend(8080), Vibe Kanban(8081)

### 🌍 **Produção com Acesso Público**
```bash
# Inicia produção + túnel ngrok (automático)
./start-background-prod.sh

# Verifica conectividade global
./check-tunnel.sh
```
**Acesse de qualquer lugar:** https://claudecode.ngrok.app

## 🔧 **Gerenciamento de Portas** 

### Comandos de Proteção
```bash
# Verificar status atual
npm run port-status

# Trocar para produção (para dev automaticamente)
npm run switch-to-prod

# Trocar para desenvolvimento (para prod automaticamente) 
npm run switch-to-dev

# Parar tudo em caso de emergência
npm run stop-all
```

### Por Que Isso é Importante?
Antes, executar `npm run dev` e depois `./start-background-prod.sh` causava:
- ❌ Conflitos de porta (EADDRINUSE)
- ❌ Processos interferindo uns com os outros
- ❌ Necessidade de cleanup manual

**Agora:** O sistema detecta automaticamente conflitos e resolve de forma inteligente.

## 📋 **Pré-requisitos**

### Essenciais
- **Node.js 18+**
- **Claude Code CLI** instalado: `npm install -g @anthropic-ai/claude-code`
- **Token Claude** válido configurado

### Opcionais
- **Rust/Cargo** (para Vibe Kanban backend)
- **Ngrok** (para acesso público) - `brew install ngrok`
- **OpenAI API Key** (para transcrição de voz)

## 🏗️ **Arquitetura do Sistema**

### 🖼️ **Três Serviços Integrados**

#### 1. **Frontend (React/Vite)** - Porto 9000
- React 18 com hooks modernos
- Tailwind CSS + modo escuro
- CodeMirror 6 (syntax highlighting)
- XTerm.js (terminal emulation)
- PWA com service worker

#### 2. **Backend (Node.js/Express)** - Porto 8080  
- WebSocket para terminal em tempo real
- SQLite para projetos e analytics
- JWT authentication
- Proxy para Claude Code CLI
- API RESTful completa

#### 3. **Vibe Kanban (Rust/Actix)** - Porto 8081
- Sistema avançado de tarefas
- Integração Git nativa
- Database SQLite compartilhado
- Performance otimizada

### 📊 **Fluxo de Dados**
```
Frontend ←→ Backend ←→ Claude CLI
    ↓         ↓
    ↓    Vibe Kanban
    ↓         ↓
   PWA    SQLite DB
```

## ⚙️ **Configuração**

### 🔐 **Variáveis de Ambiente** (Opcional)
```env
# .env (na raiz do projeto)
JWT_SECRET=seu_jwt_secret_seguro
OPENAI_API_KEY=sk-xxx  # Para transcrição de voz
PORT=8080              # Backend
VITE_PORT=9000         # Frontend  
VIBE_PORT=8081         # Vibe Kanban
```

### 🔑 **Autenticação**
- Primeiro acesso: Cria usuário automaticamente
- JWT tokens com renovação automática
- Sessions persistentes entre reinicializações

## 📊 **Dashboard de Analytics**

### 📈 **Métricas Coletadas**
- **Tokens**: Input, output, cache usage
- **Custos**: Cálculo baseado em preços oficiais Anthropic
- **Sessions**: Duração, mensagens, taxa de erro
- **Performance**: Tempo de resposta, taxa de sucesso

### 📋 **Dados Utilizados**
Coleta dados reais de:
- `~/.claude/projects/` - Projetos e sessões
- Logs do Claude CLI
- Métricas de API

## 🛠️ **Comandos Completos**

### Desenvolvimento
```bash
npm install            # Instalar dependências
npm run dev           # Desenvolvimento com proteção (RECOMENDADO)
npm run server        # Apenas backend (debugging)
npm run client        # Apenas frontend (debugging)  
npm run vibe-backend  # Apenas Vibe Kanban (debugging)
./start-network.sh    # Desenvolvimento com acesso rede (0.0.0.0)
```

### Produção  
```bash
npm run build                # Build para produção
./start-background-prod.sh   # Produção + túnel público
./check-tunnel.sh           # Verificar conectividade
npm start                   # Produção local (sem túnel)
```

### Gerenciamento de Sistema (macOS)
```bash
./claudecode-service.sh install    # Instalar como serviço sistema
./claudecode-service.sh status     # Status do serviço
./claudecode-service.sh uninstall  # Remover serviço
```

### Utilitários
```bash
npm run port-status       # Status atual dos processos
npm run protect-ports     # Executar apenas proteção de portas
node scripts/test-port-attack.js  # Testar sistema de proteção
```

## 🚨 **Resolução de Problemas**

### ❌ **Erro: Port Already in Use**
```bash
npm run port-status  # Ver o que está rodando
npm run stop-all     # Parar tudo
npm run dev          # Ou ./start-background-prod.sh
```

### ❌ **Terminal não aceita input**
- Atualizar página (F5)
- Verificar console do navegador
- Reiniciar: `npm run dev`

### ❌ **Vibe Kanban não carrega**
```bash
cd vibe-kanban/backend
cargo build --release
npm run dev
```

### ❌ **Dashboard sem dados**
- Verificar aba Network no navegador
- Confirmar permissões em `~/.claude/projects/`
- Usar Claude CLI pelo menos uma vez

## 📁 **Estrutura do Projeto**

```
claudecodeui/
├── src/                    # Frontend React
│   ├── components/         # Componentes React
│   ├── contexts/          # Context providers
│   └── utils/             # Utilitários frontend
├── server/                # Backend Node.js  
│   ├── routes/            # Endpoints API
│   ├── database/          # SQLite management
│   └── middleware/        # Express middleware
├── scripts/               # Scripts de automação
│   ├── dev.js             # Orquestrador desenvolvimento
│   ├── port-protection.js # Proteção de portas
│   └── port-management.js # Gerenciamento inteligente
├── vibe-kanban/           # Sistema tarefas Rust
└── docs/                  # Documentação completa
```

## 📚 **Documentação**

### 📖 **Documentos Principais**
- **CLAUDE.md** - Contexto completo para desenvolvimento
- **PORT-MANAGEMENT.md** - Sistema de proteção de portas  
- **docs/ARCHITECTURE.md** - Arquitetura detalhada
- **docs/TROUBLESHOOTING.md** - Solução de problemas

### 🔗 **Links Úteis**
- [Guia do Usuário](docs/USER_GUIDE.md)
- [API Reference](docs/API.md)  
- [Vibe Kanban Guide](docs/VIBE_KANBAN_PANEL.md)
- [Mobile Setup](SETUP-HTTPS-MOBILE.md)

## 🔒 **Segurança**

### 🛡️ **Recursos de Segurança**
- **Tools Disabled by Default**: Todas ferramentas precisam ser habilitadas explicitamente
- **JWT Authentication**: Tokens seguros com renovação automática
- **Port Protection**: Monitoramento contra processos não autorizados
- **Input Validation**: Validação rigorosa de todas entradas
- **HTTPS Ready**: Configuração para produção segura

### ⚠️ **Boas Práticas**
- Configure HTTPS para produção
- Use JWT_SECRET forte em produção
- Monitore logs regularmente
- Mantenha dependências atualizadas

## 🎯 **Casos de Uso**

### 👨‍💻 **Para Desenvolvedores**
- Desenvolvimento com Claude Code em interface web
- Gerenciamento visual de projetos e tarefas
- Analytics de uso e custos  
- Workflow git integrado

### 🌐 **Para Acesso Remoto** 
- Trabalho remoto via túnel público
- Demonstrações para clientes
- Colaboração em equipe
- Acesso mobile responsivo

### 🏢 **Para Times**
- Sistema de tarefas colaborativo
- Tracking de custos centralizados
- Sessões compartilhadas
- Monitoramento de uso

## 🤝 **Suporte & Contribuição**

### 🐛 **Reportar Problemas**
- Abra uma issue detalhada no GitHub
- Inclua logs relevantes (`npm run dev` output)
- Descreva steps para reproduzir

### 🎉 **Contribuições**
- Fork o repositório
- Crie branch para feature/fix
- Teste localmente com `npm run dev`
- Abra Pull Request com descrição detalhada

## 📄 **Licença**

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## ⭐ **Features em Desenvolvimento**

- [ ] Multi-language support
- [ ] Plugin system
- [ ] Advanced analytics
- [ ] Team collaboration features  
- [ ] Docker containerization
- [ ] Cloud deployment options

---

**🚀 Pronto para começar?**

```bash
npm install && npm run dev
```

**Acesso público:**
```bash  
./start-background-prod.sh
```

**Problemas?**
```bash
npm run port-status && npm run stop-all
```