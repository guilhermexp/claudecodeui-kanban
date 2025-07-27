# Claude Code UI + Vibe Kanban - Documentação Técnica Completa

## Índice

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Arquitetura Dual Backend](#arquitetura-dual-backend)
3. [Estrutura de Diretórios](#estrutura-de-diretórios)
4. [Componentes Principais](#componentes-principais)
5. [APIs e Integrações](#apis-e-integrações)
6. [Vibe Kanban - Sistema de Tarefas](#vibe-kanban---sistema-de-tarefas)
7. [Sistema de Sessões e Chat](#sistema-de-sessões-e-chat)
8. [Terminal e Shell Melhorado](#terminal-e-shell-melhorado)
9. [Mobile e Responsividade](#mobile-e-responsividade)
10. [Segurança e Permissões](#segurança-e-permissões)

---

## Visão Geral do Sistema

**Claude Code UI + Vibe Kanban** é uma aplicação web moderna que combina:

- Interface para Claude Code CLI
- Sistema completo de gerenciamento de tarefas (Vibe Kanban)
- Arquitetura com dois backends independentes
- Suporte completo para mobile e desktop

### Informações Técnicas
- **Versão**: 1.5.0
- **Stack Principal**: React + Node.js + Rust
- **Portas**: Frontend (9000), Backend Node (8080), Backend Rust (8081)
- **Database**: SQLite compartilhado

---

## Arquitetura Dual Backend

### Diagrama de Arquitetura

```
┌────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 9000)                    │
│                         React + Vite + TS                       │
├────────────────────────┬───────────────────────────────────────┤
│                        │                                        │
│    WebSocket (ws://)   │          HTTP (REST API)             │
│                        │                                        │
├────────────────────────┴───────────────────────────────────────┤
│                    BACKEND 1 - Node.js (Port 8080)             │
│                Express + WebSocket + SQLite + JWT              │
│  - Claude CLI Integration                                       │
│  - Session Management                                           │
│  - File Operations                                              │
│  - Git Operations                                               │
│  - Authentication                                               │
├─────────────────────────────────────────────────────────────────┤
│                    BACKEND 2 - Rust (Port 8081)                │
│                 Actix-web + SQLite + Git2                      │
│  - Vibe Kanban Task Management                                 │
│  - Project Management                                           │
│  - Git Integration                                              │
│  - Task Templates                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Shared SQLite DB   │
                    │   /data/claude.db    │
                    └─────────────────────┘
```

### Comunicação entre Backends

1. **Frontend → Backend Node.js**
   - WebSocket para chat e terminal
   - REST API para operações CRUD
   - Autenticação JWT

2. **Frontend → Backend Rust**
   - REST API para Vibe Kanban
   - Operações de tarefas e projetos
   - Integração Git

3. **Backend Node.js ↔ Backend Rust**
   - Compartilham SQLite database
   - Sincronização via filesystem

---

## Estrutura de Diretórios

```
claudecodeui/
├── public/                          # Assets estáticos
│   ├── icons/                      # Ícones da aplicação
│   ├── screenshots/                # Capturas de tela
│   └── logo.svg                    # Logo principal
│
├── server/                          # Backend Node.js
│   ├── index.js                    # Servidor principal Express + WS
│   ├── claude-cli.js               # Integração com Claude CLI
│   ├── projects.js                 # Gerenciamento de projetos
│   ├── shellSessions.js            # Sessões de terminal
│   ├── routes/                     # Rotas da API
│   │   ├── auth.js                # Autenticação
│   │   ├── git.js                 # Operações Git
│   │   └── mcp.js                 # MCP servers
│   ├── middleware/                 # Middlewares Express
│   │   └── auth.js                # JWT validation
│   └── database/                   # Utilitários DB
│       └── db.js                  # SQLite connection
│
├── src/                            # Frontend React
│   ├── components/                # Componentes React
│   │   ├── ui/                   # Componentes UI reutilizáveis
│   │   ├── vibe-kanban/          # Componentes Vibe Kanban
│   │   │   ├── tasks/            # Gerenciamento de tarefas
│   │   │   ├── projects/         # Gerenciamento de projetos
│   │   │   ├── ui/               # UI específica do Kanban
│   │   │   └── context/          # Contexts do Kanban
│   │   ├── MainContent.jsx       # Área principal com chat
│   │   ├── Shell.jsx             # Terminal integrado
│   │   ├── FileTree.jsx          # Explorador de arquivos
│   │   ├── GitPanel.jsx          # Painel Git
│   │   ├── Sidebar.jsx           # Barra lateral
│   │   ├── MobileNav.jsx         # Navegação mobile
│   │   ├── MicButton.jsx         # Botão de gravação de voz
│   │   └── VibeKanbanApp.jsx     # App principal do Kanban
│   ├── hooks/                     # Custom React hooks
│   │   ├── useWebSocket.js       # WebSocket connection
│   │   ├── useAudioRecorder.js   # Gravação de áudio
│   │   └── vibe-kanban/          # Hooks do Kanban
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.jsx       # Autenticação
│   │   └── ThemeContext.jsx      # Tema (dark/light)
│   ├── lib/                       # Bibliotecas
│   │   └── vibe-kanban/          # API e tipos do Kanban
│   ├── pages/                     # Páginas/rotas
│   │   └── vibe-kanban/          # Páginas do Kanban
│   ├── utils/                     # Utilitários
│   │   ├── websocket.js          # WebSocket client
│   │   ├── api.js                # API client
│   │   └── whisper.js            # Transcrição de áudio
│   ├── App.jsx                    # Componente principal
│   └── main.jsx                   # Entry point
│
├── vibe-kanban/                    # Backend Rust
│   ├── backend/                   # Código Rust
│   │   ├── src/                  # Source files
│   │   ├── Cargo.toml            # Dependências Rust
│   │   └── target/               # Build output
│   └── [outros arquivos]         # Configurações
│
├── scripts/                        # Scripts utilitários
│   ├── dev.js                    # Script de desenvolvimento
│   ├── network-access.js         # Acesso de rede
│   ├── ngrok-setup.js            # Setup Ngrok
│   └── cloudflare-tunnel.sh      # Tunnel Cloudflare
│
├── data/                          # Dados da aplicação
│   ├── claude.db                 # Database principal
│   └── vibe.db                   # Database Vibe Kanban
│
├── .env.example                   # Template de configuração
├── package.json                   # Dependências Node
├── vite.config.js                # Configuração Vite
├── tailwind.config.js            # Configuração Tailwind
└── README.md                     # Documentação principal
```

---

## Componentes Principais

### Frontend - Componentes Core

#### `App.jsx` - Sistema de Proteção de Sessões
```javascript
// Sistema inteligente de proteção de sessões ativas
// Previne atualizações automáticas durante conversas
const [activeSessions, setActiveSessions] = useState(new Set());
```

#### `MainContent.jsx` - Chat Interface
- Streaming de respostas em tempo real
- Suporte a anexos e imagens
- Gravação e transcrição de voz
- Histórico persistente

#### `Shell.jsx` - Terminal Melhorado
- XTerm.js com addons customizados
- Múltiplas sessões simultâneas
- Resize dinâmico
- Clipboard integration
- Mobile keyboard support

#### `VibeKanbanApp.jsx` - Sistema Kanban
- Interface completa do Vibe Kanban
- Integração com roteamento principal
- Gerenciamento de estado global

### Backend Node.js - Módulos

#### `server/index.js` - Servidor Principal
- Express + WebSocket server
- Proxy reverso para Vibe Kanban
- Autenticação JWT
- CORS configurado

#### `server/claude-cli.js` - Claude Integration
- Spawn de processos Claude
- Streaming de respostas
- Gerenciamento de sessões

#### `server/shellSessions.js` - Terminal Sessions
- node-pty para processos shell
- Múltiplas sessões isoladas
- Resize handling

### Vibe Kanban - Componentes

#### `TaskKanbanBoard.tsx` - Quadro Principal
- Drag and drop com @dnd-kit
- Colunas customizáveis
- Mobile optimized

#### `TaskDetailsPanel.tsx` - Detalhes de Tarefa
- Tabs: Logs, Processes, Plan, Diff, Related
- Responsivo com backdrop blur
- Scroll otimizado mobile

#### `MobileTaskKanban.tsx` - Interface Mobile
- Layout otimizado para touch
- Swipe gestures
- Bottom sheet pattern

---

## APIs e Integrações

### Backend Node.js - Endpoints

#### Autenticação
```
POST   /api/auth/login          # Login de usuário
POST   /api/auth/logout         # Logout
GET    /api/auth/check          # Verificar autenticação
POST   /api/auth/setup          # Setup inicial
```

#### Projetos e Sessões
```
GET    /api/projects            # Listar projetos
GET    /api/projects/:id        # Detalhes do projeto
POST   /api/projects            # Criar projeto
DELETE /api/projects/:id        # Deletar projeto
GET    /api/sessions/:id        # Mensagens da sessão
```

#### Arquivos
```
GET    /api/projects/:id/tree   # Árvore de arquivos
GET    /api/files/*             # Ler arquivo
PUT    /api/files/*             # Atualizar arquivo
POST   /api/files/*             # Criar arquivo
DELETE /api/files/*             # Deletar arquivo
```

#### Git
```
GET    /api/git/:projectId/status      # Git status
GET    /api/git/:projectId/branches    # Listar branches
POST   /api/git/:projectId/commit      # Criar commit
POST   /api/git/:projectId/checkout    # Trocar branch
```

#### MCP Servers
```
GET    /api/mcp/servers         # Listar servidores
POST   /api/mcp/servers         # Adicionar servidor
PUT    /api/mcp/servers/:id     # Atualizar servidor
DELETE /api/mcp/servers/:id     # Remover servidor
POST   /api/mcp/test            # Testar conexão
```

### Backend Rust - Vibe Kanban API

#### Projetos
```
GET    /api/projects                   # Listar projetos
POST   /api/projects                   # Criar projeto
GET    /api/projects/:id               # Detalhes
PUT    /api/projects/:id               # Atualizar
DELETE /api/projects/:id               # Deletar
```

#### Tarefas
```
GET    /api/projects/:id/tasks         # Listar tarefas
POST   /api/projects/:id/tasks         # Criar tarefa
GET    /api/tasks/:id                  # Detalhes
PUT    /api/tasks/:id                  # Atualizar
DELETE /api/tasks/:id                  # Deletar
PATCH  /api/tasks/:id/move             # Mover entre colunas
```

#### Execução e Logs
```
POST   /api/tasks/:id/execute          # Executar tarefa
GET    /api/tasks/:id/logs             # Obter logs
GET    /api/tasks/:id/processes        # Processos em execução
POST   /api/tasks/:id/abort            # Abortar execução
```

#### Templates
```
GET    /api/templates                  # Listar templates
POST   /api/templates                  # Criar template
DELETE /api/templates/:id              # Deletar template
```

### WebSocket Events

#### Cliente → Servidor
```javascript
// Chat
{
  type: 'chat',
  sessionId: string,
  message: string,
  attachments?: File[]
}

// Terminal
{
  type: 'shell_input',
  sessionId: string,
  data: string
}

// Resize
{
  type: 'resize',
  sessionId: string,
  cols: number,
  rows: number
}
```

#### Servidor → Cliente
```javascript
// Resposta do chat
{
  type: 'chat_response',
  sessionId: string,
  content: string,
  status: 'streaming' | 'complete' | 'error'
}

// Output do terminal
{
  type: 'shell_output',
  sessionId: string,
  data: string
}

// Atualização de projetos
{
  type: 'project_update',
  projects: Project[]
}
```

---

## Vibe Kanban - Sistema de Tarefas

### Arquitetura do Kanban

```
┌─────────────────────────────────────┐
│         Kanban Board UI             │
│     (React + DnD Kit + TS)          │
├─────────────────────────────────────┤
│         State Management            │
│    (Context API + Local State)      │
├─────────────────────────────────────┤
│          Vibe Kanban API            │
│      (REST API - Port 8081)         │
├─────────────────────────────────────┤
│        Rust Backend Core            │
│    (Actix-web + SQLite + Git2)      │
└─────────────────────────────────────┘
```

### Funcionalidades Principais

1. **Quadro Kanban Visual**
   - Três colunas: Todo, In Progress, Done
   - Drag and drop entre colunas
   - Contadores de tarefas por coluna
   - Mobile swipe support

2. **Gerenciamento de Tarefas**
   - CRUD completo de tarefas
   - Prioridades e tags
   - Descrição em Markdown
   - Anexos e arquivos

3. **Detalhes de Tarefa (Tabs)**
   - **Logs**: Conversação com Claude
   - **Processes**: Processos em execução
   - **Plan**: Plano de execução
   - **Diff**: Mudanças no código
   - **Related**: Tarefas relacionadas

4. **Integração Git**
   - Criar branch da tarefa
   - Commits automáticos
   - Pull Requests
   - Status visual

5. **Templates de Tarefas**
   - Criar templates reutilizáveis
   - Categorias personalizadas
   - Parâmetros dinâmicos

### Mobile Optimizations

- **MobileTaskKanban.tsx**: Layout específico mobile
- Touch gestures para drag and drop
- Bottom sheet para detalhes
- Swipe entre colunas
- Teclado virtual otimizado

---

## Sistema de Sessões e Chat

### Proteção de Sessões Ativas

O sistema implementa um mecanismo inteligente de proteção:

```javascript
// App.jsx - Sistema de proteção
const [activeSessions, setActiveSessions] = useState(new Set());

// Quando usuário envia mensagem
const markSessionActive = (sessionId) => {
  setActiveSessions(prev => new Set([...prev, sessionId]));
};

// Quando conversa termina
const markSessionInactive = (sessionId) => {
  setActiveSessions(prev => {
    const newSet = new Set(prev);
    newSet.delete(sessionId);
    return newSet;
  });
};

// Pula atualizações se sessão está ativa
if (activeSessions.has(sessionId)) {
  return; // Skip update
}
```

### Chat Features

1. **Streaming Responses**
   - Server-Sent Events (SSE)
   - Incremental rendering
   - Status indicators

2. **Voice Support**
   - Gravação de áudio
   - Transcrição via Whisper API
   - Visual feedback

3. **Attachments**
   - Drag and drop files
   - Image preview
   - Code file detection

4. **Message History**
   - Persistência em JSONL
   - Paginação eficiente
   - Search functionality

---

## Terminal e Shell Melhorado

### Configurações XTerm

```javascript
const term = new Terminal({
  cursorBlink: true,
  fontSize: isMobile ? 12 : 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: 'transparent',
    foreground: isDarkMode ? '#ffffff' : '#000000'
  },
  allowTransparency: true,
  scrollback: 10000
});
```

### Mobile Adaptations

1. **Touch Keyboard**
   - Auto-show on focus
   - Viewport adjustments
   - Copy/paste support

2. **Responsive Font**
   - Dynamic sizing
   - Readability focus
   - Zoom prevention

3. **Gesture Support**
   - Tap to focus
   - Long press for menu
   - Pinch to zoom (disabled)

---

## Mobile e Responsividade

### Breakpoints Tailwind

```css
/* Mobile First Approach */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Componentes Mobile-First

1. **MobileNav.jsx**
   - Bottom tab navigation
   - Icon-based menu
   - Active state indicators

2. **Responsive Panels**
   - Overlay on mobile
   - Side-by-side on desktop
   - Smooth transitions

3. **Touch Optimizations**
   - Larger tap targets (min 44px)
   - Swipe gestures
   - Haptic feedback ready

### PWA Configuration

```json
{
  "name": "Claude Code UI",
  "short_name": "Claude UI",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1a1a1a",
  "background_color": "#000000"
}
```

---

## Segurança e Permissões

### Sistema de Permissões

Por padrão, TODAS as ferramentas estão desabilitadas:

```javascript
// Estado inicial das ferramentas
const defaultToolsState = {
  'str_replace_editor': false,
  'create_file': false,
  'delete_file': false,
  'run_bash_command': false,
  'read_file': false,
  'list_files': false,
  'git_operations': false
};
```

### Autenticação JWT

```javascript
// Middleware de autenticação
export const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
```

### MCP Server Security

- Validação de comandos
- Sandboxing de processos
- Timeout controls
- Resource limits

---

## Scripts de Desenvolvimento

### `scripts/dev.js` - Orquestrador Principal

```javascript
// Gerencia os 3 serviços principais
const PORTS = {
  CLIENT: 9000,      // Frontend Vite
  SERVER: 8080,      // Backend Node.js
  VIBE_BACKEND: 8081 // Backend Rust
};

// Kill processos existentes
await killPortProcesses([PORTS.CLIENT, PORTS.SERVER, PORTS.VIBE_BACKEND]);

// Inicia serviços com auto-restart
services.push(spawnService('SERVER', 'node', ['server/index.js']));
services.push(spawnService('CLIENT', 'npx', ['vite', '--host']));
services.push(spawnService('VIBE-BACKEND', 'cargo', ['run', '--release']));
```

### Network Access Scripts

- `network-access.js` - Configura acesso LAN
- `ngrok-setup.js` - Túnel Ngrok
- `cloudflare-tunnel.sh` - Túnel Cloudflare

---

## Configuração Completa

### Variáveis de Ambiente

```bash
# .env - Configuração completa

# Portas
PORT=8080
VITE_PORT=9000
VIBE_PORT=8081

# URLs
VITE_SERVER_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_VIBE_URL=http://localhost:8081

# Segurança
SESSION_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key

# Features
ENABLE_AUTH=true
ENABLE_MCP=true
ENABLE_VOICE=true
ENABLE_VIBE_KANBAN=true

# Vibe Kanban
VIBE_NO_BROWSER=true
VIBE_DATABASE_URL=sqlite://./data/vibe.db
VIBE_LOG_LEVEL=info

# Development
NODE_ENV=development
DEBUG=app:*
```

### Build e Deploy

```bash
# Development
npm run dev                 # Todos os serviços
npm run dev:network         # Com acesso rede

# Production
npm run build              # Build frontend
cd vibe-kanban/backend && cargo build --release
NODE_ENV=production npm start

# Docker (futuro)
docker-compose up -d
```

---

## Troubleshooting

### Problemas Comuns

1. **"Port already in use"**
   ```bash
   lsof -ti:9000 | xargs kill -9
   lsof -ti:8080 | xargs kill -9
   lsof -ti:8081 | xargs kill -9
   ```

2. **Vibe Kanban não inicia**
   ```bash
   cd vibe-kanban/backend
   cargo clean
   cargo build --release
   ```

3. **WebSocket desconectando**
   - Verificar CORS settings
   - Checar firewall
   - Validar JWT token

4. **Mobile keyboard issues**
   - Atualizar viewport meta tag
   - Verificar CSS do teclado virtual
   - Testar em diferentes browsers

---

*Documentação técnica completa - Claude Code UI + Vibe Kanban v1.5.0*