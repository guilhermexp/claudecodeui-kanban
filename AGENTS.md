# Repository Guidelines

## Project Structure & Modules
- `src/`: React UI (components, pages, utils). Use PascalCase for component files.
- `server/`: Node.js/Express API and WebSocket server.
- `public/`: Static assets served by Vite.
- `docs/`: Additional documentation.
- `vibe-kanban/` and `stagewise-integration/`: Optional task/kanban tooling.
- `backend/`: Auxiliary services (e.g., usage tracking).

## Build, Test, and Development
- `npm run dev`: Start full dev stack (server + client on ports 8080/9000).
- `npm run dev:https`: Dev over HTTPS (see `scripts/setup-https.sh`).
- `npm run dev:network`: Expose on LAN (0.0.0.0).
- `npm run server` / `npm run client`: Run backend or frontend only.
- `npm run build`: Build client with Vite into `dist/`.
- `npm run preview`: Serve built client for local preview.
- `npm start`: Build then start production server.
- Useful ops: `npm run port-status`, `npm run switch-to-dev|switch-to-prod`, `npm run stop-all`.

## Coding Style & Naming
- Indentation: 2 spaces; quotes: single; semicolons: required.
- Enforce via ESLint (`.eslintrc.js`): `eqeqeq`, `prefer-const`, `no-var`, `curly: all`, `brace-style: 1tbs`, no stray logs.
- React: function components with hooks; file names match exported component (e.g., `MyPanel.jsx`).
- Variables/functions: `camelCase`; components: `PascalCase`; constants: `UPPER_SNAKE_CASE`.

## Testing Guidelines
- No formal unit test harness yet. Validate manually:
  - UI: `npm run dev`, exercise chat, terminal, file ops, Git actions.
  - Server: try API routes that your change touches and watch logs.
- Add tests when feasible (e.g., Jest/Vitest for utils) in `src/__tests__/` with `*.test.(js|ts)`.

## Commit & Pull Requests
- Commits: imperative, concise subject (<72 chars). Emojis/scopes optional (seen in history: ✨, 🔧, ♻️).
- PRs must include:
  - Purpose, scope, and linked issues.
  - Screenshots/GIFs for UI changes.
  - Notes on env vars, migrations, or scripts touched.
  - Checklist: ran `npm run build` and smoke-tested dev flow.

## Security & Configuration
- Copy `.env.example` to `.env`; never commit secrets. Key vars: `JWT_SECRET`, `PORT`, `VITE_PORT`, `VIBE_PORT`.
- Prefer HTTPS in dev/prod; see `scripts/setup-https.sh` and `vite.config.https.js`.
- Keep rate limits and auth in `server/` intact when adding routes.

