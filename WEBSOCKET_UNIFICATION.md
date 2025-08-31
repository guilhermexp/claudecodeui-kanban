# WebSocket Unification - Migration Guide

## 🎯 Objetivo
Unificar os WebSockets do Shell e Chat em uma única conexão para melhorar a confiabilidade e manutenibilidade.

## 📊 Situação Anterior

### Problemas Identificados:
1. **Duas conexões WebSocket separadas**:
   - `/shell` - Usado pelo componente Shell
   - `/ws` - Usado pelo OverlayChat (Claude e Codex)

2. **Duplicação de código**:
   - Lógica de reconexão duplicada
   - Gerenciamento de sessão duplicado
   - Tratamento de erros duplicado

3. **Inconsistências**:
   - Shell funcionando perfeitamente
   - Chat com problemas de conexão

## ✅ Solução Implementada

### 1. **Novo Context Unificado** (`ClaudeWebSocketContext.jsx`)
- Uma única conexão WebSocket para toda aplicação
- Gerenciamento centralizado de reconexão
- Sistema de handlers para múltiplos consumidores
- Suporte para Shell, Claude Chat e Codex

### 2. **Hook Helper** (`useClaudeSession.js`)
- Interface simplificada para componentes
- Abstração das diferenças entre Shell/Chat/Codex
- Gerenciamento automático de sessões

### 3. **Endpoint Unificado no Servidor** (`/claude`)
- Rota única que gerencia todos os tipos de sessão
- Roteamento baseado em tipo de mensagem
- Mantém compatibilidade com Codex

## 🔄 Como Migrar

### Para usar o OverlayChat unificado:

```jsx
// Antes (OverlayChat.jsx)
import OverlayChat from './components/OverlayChat';

// Depois (OverlayChatUnified.jsx)
import OverlayChatUnified from './components/OverlayChatUnified';

// Uso
<OverlayChatUnified 
  projectPath={projectPath}
  mode="claude" // ou "codex"
/>
```

### Para migrar o Shell:

```jsx
// Em Shell.jsx, substituir conexão direta por:
import { useClaudeSession } from '../hooks/useClaudeSession';

const Shell = () => {
  const {
    isConnected,
    startSession,
    sendMessage,
    sendResize,
    messages
  } = useClaudeSession('shell', {
    projectPath: selectedProject.path
  });
  
  // Usar as funções do hook ao invés de gerenciar WebSocket diretamente
};
```

## 🚀 Benefícios

1. **Código mais limpo**: Uma única implementação robusta
2. **Melhor performance**: Uma conexão, menos overhead  
3. **Maior confiabilidade**: Lógica testada do Shell agora no Chat
4. **Manutenção facilitada**: Um lugar para corrigir bugs
5. **Compatibilidade total**: Codex continua funcionando

## 🔧 Configuração do Servidor

O servidor agora suporta três endpoints WebSocket:
- `/shell` - Mantido para compatibilidade
- `/ws` - Mantido para compatibilidade com Codex
- `/claude` - **NOVO** endpoint unificado (recomendado)

## 📝 Notas Importantes

1. **Retrocompatibilidade**: Os endpoints antigos continuam funcionando
2. **Migração gradual**: Pode migrar um componente por vez
3. **Codex não afetado**: Continua usando `/ws` normalmente
4. **Provider necessário**: Adicionar `ClaudeWebSocketProvider` no App.jsx

## 🧪 Como Testar

1. **Testar OverlayChat unificado**:
```bash
npm run dev
# Abrir o chat e verificar se conecta corretamente
# Enviar mensagens e verificar respostas
```

2. **Verificar que Codex continua funcionando**:
```bash
# Abrir OverlayChat em modo Codex
# Verificar que mensagens são processadas
```

3. **Monitorar WebSocket**:
```bash
# No Chrome DevTools > Network > WS
# Verificar que usa endpoint /claude
# Verificar mensagens sendo trocadas
```

## 🐛 Troubleshooting

### Chat não conecta:
1. Verificar se `ClaudeWebSocketProvider` está no App.jsx
2. Verificar token de autenticação
3. Verificar console para erros

### Mensagens não aparecem:
1. Verificar tipo de mensagem no servidor
2. Verificar handler no useClaudeSession
3. Verificar console para erros de parsing

### Codex parou de funcionar:
1. Codex ainda deve usar `/ws` endpoint
2. Verificar que handleChatConnection ainda existe
3. Verificar mensagens codex-* no servidor

## 🎯 Próximos Passos

1. **Migrar Shell.jsx** para usar o novo sistema
2. **Deprecar endpoints antigos** após migração completa
3. **Adicionar métricas** de performance
4. **Implementar fallback** automático se novo endpoint falhar

---

**Status**: ✅ Implementado e pronto para teste
**Impacto**: Melhoria significativa na confiabilidade do Chat
**Risco**: Baixo (mantém retrocompatibilidade)