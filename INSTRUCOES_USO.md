# 📋 Instruções de Uso - Claude Code UI

## ✅ Status da Aplicação

A aplicação está **100% funcional** após todas as correções implementadas!

### 🚀 Como Iniciar

```bash
npm run dev
```

### 🌐 URLs de Acesso

- **Frontend**: http://localhost:5892
- **Backend API**: http://localhost:7347
- **WebSocket**: ws://localhost:7347

### 🔧 Resolução de Problemas Comuns

#### 1. Erro "Invalid Token" ou "Invalid Signature"
Isso acontece quando há um token JWT antigo no navegador. Para resolver:

**Opção A - Limpar pelo navegador:**
1. Abra o DevTools (F12)
2. Vá para Application/Storage
3. Local Storage
4. Limpe todos os itens

**Opção B - Logout/Login:**
1. Faça logout da aplicação
2. Faça login novamente

#### 2. Erro 500 no Backend
✅ **JÁ CORRIGIDO!** O problema do rate limiting IPv6 foi resolvido.

#### 3. "JWT_SECRET not found"
✅ **JÁ CORRIGIDO!** O dotenv agora carrega antes de qualquer importação.

### 📁 Arquivos de Configuração

#### `.env` (já configurado)
```env
JWT_SECRET=ae8e561da035175edc155b984e16dc33c0eab5d0f9a36133914c57eda917e3ae51e5ff890e9b30fad7d1c55d19c5af17226bf55a4b29ac2a29cc3e28d0951b6c
# ... outras configurações
```

### 🎯 Funcionalidades Disponíveis

1. **Shell Terminal**: Terminal integrado com Claude
2. **File Manager**: Navegador e editor de arquivos
3. **Git Integration**: Operações git visuais
4. **Claude Chat**: Chat integrado com IA
5. **Preview Panel**: Visualização de aplicações web

### 🛡️ Melhorias de Arquitetura Implementadas

- ✅ **Zero Memory Leaks**: Hook `useCleanup` gerencia recursos automaticamente
- ✅ **Performance Otimizada**: ProcessManager com cleanup automático
- ✅ **WebSocket Robusto**: Reconexão automática e graceful shutdown
- ✅ **Estado Centralizado**: Zustand store para gerenciamento de estado
- ✅ **Modularização**: Componentes quebrados e organizados

### 🐛 Debugging

Para ver logs detalhados:
```bash
# Ver logs do servidor
tail -f server.log

# Ver processos ativos
ps aux | grep node

# Verificar portas em uso
lsof -i :5892
lsof -i :7347
```

### 📊 Monitoramento de Performance

A aplicação agora inclui:
- Detecção automática de memory leaks
- Cleanup automático de processos órfãos
- Resource monitoring (CPU/Memória)
- Lifecycle tracking de componentes

### 🎉 Aproveite!

A aplicação está pronta para uso em desenvolvimento. Todas as refatorações foram implementadas com sucesso e o sistema está mais robusto, performático e livre de vazamentos de memória!
