<div align="center">
  <img src="public/logo.svg" alt="Claude Code UI" width="64" height="64">
  <h1>Claude Code UI + Vibe Kanban</h1>
  <p><strong>Interface completa para Claude Code CLI com sistema de gerenciamento de tarefas integrado</strong></p>
</div>

---

## 🚀 Visão Geral

Claude Code UI é uma interface web moderna e responsiva para o [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), agora com **Vibe Kanban** integrado - um poderoso sistema de gerenciamento de tarefas baseado em Rust. 

### Principais Características

- **🏗️ Arquitetura Dual Backend** - Node.js (Express) + Rust (Vibe Kanban)
- **📱 100% Responsivo** - Desktop, tablet e mobile com PWA support
- **🎯 Vibe Kanban Integrado** - Sistema completo de gestão de tarefas
- **💬 Chat Inteligente** - Interface aprimorada com suporte a voz
- **🔧 Terminal Melhorado** - Shell integrado com novas funcionalidades
- **📁 Explorador de Arquivos** - Edição ao vivo com syntax highlighting
- **🔀 Git Completo** - Gestão visual de branches, commits e PRs

## 📸 Screenshots

<div align="center">
<table>
<tr>
<td align="center">
<h3>Desktop - Interface Principal</h3>
<img src="public/screenshots/desktop-main.png" alt="Desktop Interface" width="400">
<br>
<em>Chat integrado com Vibe Kanban visível</em>
</td>
<td align="center">
<h3>Mobile - Experiência Otimizada</h3>
<img src="public/screenshots/mobile-chat.png" alt="Mobile Interface" width="250">
<br>
<em>Interface touch-friendly com navegação bottom-tab</em>
</td>
</tr>
<tr>
<td align="center">
<h3>Vibe Kanban - Gestão de Tarefas</h3>
<img src="public/screenshots/vibe-kanban.png" alt="Vibe Kanban" width="400">
<br>
<em>Sistema kanban completo com drag-and-drop</em>
</td>
<td align="center">
<h3>Terminal Integrado</h3>
<img src="public/screenshots/terminal.png" alt="Terminal" width="400">
<br>
<em>Terminal com suporte completo ao Claude CLI</em>
</td>
</tr>
</table>
</div>

## 🛠️ Arquitetura

### Sistema com Dual Backend

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend 1     │    │  Claude CLI     │
│   React/Vite    │◄──►│ Express/Node.js │◄──►│  Integration    │
│   Port: 9000    │    │   Port: 8080    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│  Vibe Kanban    │    │   Shared        │
│  Rust Backend   │◄──►│   Database      │
│   Port: 8081    │    │   SQLite        │
└─────────────────┘    └─────────────────┘
```

### Stack Tecnológico

#### Frontend (Port 9000)
- **React 18** com hooks e componentes modernos
- **Vite** para build rápido e HMR
- **Tailwind CSS** + CSS Modules
- **TypeScript** (migração gradual)
- **CodeMirror 6** para edição de código
- **XTerm.js** para terminal
- **Lucide Icons** para ícones

#### Backend Principal (Port 8080)
- **Node.js** + **Express**
- **WebSocket (ws)** para comunicação real-time
- **SQLite** via better-sqlite3
- **node-pty** para gerenciamento de processos
- **JWT** para autenticação
- **Multer** para upload de arquivos

#### Vibe Kanban Backend (Port 8081)
- **Rust** com Cargo
- **Actix-web** para servidor HTTP
- **SQLite** compartilhado
- **Git2** para integração Git
- **Serde** para serialização

## 📦 Instalação

### Pré-requisitos

- **Node.js** v20 ou superior
- **Rust** e Cargo (para Vibe Kanban)
- **Claude Code CLI** instalado e configurado
- **Git** para funcionalidades de versionamento

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
```

2. **Instale as dependências**
```bash
# Dependências Node.js
npm install

# Build do Vibe Kanban (Rust)
cd vibe-kanban/backend
cargo build --release
cd ../..
```

3. **Configure o ambiente**
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

4. **Inicie a aplicação**
```bash
# Modo desenvolvimento (todos os serviços)
npm run dev

# Ou inicie individualmente:
npm run server        # Backend Node.js
npm run client        # Frontend Vite
npm run vibe-backend  # Backend Rust
```

5. **Acesse a aplicação**
- Frontend: `http://localhost:9000`
- Backend API: `http://localhost:8080`
- Vibe Kanban API: `http://localhost:8081`

## 🎯 Principais Funcionalidades

### 1. Vibe Kanban - Sistema de Tarefas

- **Quadro Kanban Visual** - Colunas customizáveis (Todo, In Progress, Done)
- **Drag and Drop** - Arraste tarefas entre colunas
- **Detalhes de Tarefa** - Descrição rica, logs, processos, diffs
- **Integração Git** - Crie branches e PRs direto das tarefas
- **Templates** - Crie e reutilize templates de tarefas
- **Mobile Otimizado** - Interface touch-friendly

### 2. Chat Aprimorado

- **Streaming em Tempo Real** - Respostas incrementais do Claude
- **Suporte a Voz** - Gravação e transcrição de áudio
- **Histórico Persistente** - Todas as conversas salvas
- **Anexos** - Envie arquivos e imagens
- **Syntax Highlighting** - Blocos de código formatados

### 3. Terminal Integrado

- **Shell Completo** - Acesso total ao sistema
- **Múltiplas Sessões** - Abas de terminal
- **Resize Dinâmico** - Ajuste automático
- **Clipboard** - Copiar/colar integrado
- **Mobile Support** - Teclado virtual otimizado

### 4. Explorador de Arquivos

- **Árvore Interativa** - Navegação com expand/collapse
- **Editor Integrado** - CodeMirror com syntax highlighting
- **Operações CRUD** - Criar, editar, renomear, deletar
- **Preview** - Visualização de imagens
- **Pesquisa** - Busca rápida de arquivos

### 5. Git Visual

- **Status em Tempo Real** - Mudanças destacadas
- **Gestão de Branches** - Criar, trocar, deletar
- **Commit Visual** - Stage/unstage com interface gráfica
- **Histórico** - Visualize commits anteriores
- **Pull Requests** - Integração com GitHub

### 6. Mobile Experience

- **PWA Support** - Instale como app nativo
- **Touch Gestures** - Swipe e tap otimizados
- **Bottom Navigation** - Navegação thumb-friendly
- **Responsive Layouts** - Adaptação automática
- **Offline Support** - Funciona sem conexão

## 🔒 Segurança

### Sistema de Permissões

Por padrão, todas as ferramentas estão **desabilitadas** por segurança:

1. Acesse **Settings** (ícone de engrenagem)
2. Vá para a aba **Tools**
3. Habilite apenas as ferramentas necessárias
4. Salve as configurações

### Ferramentas Disponíveis

- **File Operations** - Leitura/escrita de arquivos
- **Terminal Access** - Execução de comandos
- **Git Operations** - Controle de versão
- **MCP Servers** - Servidores de contexto

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```bash
# Portas dos Serviços
PORT=8080                    # Backend Node.js
VITE_PORT=9000              # Frontend
VIBE_PORT=8081              # Vibe Kanban

# URLs
VITE_SERVER_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_VIBE_URL=http://localhost:8081

# Segurança
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Features
ENABLE_AUTH=true
ENABLE_MCP=true
ENABLE_VOICE=true

# Vibe Kanban
VIBE_NO_BROWSER=true
VIBE_DATABASE_URL=sqlite://./data/vibe.db
```

### MCP (Model Context Protocol)

Suporte completo para servidores MCP:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "config": {
        "directories": ["/path/to/project"]
      }
    }
  }
}
```

## 🚀 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia todos os serviços
npm run dev:network      # Desenvolvimento com acesso rede
npm run server           # Apenas backend Node.js
npm run client           # Apenas frontend
npm run vibe-backend     # Apenas Vibe Kanban

# Produção
npm run build            # Build de produção
npm run start            # Inicia em produção
npm run preview          # Preview do build

# Utilitários
npm run tunnel           # Cloudflare tunnel
npm run ngrok            # Ngrok tunnel
npm run lint             # Linting
npm run format           # Formatação
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add: Amazing Feature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- Use ESLint e Prettier
- Siga as convenções do projeto
- Adicione testes quando possível
- Documente novas funcionalidades

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - CLI oficial da Anthropic
- [Vibe Kanban](https://github.com/vibe-kanban) - Sistema de tarefas em Rust
- [React](https://react.dev/) - Biblioteca UI
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS

## 💖 Patrocinadores

- [Siteboon - AI powered website builder](https://siteboon.ai)

---

<div align="center">
  <strong>Feito com ❤️ para a comunidade Claude Code</strong>
</div>