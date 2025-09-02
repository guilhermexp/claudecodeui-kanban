# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React UI (JSX), hooks, contexts, components, utils. Entry: `src/main.jsx`, app: `src/App.jsx`.
- `server/`: Node/Express API + WebSocket gateway (`server/index.js`) and middleware, routes, database, config.
- `public/`: Static assets served by Vite. `dist/`: production build output.
- `scripts/`: Dev/HTTPS/port helpers (e.g., `scripts/dev.js`, `setup-https.sh`).
- (Vibe Kanban removido): O backend Rust não faz parte deste repo.
- `docs/`, `examples/`, `certs/`, `.env*`: documentation, samples, local HTTPS, environment.

## Build, Test, and Development Commands
- `npm run dev`: Full-stack dev. UI on `http://localhost:5892`, API on `http://localhost:7347` (Rust backend on `:6734` if available). Auto-restarts server.
- `npm run server` / `npm run client`: Start backend or Vite UI individually. Network variants: `server:network`, `client:network`.
- `npm run build` / `npm run preview`: Build UI with Vite, then preview the static build.
- `npm run start`: Build UI then start backend.
- Diagnostics: `npm run port-status`, `npm run stop-all`, `npm run switch-to-dev|switch-to-prod`.
- HTTPS: `npm run setup:https` then `npm run dev:https` (uses `certs/` + `vite.config.https.js`).
- Useful checks: `node validate-claude-integration.js`, `node test-websocket-fix.js`.

## Coding Style & Naming Conventions
- ESLint: 2-space indent, single quotes, semicolons, no unused vars, `no-console` in production. Run: `npx eslint src server`.
- React components: PascalCase file/component names (e.g., `OverlayChat.jsx`). Functions/vars: camelCase.
- Keep modules focused; prefer arrow functions and `const`. Avoid broad changes in unrelated files.

## Testing Guidelines
- No formal automated test suite yet. Perform manual smoke tests: start with `npm run dev`, verify chat, terminal, projects, and WebSocket flows.
- Contributions adding tests are welcome. Prefer Playwright E2E; place specs under `tests/e2e` named `*.spec.(js|ts)` and document how to run them in your PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits where possible: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`. Example: `fix: improve light/dark mode in OverlayChat`.
- PRs: clear description, scope, linked issues, repro steps, and screenshots/GIFs for UI changes. Note breaking changes.
- Before opening: run `npm run build` and, if relevant, `npm run preview`. Keep diffs focused and update docs when behavior changes.

## Security & Configuration Tips
- Never commit secrets. Copy `.env.example` to `.env` locally; keep `.env` out of PRs.
- Prefer local HTTPS during auth/integration work (`setup:https` + `dev:https`).
- Default ports: UI `5892`, API `7347`, optional Rust backend `6734`.
