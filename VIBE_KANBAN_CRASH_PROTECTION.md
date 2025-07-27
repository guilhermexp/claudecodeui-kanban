# Proteção Contra Crashes do Vibe Kanban

## Problema Identificado

O servidor está caindo durante a execução de tarefas longas do Vibe Kanban. Isso já aconteceu múltiplas vezes, especialmente no final das tarefas.

## Causas Possíveis

1. **Esgotamento de Memória**: Tarefas longas podem consumir muita memória
2. **Timeout de Processos**: O Node.js pode estar matando processos longos
3. **Erros Não Tratados**: Exceções durante a execução de tarefas
4. **Conflito de Recursos**: Múltiplos processos competindo por recursos

## Soluções Implementadas

### 1. Script de Desenvolvimento Protegido

```bash
npm run dev:protected
```

**Recursos**:
- ✅ Monitoramento de recursos (CPU e memória)
- ✅ Rastreamento de crashes com histórico
- ✅ Detecção de tarefas ativas durante crashes
- ✅ Restart automático inteligente (com delay progressivo)
- ✅ Limite de memória aumentado (4GB)
- ✅ Logs detalhados de erros

### 2. Análise de Crashes

```bash
npm run analyze:crashes
```

**Fornece**:
- 📊 Resumo de todos os crashes
- 🔍 Padrões de crashes identificados
- 💾 Análise de uso de memória
- 💡 Recomendações específicas

### 3. Configurações de Proteção

O script `dev:protected` automaticamente:

1. **Aumenta limite de memória do Node.js**: 4GB por padrão
2. **Ativa stack traces do Rust**: Para debug melhor
3. **Monitora tarefas do Vibe Kanban**: Rastreia qual tarefa estava rodando
4. **Delay progressivo de restart**: Evita loops de crash

## Como Usar

### Para Desenvolvimento Normal

```bash
# Use o modo protegido se tiver problemas com crashes
npm run dev:protected

# Após crashes, analise o que aconteceu
npm run analyze:crashes
```

### Se Continuar Crasheando

1. **Aumente a memória**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=8192"  # 8GB
   npm run dev:protected
   ```

2. **Verifique logs específicos**:
   - Procure por "MEMORY EXHAUSTION" nos logs
   - Veja se há padrões nas tarefas que causam crashes

3. **Monitore recursos durante tarefas**:
   ```bash
   # Em outro terminal
   watch -n 1 'ps aux | grep -E "(node|cargo)" | grep -v grep'
   ```

## Sinais de Alerta

O script mostrará avisos quando:
- 🟡 CPU > 80% de uso
- 🟡 Memória > 85% de uso
- 🔴 3+ crashes em 5 minutos
- 🔴 Crashes durante tarefas do Vibe Kanban

## Logs e Diagnóstico

Os crashes são salvos em:
- **macOS/Linux**: `/tmp/claudecode-crashes.json`
- **Windows**: `%TEMP%\claudecode-crashes.json`

## Recomendações para Tarefas Longas

1. **Divida tarefas grandes** em subtarefas menores
2. **Monitore o progresso** no terminal do Vibe Kanban
3. **Use o modo protegido** para tarefas críticas
4. **Salve trabalho frequentemente** (commits parciais)

## Solução de Longo Prazo

Se os crashes persistirem, considere:

1. **Executar Vibe Kanban separadamente**:
   ```bash
   # Terminal 1
   npm run server
   
   # Terminal 2
   npm run client
   
   # Terminal 3
   cd vibe-kanban && cargo run --release
   ```

2. **Usar PM2 para gerenciamento de processos**:
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   ```

3. **Investigar a tarefa específica** que causa crashes:
   - Verifique logs do Vibe Kanban
   - Teste a tarefa isoladamente
   - Procure por loops infinitos ou uso excessivo de memória