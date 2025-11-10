# Claude Code UI - Refatoração e Correções Críticas
## Product Requirements Document (PRD)

### 📋 **Objetivo**
Corrigir vulnerabilidades de segurança, problemas de arquitetura e memory leaks no Claude Code UI, mantendo funcionalidade existente.

### 🎯 **Metas de Sucesso**
- ✅ Zero vulnerabilidades de segurança conhecidas
- ✅ Componentes < 500 linhas (quebrar monolitos)
- ✅ WebSocket connections com cleanup adequado
- ✅ Bundle size reduzido em 20%
- ✅ Memory leaks eliminados

## 🚨 **FASE 1: SEGURANÇA CRÍTICA**
*Prazo: Imediato*

### Task 1.1: Corrigir Vulnerabilidades de Dependências
- [ ] Atualizar multer (DoS vulnerability - HIGH)
- [ ] Atualizar prismjs/react-syntax-highlighter (DOM Clobbering - MODERATE)
- [ ] Executar `npm audit fix` completo
- [ ] Verificar compatibilidade após updates

### Task 1.2: Corrigir Falhas de Autenticação
- [ ] Remover JWT secret hardcoded
- [ ] Implementar validação JWT em todas rotas WebSocket
- [ ] Corrigir CORS permissivo (`Access-Control-Allow-Origin: *`)
- [ ] Adicionar rate limiting por usuário

### Task 1.3: Implementar WebSocket Security
- [ ] Autenticação obrigatória em todas mensagens
- [ ] Timeout de conexões inativas
- [ ] Validação de origem das conexões
- [ ] Logs de segurança detalhados

## 🏗️ **FASE 2: REFATORAÇÃO ARQUITETURAL**
*Prazo: 2-3 dias*

### Task 2.1: Quebrar OverlayChatClaude (3,400 linhas)
```
OverlayChatClaude.jsx →
├── hooks/
│   ├── useChatState.js (estado centralizado)
│   ├── useWebSocketConnection.js (conexão única)
│   └── useChatHistory.js (persistência)
├── components/
│   ├── ChatInterface.jsx (UI principal)
│   ├── MessageList.jsx (lista de mensagens)
│   ├── ChatInput.jsx (input e attachments)
│   ├── SessionControls.jsx (controles de sessão)
│   └── ProviderSwitcher.jsx (Claude/Codex)
```

### Task 2.2: Consolidar Estado Global
- [ ] Criar store único para chat state (Zustand ou Context otimizado)
- [ ] Remover duplicação de estado entre componentes
- [ ] Implementar state persistence unificado
- [ ] Eliminar race conditions entre estados

### Task 2.3: WebSocket Singleton Pattern
- [ ] Implementar WebSocketManager singleton
- [ ] Consolidar múltiplas conexões em uma única
- [ ] Implementar reconnection automático
- [ ] Adicionar connection pooling

## 🔧 **FASE 3: MEMORY LEAKS E PERFORMANCE**
*Prazo: 1-2 dias*

### Task 3.1: Cleanup Event Listeners
- [ ] Auditoria completa de addEventListener sem cleanup
- [ ] Implementar pattern de cleanup em todos useEffect
- [ ] Verificar document/window event listeners
- [ ] Adicionar AbortController para fetch requests

### Task 3.2: WebSocket Connection Cleanup
- [ ] Implementar cleanup em desmontagem de componentes
- [ ] Adicionar connection status tracking
- [ ] Implementar graceful disconnect
- [ ] Monitorar conexões órfãs

### Task 3.3: Process Manager Improvements
- [ ] Implementar timeout para processos orphan
- [ ] Adicionar monitoring de processos ativos
- [ ] Cleanup automático de processos stale
- [ ] Logs detalhados de lifecycle

## 🧹 **FASE 4: CÓDIGO MORTO E OTIMIZAÇÕES**
*Prazo: 1 dia*

### Task 4.1: Remover Código Morto
- [ ] Remover imports não utilizados (25+ arquivos)
- [ ] Eliminar variáveis não usadas
- [ ] Remover componentes obsoletos
- [ ] Limpar comentários TODO/FIXME antigos

### Task 4.2: Bundle Optimization
- [ ] Implementar code splitting por rota
- [ ] Lazy loading de componentes pesados
- [ ] Tree shaking de dependências não usadas
- [ ] Otimizar imports (direct imports vs namespace)

### Task 4.3: Dependências - Updates Seguros
- [ ] Atualizar dependências patch/minor
- [ ] Testar compatibilidade antes de major updates
- [ ] Documentar breaking changes necessários
- [ ] Criar migration guide se necessário

## 📊 **MÉTRICAS DE ACOMPANHAMENTO**

### Segurança
- `npm audit` → 0 vulnerabilidades
- WebSocket auth coverage → 100%
- CORS configuração → Específica por ambiente

### Performance
- Bundle size: Atual (~2.5MB) → Meta (<2MB)
- Largest component: Atual (3,400 linhas) → Meta (<500 linhas)
- Memory usage: Baseline → -20%

### Code Quality
- Cyclomatic complexity: Reduzir componentes >15
- Code duplication: <5%
- Test coverage: Baseline → +30%

## 🚦 **CRITÉRIOS DE ACEITE**

### FASE 1 - Segurança
- [ ] `npm audit` retorna 0 vulnerabilidades
- [ ] JWT secrets vêm apenas de variáveis ambiente
- [ ] CORS configurado por ambiente (não global *)
- [ ] Rate limiting implementado e testado

### FASE 2 - Arquitetura
- [ ] Nenhum componente com >500 linhas
- [ ] Estado global consolidado (single source of truth)
- [ ] WebSocket singleton funcionando
- [ ] Testes unitários para novos hooks

### FASE 3 - Memory/Performance
- [ ] Memory profiler não mostra leaks
- [ ] Todos useEffect com cleanup
- [ ] WebSocket connections fecham adequadamente
- [ ] Process manager monitora orphans

### FASE 4 - Otimização
- [ ] ESLint passa sem warnings de unused vars/imports
- [ ] Bundle size reduzido >15%
- [ ] Code splitting implementado
- [ ] Performance benchmarks melhorados

## 🛠️ **FERRAMENTAS DE MONITORAMENTO**

### Durante Desenvolvimento
```bash
# Security
npm audit
npm outdated

# Performance  
npm run build --analyze
npx bundlephobia

# Memory
Chrome DevTools Memory tab
React DevTools Profiler

# Code Quality
ESLint --report-unused-disable-directives
SonarQube (opcional)
```

### Pós-Implementação
- Monitoring de memory usage em produção
- WebSocket connection metrics
- Performance budgets no CI/CD
- Security scanning automático

---

**Prioridade de Execução:** FASE 1 → FASE 2 → FASE 3 → FASE 4

**Owner:** Development Team  
**Stakeholders:** Security, DevOps, Product  
**Timeline:** 5-7 dias de desenvolvimento + 2-3 dias de testes
