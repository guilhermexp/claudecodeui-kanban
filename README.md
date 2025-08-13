# Claude C<img width="1510" height="872" alt="09-git-integration-panel" src="https://github.com/user-attachments/assets/4aa14f00-366b-43e6-80c7-a2341a9aabe5" />
ode UI![10-mobile-responsive-view](https://github.com/user-attachments/assets/8b55b546-f480-4826-ab93-583c6ecd0b50)
<img width="1505" height="865" alt="08-file-browser-interface" src="https://github.com/user-attachments/assets/886d4baf-b76c-464b-9f04-adec27fdbba3" />
<img width="1512" height="875" alt="07-dashboard-analytics" src="https://github.com/user-attachments/assets/9dfe84ce-0e34-4b5e-a981-8d183a3c6aa8" />
<img width="1512" height="875" alt="06-terminal-shell-interface" src="https://github.com/user-attachments/assets/46a0174e-4bcc<img width="1512" height="821" alt="05-main-interface-overview" src="https://github.com/user-attachments/assets/527dce0d-1ec1-4708-bdfa-3b11c303665b" />
-4cbf-8c7e-8fc5da7351f5" /><img width="560" height="869" alt="01-mcp-servers-settings" src="https://github.com/user-attachments/assets/4f389de1-d72c-42db-875a-0553e77add2f" />



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
VIBE_PORT=8081
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
