Uma interface web moderna para o Claude Code CLI - a ferramenta oficial da Anthropic para desenvolvimento com IA.

## 📖 O que é Claude Code UI?

Claude Code UI é uma interface web intuitiva que transforma o Claude Code CLI em uma experiência visual rica. Com três abas principais, você pode:

- **Shell**: Interagir com Claude e executar comandos em um terminal integrado
- **Files**: Navegar e editar arquivos do projeto com syntax highlighting
- **Git**: Gerenciar controle de versão com interface visual

## 🚀 Recursos

### Interface Principal
- 🖥️ **Shell**: Terminal integrado com execução de comandos e chat com Claude
- 📁 **Files**: Explorador de arquivos com editor de código integrado
- 🔄 **Git**: Controle de versão com interface visual para branches e commits

### Recursos Avançados
- 💬 **Chat Integrado**: Converse com Claude diretamente no terminal
- 🎙️ **Comandos de Voz**: Transcrição com OpenAI Whisper
- 📊 **Dashboard de Uso**: Estatísticas e custos de uso do Claude
- 🌙 **Modo Escuro**: Interface adaptável com tema claro/escuro
- 📱 **Suporte Mobile**: Interface responsiva com PWA

## 📋 Requisitos

- Node.js 18+
- Claude Code CLI instalado (`npm install -g @anthropic-ai/claude-code`)
- Token de autenticação Claude válido

## 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/claude-code-ui.git
cd claude-code-ui

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
Acesse http://localhost:5892

### Produção com Túnel Público
```bash
./start-background-prod.sh
```
Acesso público via https://claudecode.ngrok.app

### Produção Local
```bash
npm run build
npm start
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Autenticação JWT
JWT_SECRET=seu_jwt_secret_aqui

# OpenAI (para transcrição de voz)
OPENAI_API_KEY=sua_chave_openai_aqui

# Portas (configuração automática)
BACKEND_PORT=7347
FRONTEND_PORT=5892
```

### Autenticação

1. Faça login com suas credenciais
2. O sistema criará automaticamente um usuário se não existir
3. Tokens JWT são usados para manter a sessão

## 🏗️ Arquitetura

Claude Code UI é uma aplicação web moderna com arquitetura cliente-servidor:

### Frontend (React + Vite)
- **Port 5892**: Interface web responsiva
- React 18 com hooks e context API
- Tailwind CSS com sistema de temas
- CodeMirror 6 para edição de código
- XTerm.js para emulação de terminal
- WebSocket para comunicação em tempo real

### Backend (Node.js + Express)
- **Port 7347**: API REST e servidor WebSocket
- SQLite para persistência de dados
- JWT para autenticação segura
- Integração direta com Claude Code CLI
- Sistema de proteção de portas automático

## 🔒 Segurança

- Sistema de proteção de portas automático
- Todas as ferramentas MCP desabilitadas por padrão
- Tokens JWT com expiração configurável
- Validação de entrada em todas as APIs
- HTTPS recomendado para produção

## 📊 Dashboard de Uso

O Dashboard coleta dados reais do Claude CLI de `~/.claude/projects/`:
- Estatísticas de tokens (input/output/cache)
- Custos calculados com preços oficiais da Anthropic
- Sessões e duração de uso
- Análise por projeto e modelo

## 🛠️ Scripts Disponíveis

### Desenvolvimento
- `npm run dev` - Ambiente de desenvolvimento completo (recomendado)
- `npm run server` - Apenas backend (port 7347)
- `npm run client` - Apenas frontend (port 5892)

### Produção
- `npm run build` - Compila para produção
- `npm start` - Servidor de produção
- `./start-background-prod.sh` - Produção com túnel público

### Gerenciamento de Portas
- `npm run port-status` - Verifica status das portas
- `npm run stop-all` - Para todos os processos
- `npm run switch-to-dev` - Muda para modo desenvolvimento
- `npm run switch-to-prod` - Muda para modo produção

### Claude Hooks (Notificações Sonoras)
- `npm run hooks:enable` - Ativa notificações sonoras
- `npm run hooks:disable` - Desativa notificações sonoras
- `npm run hooks:status` - Verifica configuração atual
- `npm run hooks:list` - Lista sons disponíveis
- `npm run hooks:test <sound>` - Testa um som específico

## 🔧 Solução de Problemas

### Erro "Port already in use" (EADDRINUSE)
```bash
npm run port-status  # Verifica conflitos
npm run stop-all     # Para todos os processos
npm run dev          # Reinicia desenvolvimento
```

### Terminal não aceita entrada
- Verifique se o WebSocket está conectado
- Atualize a página
- Reinicie o servidor de desenvolvimento

### Dashboard sem dados
- Verifique se o Claude Code CLI está configurado
- Confirme que existe `~/.claude/projects/`
- Verifique permissões de arquivo

## 📝 Licença

MIT

## 🤝 Suporte

Para problemas ou dúvidas, abra uma issue no GitHub.
