Uma interface web moderna para o Claude Code CLI com gerenciamento de tarefas integrado.

## 🚀 Recursos

- 💬 **Interface de Chat**: Converse com Claude diretamente na interface web
- 🖥️ **Terminal Integrado**: Execute comandos sem sair da aplicação
- 📁 **Explorador de Arquivos**: Navegue e edite arquivos do projeto
- 🔄 **Integração Git**: Gerencie branches e commits
- 📊 **Dashboard de Uso**: Acompanhe estatísticas e custos de uso do Claude
- 📋 **Vibe Kanban**: Sistema de gerenciamento de tarefas integrado
- 🎙️ **Transcrição de Voz**: Use comandos de voz com OpenAI Whisper
- 🌙 **Modo Escuro**: Interface adaptável com tema claro/escuro
- 📱 **Suporte Mobile**: Interface responsiva com PWA

## 📋 Requisitos

- Node.js 18+
- Claude Code CLI instalado (`npm install -g @anthropic-ai/claude-code`)
- Token de autenticação Claude válido
- (Opcional) Rust/Cargo para Vibe Kanban backend

## 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/claudecodeui.git
cd claudecodeui

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações
```

## 🚀 Uso

### Desenvolvimento
```bash
npm run dev
```
Acesse http://localhost:9000

### Produção
```bash
npm run build
npm start
```

### Com acesso à rede
```bash
npm run dev:network
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Autenticação JWT
JWT_SECRET=seu_jwt_secret_aqui

# OpenAI (para transcrição de voz)
OPENAI_API_KEY=sua_chave_openai_aqui

# Portas
PORT=8080
VITE_PORT=9000
 
```

### Autenticação

1. Faça login com suas credenciais
2. O sistema criará automaticamente um usuário se não existir
3. Tokens JWT são usados para manter a sessão

## 🏗️ Arquitetura

### Frontend (React + Vite)
- **Port 9000**: Interface web
- React 18 com hooks
- Tailwind CSS para estilização
- CodeMirror para edição de código
- XTerm.js para terminal

### Backend (Node.js + Express)
- **Port 8080**: API e WebSocket
- SQLite para persistência
- JWT para autenticação
- Integração com Claude Code CLI

#### Integração Codex CLI (OpenAI)

O backend também suporta o Codex CLI (OpenAI) via múltiplas estratégias de spawn. Para ambientes com caminhos não padrão, use variáveis de ambiente:

- `CODEX_SCRIPT_PATH`: caminho absoluto para o script `codex.js` (ex.: `/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js`). Quando definido, o servidor roda `node <execPath> <codex.js> exec ...`.
- `CODEX_BIN`: comando binário a ser usado (ex.: `codex` ou `npx @openai/codex`). Pode incluir argumentos adicionais antes; o servidor acrescenta `exec --json ...`.

O servidor loga qual estratégia foi usada (bin, node+script ou shell+npx), o `cwd` e o `PATH` efetivo para facilitar diagnóstico de `ENOENT`.

### Vibe Kanban (Rust + Actix)
- **Port 8081**: Sistema de tarefas
- SQLite compartilhado
- Integração Git

## 🔒 Segurança

- Todas as ferramentas são desabilitadas por padrão
- Configure permissões em Settings > Tools
- Tokens JWT com expiração configurável
- HTTPS recomendado para produção

## 📊 Dashboard de Uso

O Dashboard coleta dados reais do Claude CLI de `~/.claude/projects/`:
- Estatísticas de tokens (input/output/cache)
- Custos calculados com preços oficiais da Anthropic
- Sessões e duração de uso
- Análise por projeto e modelo

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia ambiente de desenvolvimento
- `npm run build` - Compila para produção
- `npm start` - Inicia servidor de produção
- `npm run server` - Apenas servidor backend
- `npm run client` - Apenas frontend
- `npm run vibe-backend` - Apenas Vibe Kanban

## 📝 Licença

MIT

## 🤝 Suporte

Para problemas ou dúvidas, abra uma issue no GitHub.
