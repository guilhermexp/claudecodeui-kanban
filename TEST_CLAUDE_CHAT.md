# Teste do Claude Chat via WebSocket

## Mudanças Realizadas

### 1. OverlayChatClaude.jsx
- **REMOVIDO**: useClaudeStream hook (SSE)
- **ADICIONADO**: Envio via WebSocket com `type: 'claude-command'`
- **MODIFICADO**: startSession para usar WebSocket
- **MODIFICADO**: endSession para limpar estado local

### 2. Formato de Mensagem
```javascript
// Novo formato (WebSocket)
sendMessage({ 
  type: 'claude-command', 
  command: fullMessage,
  options: {
    projectPath: projectPath,
    cwd: projectPath,
    sessionId: claudeSessionId,
    resume: !!claudeSessionId && claudeSessionActive,
    model: modelMap[selectedModel],
    images: imageAttachments
  }
});
```

### 3. Backend (Já Existente)
- `server/index.js`: Recebe `claude-command` via WebSocket
- `server/claude-cli.js`: Função `spawnClaude()` executa Claude CLI

## Como Testar

1. Abrir o app em http://localhost:5892
2. Clicar no botão "Claude" na barra superior
3. Iniciar uma sessão Claude
4. Enviar uma mensagem simples como "Hello"
5. Verificar se a resposta é recebida

## Problemas Removidos

- ❌ SSE connection (`/api/claude-stream/stream`)
- ❌ HTTP POST (`/api/claude-stream/message`)
- ❌ useClaudeStream hook
- ❌ normalizeClaudeEvent complexo
- ❌ Migração de session IDs

## Vantagens da Nova Implementação

- ✅ Usa mesma infraestrutura do Shell (comprovadamente funcional)
- ✅ Código mais simples e direto
- ✅ Melhor performance (sem npx download)
- ✅ Sessões mais simples
- ✅ Menos pontos de falha