# Arquitetura do Projeto

Web UI para Claude Code com integração Vibe Kanban e dashboard de uso. Três serviços principais: Frontend (Vite/React), Backend Node/Express, e Vibe Kanban (Rust/Actix), orquestrados em desenvolvimento pelo script `npm run dev`.

## Visão Geral
- Frontend (React 18 + Vite) — porta 9000
- Backend (Node.js/Express + WebSocket) — porta 8080
- Vibe Kanban (Rust/Actix) — porta 8081

## Executar
- Desenvolvimento: `npm run dev` (ou `npm run dev:network` para rede)
- Produção: `npm run build && npm run start`

## Frontend (src)
- `src/App.jsx`: roteamento e proteção de sessão
- `src/components/MainContent.jsx`: navegação de abas (Shell, Files, Git, Tasks, Dashboard)
- `src/components/Sidebar.jsx`: lista de projetos e sessões (ícones automáticos, favoritos, rename, etc.)
- `src/components/Shell.jsx`: terminal (XTerm) com WebSocket
- `src/components/FileTree.jsx`: browser de arquivos e edição
- `src/components/GitPanel.jsx`: operações Git
- `src/components/Dashboard.jsx` + `Dashboard.css`: métricas de uso
- `src/components/VibeTaskPanel.jsx`: painel deslizante do Vibe Kanban
- `src/utils/api.js`: cliente HTTP autenticado
- `src/utils/projectAnalyzer.js`: análise predominante de tecnologia (via backend)
- `src/utils/projectIcons.jsx`: detecção e rendering de ícones (VK → Trello, logo real, tech fallback)
- `src/index.css` + Tailwind

## Backend (server)
- `server/index.js`: servidor Express + WebSocket, watchers, endpoints e proxy Vibe
- `server/projects.js`: descoberta de projetos, sessões e arquivos
- `server/routes/*`: rotas modulares (auth, git, mcp, usage)
- `server/database/db.js`: SQLite para autenticação e uso
- `server/lib/vibe-proxy.js`: proxy robusto para Vibe Kanban

### Endpoints principais
- Config e saúde
  - GET `/api/health`
  - GET `/api/config`
- Projetos e sessões
  - GET `/api/projects`
  - GET `/api/projects/:projectName/sessions?limit&offset`
  - GET `/api/projects/:projectName/sessions/:sessionId/messages`
  - PUT `/api/projects/:projectName/rename` { displayName }
  - DELETE `/api/projects/:projectName/sessions/:sessionId`
  - DELETE `/api/projects/:projectName`
  - POST `/api/projects/create` { path }
  - GET `/api/projects/:projectName/file?filePath=ABSOLUTE` (texto)
  - PUT `/api/projects/:projectName/file` { filePath, content }
  - GET `/api/projects/:projectName/files` (árvore de arquivos limitada)
  - GET `/api/projects/:projectName/files/content?path=ABSOLUTE` (binário; imagens, etc.)
  - GET `/api/projects/:projectName/logo` (detecção de favicon/logo com cache)
  - GET `/api/projects/analyze?path=ABSOLUTE` (análise leve da stack com cache)
- Git
  - Prefixo `/api/git/*` (via `server/routes/git.js`)
- Auth
  - Prefixo `/api/auth/*` (login, status, user)
- Usage
  - Prefixo `/api/usage/*` (dashboard)
- WebSocket
  - `/ws` (chat/CLI)
  - `/shell` (terminal)
- Uploads de imagem
  - POST `/api/projects/:projectName/upload-images`
  - GET `/api/images/:imageId` (acesso público controlado para chat)
- Vibe Kanban
  - Proxy em `/api/vibe-kanban/*`
  - Uploads dedicados: POST `/api/vibe-kanban/upload-image`

## Observações de Segurança
- Todas as rotas `/api/*` (exceto `auth/*` e alguns servidores de imagem) exigem token (Bearer). O frontend usa `authenticatedFetch`.
- Endpoints de conteúdo binário são servidos via URL assinada pela sessão; para logos, o frontend baixa via fetch autenticado e gera `ObjectURL`.

## Watchers e Cache
- Watcher (chokidar) em `~/.claude/projects` com debounce: dispara atualização de projetos via WebSocket.
- Caches em memória (TTL ~1h):
  - Logos de projetos (`/api/projects/:projectName/logo`)
  - Resultado de análise (`/api/projects/analyze`)
- Caches são limpos quando o watcher detecta mudanças.

## Fluxo de Ícones na Sidebar
1. Se projeto é Vibe Kanban → ícone Trello (fixo)
2. Tentar logo real (favicon/logo) via `/api/projects/:name/logo` → fetch autenticado → `ObjectURL`
3. Fallback: tecnologia predominante (python, react, etc.)
4. Fallback final: pasta (aberta/fechada)

## Vibe Kanban (vibe-kanban)
- Backend Rust/Actix em `vibe-kanban/backend` (porta 8081)
- Integração por proxy e painel dentro do frontend (slide over)

## Scripts
- `npm run dev`: orquestração inteligente (mata portas, restart, logs coloridos)
- `npm run dev:network`: modo rede (HOST 0.0.0.0, imprime IP local)
- `./start-network.sh`: wrapper que chama o modo rede
- `npm run server` / `npm run client` / `npm run vibe-backend`: serviços individuais

---

> Este diagrama é gerado a partir da estrutura atual do repositório e pode ser atualizado conforme novas rotas ou componentes forem adicionados.
