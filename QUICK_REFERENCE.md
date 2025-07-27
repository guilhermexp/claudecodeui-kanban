# Claude Code UI + Vibe Kanban - Guia Rápido

## 🚀 Quick Start

```bash
# Clone e setup
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
npm install

# Build Vibe Kanban (Rust)
cd vibe-kanban/backend
cargo build --release
cd ../..

# Configure
cp .env.example .env

# Inicie todos os serviços
npm run dev

# Acesse
- Frontend: http://localhost:9000
- Backend Node.js: http://localhost:8080  
- Vibe Kanban API: http://localhost:8081
```

## 📁 Estrutura Principal

### Arquivos de Configuração
- `.env` - Variáveis de ambiente
- `vite.config.js` - Build frontend
- `tailwind.config.js` - Estilos
- `package.json` - Dependências Node
- `vibe-kanban/backend/Cargo.toml` - Dependências Rust

### Entry Points
- `src/main.jsx` - Frontend React
- `src/App.jsx` - Componente principal
- `server/index.js` - Backend Node.js
- `vibe-kanban/backend/src/main.rs` - Backend Rust

### Componentes Importantes
- `src/components/MainContent.jsx` - Chat interface
- `src/components/Shell.jsx` - Terminal
- `src/components/VibeKanbanApp.jsx` - Kanban app
- `src/components/vibe-kanban/tasks/TaskKanbanBoard.tsx` - Quadro Kanban
- `src/components/vibe-kanban/tasks/TaskDetailsPanel.tsx` - Detalhes de tarefa

## 🛠️ Tarefas Comuns

### Adicionar Novo Componente React
```jsx
// src/components/MyComponent.jsx
import React from 'react';

export default function MyComponent({ props }) {
  return (
    <div className="p-4 bg-background border rounded-lg">
      {/* Conteúdo */}
    </div>
  );
}
```

### Adicionar Nova Rota API (Node.js)
```javascript
// server/routes/myroute.js
import express from 'express';
const router = express.Router();

router.get('/api/myroute', async (req, res) => {
  try {
    const result = await doSomething();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Adicionar Evento WebSocket
```javascript
// Cliente (src/utils/websocket.js)
ws.send(JSON.stringify({
  type: 'my_event',
  sessionId: currentSession,
  data: payload
}));

// Servidor (server/index.js)
ws.on('message', (message) => {
  const data = JSON.parse(message);
  if (data.type === 'my_event') {
    // Processar evento
  }
});
```

### Adicionar Componente Vibe Kanban
```tsx
// src/components/vibe-kanban/MyComponent.tsx
import React from 'react';
import { Card } from '../ui/card';

export function MyKanbanComponent({ task }) {
  return (
    <Card className="p-4">
      <h3>{task.title}</h3>
      <p>{task.description}</p>
    </Card>
  );
}
```

## 🎨 Guia de Estilos

### Tailwind Patterns
```jsx
// Layout responsivo
<div className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4">
  <div className="p-4 md:p-6 lg:p-8">
    {/* Mobile first design */}
  </div>
</div>

// Dark mode support
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <button className="hover:bg-gray-100 dark:hover:bg-gray-800">
    Click me
  </button>
</div>

// Mobile optimizado
<div className="flex flex-col md:flex-row gap-4">
  <button className="h-12 px-6 touch-manipulation">
    Touch Friendly (min 44px)
  </button>
</div>
```

## 📦 Dependências Principais

### Frontend
- `react` & `react-dom` - UI framework
- `@codemirror/*` - Editor de código
- `xterm` - Terminal emulator
- `@dnd-kit/*` - Drag and drop
- `lucide-react` - Ícones
- `tailwindcss` - Estilos

### Backend Node.js
- `express` - Web server
- `ws` - WebSocket
- `better-sqlite3` - Database
- `node-pty` - Terminal
- `jsonwebtoken` - Auth
- `multer` - Upload files

### Backend Rust
- `actix-web` - Web framework
- `sqlx` - Database
- `git2` - Git operations
- `serde` - Serialization

## 🔍 Debugging

### Frontend Debug
```javascript
// Enable debug logs
localStorage.debug = 'app:*';

// Check WebSocket
console.log('WS State:', ws.readyState);

// React DevTools
console.log('Render:', { props, state });
```

### Backend Debug
```javascript
// Node.js debug
DEBUG=express:* npm run server

// Log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Rust debug
RUST_LOG=debug cargo run
```

### Problemas Comuns

1. **Portas em uso**
   ```bash
   # Kill all services
   npm run kill-ports
   # Or manually
   lsof -ti:9000 | xargs kill -9
   lsof -ti:8080 | xargs kill -9  
   lsof -ti:8081 | xargs kill -9
   ```

2. **Vibe Kanban não compila**
   ```bash
   cd vibe-kanban/backend
   cargo clean
   cargo update
   cargo build --release
   ```

3. **WebSocket disconnecting**
   - Check CORS in server/index.js
   - Verify JWT token
   - Check firewall

4. **Mobile issues**
   - Test on real device
   - Check viewport meta tag
   - Use touch-manipulation class

## 📝 Git Workflow

```bash
# Feature branch
git checkout -b feature/vibe-kanban-improvement

# Commit with conventional commits
git add .
git commit -m "feat(kanban): add task templates"

# Push and PR
git push origin feature/vibe-kanban-improvement
```

## 🚢 Deploy

### Production Build
```bash
# Build frontend
npm run build

# Build Vibe Kanban
cd vibe-kanban/backend
cargo build --release
cd ../..

# Start production
NODE_ENV=production npm start
```

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=8080
VIBE_PORT=8081

# Security
SESSION_SECRET=<random-64-chars>
JWT_SECRET=<random-64-chars>

# Features
ENABLE_AUTH=true
ENABLE_VIBE_KANBAN=true
```

### Proxy Setup (Nginx)
```nginx
# Frontend
location / {
  proxy_pass http://localhost:9000;
}

# Backend Node.js
location /api {
  proxy_pass http://localhost:8080;
}

# Vibe Kanban API
location /vibe {
  proxy_pass http://localhost:8081;
}

# WebSocket
location /ws {
  proxy_pass http://localhost:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

## 📚 Recursos

- [Documentação Completa](./PROJECT_INDEX.md)
- [README Principal](./README.md)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [Vibe Kanban Docs](./vibe-kanban/README.md)

---

*Quick Reference - Claude Code UI + Vibe Kanban v1.5.0*