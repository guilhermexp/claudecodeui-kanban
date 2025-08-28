# Codex Chat – Normalização de Mensagens (Frontend)

Data: 28/08/2025  
Status: Ativo em `main`

## Visão Geral
Esta atualização alinha o tratamento/limpeza de mensagens do Codex no chat embutido do Codeui ao padrão já usado no Vibe Kanban. O objetivo é reduzir ruído técnico, apresentar comandos/ferramentas de forma clara e manter as respostas do agente concisas e legíveis.

Principais pontos:
- Nova normalização inspirada no executor Rust do Vibe Kanban.
- Remoção de mensagens técnicas (task_started, token_count, etc.).
- Apresentação amigável de comandos (bash/shell) e operações de edição (patch).
- Exibição compacta de “Thinking…” quando o Codex envia raciocínio.

## Arquivos Alterados/Adicionados
- `src/utils/codex-normalizer.js` (NOVO)
  - Implementa a normalização de eventos JSON/JSONL do Codex.
  - Converte eventos em mensagens limpas: `assistant`, `system`, `error`.
- `src/components/OverlayChat.jsx`
  - Passa a usar `normalizeCodexEvent(...)` para processar mensagens vindas do WebSocket.
  - Mantém indicadores de digitação e sinais `codex-start`/`codex-complete`.
- `server/codex-cli.js`
  - Já enviava `codex-start`/`codex-complete`; segue compatível com a normalização.

## Regras de Normalização (Resumo)
- Ignorados (ruído técnico): `task_started`, `task_complete`, `token_count`, `exec_command_end`, `patch_apply_end`, eco de `prompt`.
- Parâmetros de Sessão (config): mensagens com campos como `model`, `provider`, `reasoning effort`, etc., viram um bloco “Session Parameters:” apenas com o essencial.
- Respostas do Agente: `msg.type === "agent_message"` → mensagem do assistente (Markdown).
- Erros: `msg.type === "error"` → bolha de erro clara.
- Pensamento/Raciocínio: `agent_reasoning/agent_thinking/reasoning` → bloco compacto “Thinking…”.
- Execução de Comandos: `exec_command_begin` → “🔧 bash”/“🔧 shell” + comando entre crases, derivado do array `command`.
- Edição de Arquivos: `patch_apply_begin` → “🔧 edit: updated files” com sumário de arquivos.
- Fallback de `codex-output` (não‑JSON): só exibe linhas curtas e úteis; filtra linhas com puro conteúdo de config/sandbox.

## Como Testar
1. Inicie o dev: `npm run dev` e autentique-se na UI.
2. Abra o “Codex Assistant” (botão no canto inferior direito).
3. Envie uma mensagem simples (ex.: “oi”).
4. Observe:
   - Sem spam de `token_count`/config/sandbox.
   - Quando o Codex usa ferramentas, veja entradas “🔧 bash …” em destaque.
   - Erros ficam em bolha vermelha; “Thinking…” aparece compacto.

## Compatibilidade / Rollback Rápido
- Para reverter ao comportamento anterior do chat:
  - Remover o import `normalizeCodexEvent` em `src/components/OverlayChat.jsx`.
  - Restaurar o bloco anterior de parsing (ou comentar a chamada à normalização e tratar diretamente `codex-response`/`codex-output`).

## Limitações Conhecidas
- Caso o Codex altere o esquema JSON, algumas regras podem precisar de ajuste.
- Eventos de ferramentas não cobertos explicitamente (além de `exec_command_begin`/`patch_apply_begin`) aparecem como “🔧 {nome}” genérico.
- Linhas não‑JSON muito longas continuam filtradas para evitar poluição visual.

## Próximos Passos (Opcional)
- Toggle “Ocultar Thinking…” nas preferências do usuário.
- Colapsar/expandir saídas longas de ferramentas, com contagem de linhas.
- Ícones específicos por ferramenta (edit/git/bash) e cores distintas.

## Referências
- Vibe Kanban (Rust): lógica de normalização em `vibe-kanban/backend/src/executors/codex.rs`.
- Codeui Frontend: `src/components/OverlayChat.jsx`.
- Normalizador: `src/utils/codex-normalizer.js`.

