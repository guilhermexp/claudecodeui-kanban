# Claude Code Integration - Status Report

## 📋 Situação Atual

### ✅ O que foi implementado:

1. **Separação de Interfaces**
   - Dois botões independentes no menu principal: "Codex" e "Claude"
   - Removido o dropdown selector que estava misturando os estados
   - Cada botão abre seu próprio chat panel isolado

2. **Isolamento de Componentes**
   - Duas instâncias separadas do OverlayChat:
     - `chatId="codex-instance"` para Codex AI
     - `chatId="claude-instance"` para Claude Code
   - Provider fixo via prop `cliProviderFixed` - não pode ser alterado em runtime

3. **Estados Segregados**
   - Mensagens separadas: `codexMessages` e `claudeMessages`
   - Sessões independentes: `codexSessionId` e `claudeSessionId`
   - Estados de sessão isolados: `codexSessionActive` e `claudeSessionActive`
   - Cada instância mantém seu próprio histórico

4. **Backend Parcialmente Integrado**
   - Claude CLI configurado em `/server/claude-cli.js`
   - Usa `node` para executar o script diretamente
   - Formato corrigido: `stream-json` ao invés de `json-stream`
   - Handlers WebSocket implementados para ambos CLIs

### ⚠️ Problemas Identificados:

1. **Erro de Execução do Claude CLI**
   - Erro anterior: "spawn /opt/homebrew/bin/claude ENOENT"
   - Corrigido parcialmente usando node diretamente
   - Ainda pode ter problemas de path em alguns ambientes

2. **Remontagem Excessiva do Componente**
   - OverlayChat está remontando múltiplas vezes (logs mostram ~30 montagens)
   - Possível problema com React.StrictMode ou re-renders desnecessários

3. **Mistura de Configurações**
   - Claude estava recebendo modelos do OpenAI (gpt-4o, gpt-5)
   - Codex estava enviando flags incorretas para Claude
   - Corrigido removendo `modelLabel` para Claude

## 🎯 Desejo (Estado Final Esperado)

### Interface Ideal:
1. **Dois sistemas completamente independentes**
   - Botão Codex → Chat Codex com suas ferramentas e modelos
   - Botão Claude → Chat Claude com suas ferramentas e modelos
   - Zero compartilhamento de estado ou configuração

2. **Experiência do Usuário**
   - Clicar em um botão abre apenas aquele chat
   - Sessões persistentes e independentes
   - Histórico separado para cada CLI
   - Sem confusão entre os sistemas

3. **Isolamento Técnico**
   - WebSocket connections separadas
   - Configurações independentes
   - Sem vazamento de estado entre instâncias
   - Logs claramente identificados

## 🚧 Situação Atual vs Desejo

### ✅ Já Alcançado:
- Interface com dois botões separados
- Instâncias isoladas do OverlayChat
- Estados de mensagens e sessões separados
- Identificação única via chatId
- Provider fixo que não pode ser alterado

### ❌ Ainda Faltando:
- WebSocket connections verdadeiramente separadas (ainda usa o mesmo hook)
- Resolver problema de remontagem excessiva
- Testes completos de integração end-to-end
- Validação de que Claude CLI está funcionando corretamente

## 📝 Próximos Passos

### 1. **Criar WebSocket Connections Separadas** [PRIORITÁRIO]
```javascript
// Em vez de um único useWebSocket compartilhado:
const { ws: codexWs, ... } = useWebSocket(authReady, 'codex');
const { ws: claudeWs, ... } = useWebSocket(authReady, 'claude');
```

### 2. **Otimizar Remontagem do Componente**
- Investigar causa das múltiplas montagens
- Remover React.StrictMode se necessário
- Implementar memoização adequada
- Verificar dependencies dos useEffect

### 3. **Testar Claude CLI End-to-End**
- Verificar se o Claude responde corretamente
- Testar com diferentes comandos
- Validar normalização de mensagens
- Confirmar que os tool calls funcionam

### 4. **Implementar Persistência Separada**
```javascript
// localStorage keys separados:
localStorage.setItem('codex-chat-history', ...);
localStorage.setItem('claude-chat-history', ...);
localStorage.setItem('codex-session', ...);
localStorage.setItem('claude-session', ...);
```

### 5. **Adicionar Indicadores Visuais**
- Ícones diferentes para cada CLI
- Cores distintas para cada chat
- Badge mostrando qual CLI está ativo
- Status de conexão individual

### 6. **Logging e Debug Melhorado**
```javascript
console.log(`[${chatId}][${cliProvider}] Event:`, eventType);
// Ex: [claude-instance][claude] Session started
// Ex: [codex-instance][codex] Message sent
```

### 7. **Testes de Isolamento**
- Abrir ambos os chats simultaneamente
- Enviar mensagens em paralelo
- Verificar que não há interferência
- Confirmar que sessões são independentes

## 🔧 Configuração Recomendada

### Para Desenvolvimento:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend  
npm run client

# Terminal 3 - Logs
tail -f server/logs/claude.log
tail -f server/logs/codex.log
```

### Para Teste:
1. Clicar no botão "Codex" → Verificar que abre chat Codex
2. Iniciar sessão → Enviar mensagem → Verificar resposta
3. Clicar no botão "Claude" → Verificar que abre chat Claude
4. Iniciar sessão → Enviar mensagem → Verificar resposta
5. Alternar entre os dois → Confirmar que mantém estados

## 📊 Métricas de Sucesso

- [ ] Zero compartilhamento de estado entre Codex e Claude
- [ ] Cada chat mantém sua própria sessão
- [ ] Logs mostram claramente qual instância está ativa
- [ ] Sem erros de "spawn ENOENT" no Claude
- [ ] Componentes montam apenas uma vez
- [ ] WebSocket connections independentes
- [ ] Usuário pode usar ambos simultaneamente sem conflitos

## 🚨 Riscos e Mitigações

1. **Risco**: WebSocket connections podem conflitar
   - **Mitigação**: Implementar namespace ou paths diferentes

2. **Risco**: Estados podem vazar entre instâncias
   - **Mitigação**: Usar contextos React separados

3. **Risco**: Claude CLI pode não funcionar em todos ambientes
   - **Mitigação**: Adicionar fallback e detecção de ambiente

4. **Risco**: Performance com duas instâncias simultâneas
   - **Mitigação**: Lazy loading e code splitting

---

**Status Geral**: 70% Completo
**Próxima Ação**: Implementar WebSocket connections separadas
**Prazo Estimado**: 2-3 horas para completar implementação