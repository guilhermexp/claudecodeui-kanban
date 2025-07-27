# ⚠️ IMPORTANTE - Ordem dos Proxies no Vite

## Regra Crítica

**AS ROTAS DO VIBE KANBAN DEVEM VIR ANTES DO PROXY GENÉRICO `/api`**

## ❌ ERRADO (não funciona)

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true
  },
  // ❌ Vibe Kanban DEPOIS - NÃO FUNCIONA!
  '/api/vibe-kanban': {
    target: 'http://localhost:8081',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
  }
}
```

## ✅ CORRETO (funciona)

```javascript
proxy: {
  // ✅ Vibe Kanban PRIMEIRO - FUNCIONA!
  '/api/vibe-kanban': {
    target: 'http://localhost:8081',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
  },
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true
  }
}
```

## Por quê?

O Vite processa os proxies na ordem em que aparecem. Se o proxy genérico `/api` vier primeiro, ele captura TODAS as requisições que começam com `/api`, incluindo `/api/vibe-kanban`.

## Como Verificar

1. Execute `npm run health` para verificar a saúde dos serviços
2. Execute `./start-safe.sh` para iniciar com verificações de segurança
3. Verifique no console do navegador se há erros 404 para rotas do Vibe Kanban

## Estrutura de Serviços

- **Claude Code Backend**: Porta 8080 (rotas `/api/*`)
- **Vibe Kanban Backend**: Porta 8081 (rotas `/api/vibe-kanban/*`)
- **Vite Frontend**: Porta 9000 (serve o frontend e faz proxy)

## Scripts de Proteção

- `npm run health` - Verifica se todos os serviços estão funcionando
- `npm run start:safe` - Inicia com verificações de segurança
- `npm run dev` - Inicia todos os serviços normalmente