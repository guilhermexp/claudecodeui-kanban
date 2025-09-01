# Relatório de Análise e Refatoração do Código

## Visão Geral
Este documento resume a análise de lógica e estrutura do projeto, apontando refatorações prioritárias, duplicidades, componentes/arquivos obsoletos e recomendações práticas para manutenção e evolução.

## Estrutura do Projeto
- `src/`: UI em React (componentes, contexts, hooks, utils). Entradas: `src/main.jsx` e `src/App.jsx`.
- `server/`: API Express + WebSocket (`server/index.js`), rotas em `server/routes/*`, utilitários em `server/lib/*` e `server/utils/logger.js`.
- `scripts/`: orquestração do dev (`scripts/dev.js`), HTTPS, rede e manutenção.
- `vibe-kanban/` (opcional): backend Rust e UI TSX própria.
- `public/`, `dist/`, `docs/`, `examples/`, `certs/`, `.env*`.

## Refatorações Prioritárias
- Componentes muito grandes (quebrar por responsabilidades):
  - `src/components/OverlayChatClaude.jsx` (~111KB): extrair hooks (sessão/stream/patch), subcomponentes de UI e um logger condicional.
  - `src/components/PreviewPanel.jsx` (~75KB), `src/components/Shell.jsx` (~81KB), `src/components/Sidebar.jsx` (~68KB), `src/components/FileManagerSimple.jsx` (~41KB): mover IO/parse para `src/utils/*` e UI em subcomponentes.
  - `server/index.js` (~120KB): separar inicialização HTTP, WS e middlewares em módulos (`server/lib/ws/*`, `server/lib/http/*`).
- Logging: padronizar console no frontend via `src/utils/logger.js` (gate por `NODE_ENV`) e usar `server/utils/logger.js` no backend.

## Duplicidades e Convergências
- Overlays Codex/Claude: `MessageList.jsx`, `MessageItem.jsx`, `MarkdownConfig.jsx`, `CodeBlockCollapsible.jsx` existem em `overlay-codex/` e `overlay-claude/`. Avaliar extrair primitives compartilhadas para `src/components/overlay-shared/` mantendo variações por provider.
- Util `cn()` duplicado: `src/lib/utils.js` (JS) e `src/lib/vibe-kanban/utils.ts` (TS). Unificar na versão TS tipada e exportar façade JS se necessário.
- `scroll-area` duplicado em `src/components/ui/scroll-area.jsx` e `src/components/vibe-kanban/ui/scroll-area.tsx`. Consolidar estilo/API.

## Possíveis Obsolescências / Não Usados
- Componentes: `src/components/ProjectsModalNew.jsx` (não referenciado).
- Hooks: `src/hooks/useShellSessions.js`, `src/hooks/useAudioRecorder.js` (não referenciados; funcionalidades atuais usam `MicButton` + `utils/whisper.js`).
- Diretórios vazios: `src/services/`, `src/types/`, `src/styles/` (remover ou adicionar README de intenção).
- Temporários: `src/components/.OverlayChatClaude.jsx.swp` (remover).

## Segurança e Configuração
- `server/middleware/auth.js` alerta sobre JWT default. Em produção, exigir `JWT_SECRET` e revisar CORS/rate limit.
- Portas padrão: UI `5892`, API `7347`, Rust `6734`. Preferir HTTPS local para microfone/autenticação (`npm run setup:https` + `npm run dev:https`).

## Testes e Qualidade
- Sem suíte formal; priorizar Playwright E2E para fluxos: chat (Codex/Claude), Shell/WS, Projects.
- ESLint: aplicar regras do `.eslintrc.js` e ativar `no-duplicate-imports`, `import/order`.
  - Comandos: `npx eslint src server --max-warnings=0`.

## Ações Recomendadas (ordem sugerida)
1) Remover arquivos temporários e diretórios vazios não usados.
2) Excluir ou integrar `ProjectsModalNew.jsx` e hooks não referenciados.
3) Introduzir `src/utils/logger.js` e substituir `console.*` no frontend.
4) Fatiar `OverlayChatClaude.jsx` e `server/index.js` em módulos menores.
5) Unificar `cn()` e criar `overlay-shared` para componentes comuns.
6) Adicionar testes E2E mínimos para regressão dos fluxos críticos.

## Diagrama de Arquitetura (ASCII)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                               Navegador (UI)                              │
│  React (src/)                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ App.jsx                                                               │  │
│  │ ├─ Providers: Theme/Auth/ClaudeWebSocket                              │  │
│  │ ├─ MainContent                                                        │  │
│  │ │  ├─ OverlayChat (Codex) / OverlayChatClaude                         │  │
│  │ │  ├─ Shell, PreviewPanel, FileManager, Sidebar                       │  │
│  │ │  └─ utils (websocket, chat-*, detectPreviewUrl, etc.)               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                    ▲                               │ WS (/ws, /claude)     │
│                    │ HTTP (Vite assets, /api/*)    │                       │
└────────────────────┼───────────────────────────────┼───────────────────────┘
                     │                               │
     Dev: Vite (5892)                                │
                     │                               │
┌────────────────────┴───────────────────────────────▼───────────────────────┐
│                         Backend Express/WebSocket (7347)                   │
│  server/index.js                                                           │
│  ├─ routes/: auth, files, git, system, usage, preview, claude-stream       │
│  ├─ lib/: ProcessManager, previewManager, cache, vibe-proxy                │
│  ├─ utils/logger.js                                                        │
│  ├─ codex-cli.js / claude-cli.js (spawn providers)                         │
│  └─ database (better-sqlite3)                                              │
└────────────────────┬───────────────────────────────┬───────────────────────┘
                     │ HTTP proxy (quando usado)     │ Child processes/APIs  
                     │                               │ (OpenAI/CLI/etc.)     
┌────────────────────▼───────────────────────────────┴───────────────────────┐
│                     Vibe Kanban Backend (opcional, 6734)                   │
│  vibe-kanban/backend (Rust) – integrado via `vibe-proxy`                   │
└────────────────────────────────────────────────────────────────────────────┘
```

Fluxo típico (dev): `npm run dev` inicia Vite (5892), Express (7347) e opcionalmente o backend Rust (6734). O UI consome assets via Vite e comunica com o backend via HTTP/WS; o backend orquestra CLI providers, proxies e persistência.

## Fluxo Interno do OverlayChat

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OverlayChat / OverlayChatClaude                  │
│ UI: input (texto/voz/anexos)                                            │
│  ├─ useMessageFeedback: curadoria/feedback de mensagens                 │
│  ├─ useClaudeSession: estado da sessão (id, provider, opções)           │
│  └─ useClaudeStream: consumo de stream (SSE/WS)                         │
└───────────────▲───────────────────────────────────────────────┬─────────┘
                │                                               │
                │ dispatch                                      │ patches/events
                │                                               │
        ┌───────┴────────┐                               ┌──────┴───────────┐
        │ ClaudeWebSocket│                               │ SSE: /api/claude │
        │ Context        │                               │ WS:  /ws         │
        │ (utils/websocket.js)                           │                   │
        └───────▲────────┘                               └────────▲──────────┘
                │ HTTP/WS                                           │
┌───────────────┴───────────────────────────────────────────────────┴───────┐
│                           Backend Express/WebSocket                      │
│  routes/claude-stream.js → SSE (Claude)                                  │
│  routes/* + server/index.js → WS broker (/ws)                             │
│  lib/ProcessManager → spawns: codex-cli.js / claude-cli.js                │
│  Emite eventos incrementais (JSON Patch) → cliente aplica no estado       │
└───────────────────────────────────────────────────────────────────────────┘

Pontos-chave
- Envio: UI monta payload (sessão/opções/arquivos) e envia via WS (/ws) ou SSE start (/api/claude).
- Retorno: servidor emite eventos (incrementais) aplicados via JSON Patch, atualizando a UI sem re-render completo.
- Persistência leve: `src/utils/chat-history.js`, `chat-session.js` e preferências em `chat-prefs.js`.
- Integrações: `PreviewPanel` pode enviar conteúdo via `window.pushToOverlayChat` para iniciar interações.
```
