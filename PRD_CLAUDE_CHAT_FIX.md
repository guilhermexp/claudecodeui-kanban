# PRD: Correção da Comunicação Claude Chat

## Executive Summary
O chat do Claude no OverlayChatClaude.jsx não está funcionando corretamente devido a uma arquitetura de comunicação diferente e problemática comparada com a implementação funcional do Shell.jsx.

## Análise do Problema

### 1. Arquiteturas Diferentes

#### Shell.jsx (FUNCIONANDO ✅)
- **Protocolo**: WebSocket bidirecional
- **Endpoint**: WebSocket direto em `server/index.js`
- **Mensagens**: `{ type: 'claude-command', command, args, projectPath }`
- **Backend**: `server/claude-cli.js` com spawn direto do Claude CLI
- **Sessão**: Gerenciada via WebSocket connection ID

#### OverlayChatClaude.jsx (QUEBRADO ❌)
- **Protocolo**: SSE (Server-Sent Events) + HTTP POST
- **Endpoints**: 
  - SSE: `/api/claude-stream/stream/:sessionId`
  - POST: `/api/claude-stream/message/:sessionId`
- **Backend**: `server/routes/claude-stream.js` com npx spawn
- **Sessão**: Sistema complexo de IDs temporários e reais

### 2. Problemas Específicos Identificados

#### 2.1 Execução do Claude CLI
```javascript
// PROBLEMA: server/routes/claude-stream.js linha 154
let spawnCommand = '/opt/homebrew/bin/npx'; // Hardcoded path!
let spawnArgs = [
    '-y',
    '@anthropic-ai/claude-code@latest', // Download a cada execução!
    ...
];
```

**Versus implementação funcional:**
```javascript
// FUNCIONANDO: server/claude-cli.js
const claudePath = '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js';
spawn('node', [claudePath, ...args]); // Execução direta!
```

#### 2.2 Gestão de Sessões
- **Problema**: Sistema complexo de migração de IDs de sessão
- **Linhas 106-118** em `claude-stream.js`: Tentativa de migrar sessões temporárias
- **Resultado**: Sessões perdidas, duplicadas ou não inicializadas

#### 2.3 Fluxo de Mensagens
```javascript
// PROBLEMA: Fluxo em 2 etapas
1. Estabelecer SSE: GET /api/claude-stream/stream/:sessionId
2. Enviar mensagem: POST /api/claude-stream/message/:sessionId
// Claude CLI só é iniciado APÓS a primeira mensagem!
```

**Versus:**
```javascript
// FUNCIONANDO: Fluxo único via WebSocket
ws.send({ type: 'claude-command', ... })
// Claude CLI iniciado imediatamente
```

#### 2.4 Parsing de Eventos
- useClaudeStream.js usa `normalizeClaudeEvent()` complexo
- Tentativa de converter eventos Claude para patches JSON
- Overhead desnecessário comparado ao stream direto do Shell

### 3. Comparação de Funcionalidades

| Feature | Shell.jsx ✅ | OverlayChatClaude.jsx ❌ |
|---------|-------------|-------------------------|
| Conexão | WebSocket | SSE + HTTP |
| Inicialização | Imediata | Após primeira mensagem |
| Sessões | Simples | Complexo com migração |
| Claude CLI | Spawn direto | Via npx |
| Streaming | Direto ao terminal | Patches JSON |
| Imagens | Suportado | Parcialmente suportado |
| Reconexão | Automática | Manual |
| Performance | Rápida | Lenta (npx download) |

## Solução Proposta

### Opção 1: Refatorar para WebSocket (RECOMENDADO)
Modificar OverlayChatClaude.jsx para usar a mesma infraestrutura WebSocket do Shell.

**Vantagens:**
- Reutiliza código testado e funcional
- Menor complexidade
- Melhor performance
- Manutenção simplificada

**Implementação:**
1. Remover useClaudeStream hook
2. Usar useWebSocket existente
3. Enviar mensagens como `claude-command`
4. Processar respostas diretamente

### Opção 2: Corrigir Implementação SSE (NÃO RECOMENDADO)
Corrigir todos os problemas da implementação atual.

**Desvantagens:**
- Mantém duplicação de código
- Complexidade desnecessária
- Mais pontos de falha
- Difícil manutenção

## Plano de Implementação (Opção 1)

### Fase 1: Preparação
1. ✅ Documentar problemas atuais (CONCLUÍDO)
2. Backup do código atual
3. Identificar dependências

### Fase 2: Refatoração Frontend
1. Modificar OverlayChatClaude.jsx:
   - Remover useClaudeStream
   - Adicionar useWebSocket
   - Adaptar handlers de mensagem
   
2. Simplificar estado:
   - Remover claudeMessages separado
   - Unificar com sistema de mensagens existente

### Fase 3: Backend
1. Adicionar suporte no WebSocket handler para mensagens de chat
2. Reutilizar `server/claude-cli.js` existente
3. Remover `server/routes/claude-stream.js` (após validação)

### Fase 4: Testes
1. Testar envio de mensagens
2. Validar streaming de respostas
3. Verificar gestão de sessões
4. Testar upload de imagens

## Código de Exemplo

### Frontend Refatorado (Proposta)
```javascript
// OverlayChatClaude.jsx
import { useWebSocket } from '../utils/websocket';

function OverlayChatClaude({ projectPath, ... }) {
  const { ws, sendMessage, messages, isConnected } = useWebSocket(true);
  
  const handleSendMessage = (text, images) => {
    // Usar mesmo formato do Shell
    sendMessage({
      type: 'claude-command',
      command: text,
      args: images ? ['-i', ...images] : [],
      projectPath: projectPath,
      sessionId: currentSessionId
    });
  };
  
  // Processar respostas
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === 'claude-response') {
      addToConversation(lastMsg.data);
    }
  }, [messages]);
}
```

### Backend Unificado (Já Existe)
```javascript
// server/index.js - handleShellConnection
if (data.type === 'claude-command') {
  // Já implementado e funcionando!
  const result = await executeClaudeCommand(
    data.command,
    data.args,
    data.projectPath,
    ws
  );
}
```

## Métricas de Sucesso
- [ ] Chat Claude responde em < 2 segundos
- [ ] Streaming funciona em tempo real
- [ ] Sessões persistem entre mensagens
- [ ] Upload de imagens funcional
- [ ] Sem erros de conexão
- [ ] Código 50% menor

## Riscos e Mitigação
| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Quebrar Shell existente | Baixa | Alto | Testes extensivos |
| Perda de features | Média | Médio | Comparar funcionalidades |
| Complexidade WebSocket | Baixa | Baixo | Código já existe |

## Timeline
- **Dia 1**: Análise e PRD ✅
- **Dia 2**: Refatoração Frontend
- **Dia 3**: Integração Backend
- **Dia 4**: Testes e Validação
- **Dia 5**: Deploy e Monitoramento

## Conclusão
A implementação atual do OverlayChatClaude está fundamentalmente quebrada devido a uma arquitetura desnecessariamente complexa. A solução é simplificar usando a infraestrutura WebSocket já existente e funcional do Shell.jsx.

## Anexos

### A. Arquivos Afetados
- `src/components/OverlayChatClaude.jsx` (refatorar)
- `src/hooks/useClaudeStream.js` (remover)
- `server/routes/claude-stream.js` (remover após migração)
- `src/utils/claude-normalizer.js` (pode ser removido)

### B. Dependências a Remover
- `@microsoft/fetch-event-source`
- `fast-json-patch` (se não usado em outro lugar)

### C. Testes de Validação
1. Enviar mensagem simples
2. Enviar mensagem com imagem
3. Sessão longa (>10 mensagens)
4. Reconexão após disconnect
5. Múltiplas abas simultâneas
6. Troca entre Codex e Claude