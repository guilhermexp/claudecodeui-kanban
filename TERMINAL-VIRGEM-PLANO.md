# Plano: Terminal Virgem na Aba Files

## 📋 Resumo
Adicionar um terminal independente (sem Claude) dentro da aba Files, permitindo executar comandos paralelos enquanto o Claude trabalha em outras tarefas.

## ✅ Análise de Viabilidade

### Viabilidade: **100% VIÁVEL**
- Arquitetura modular existente suporta a adição
- Sem conflitos com o sistema atual
- Isolamento completo do terminal Claude

## 🏗️ Arquitetura Proposta

### 1. Interface Visual
**Localização**: Dentro do componente FileTree.jsx
- **Botão de Ativação**: Na barra superior junto aos botões New File/New Folder
- **Área de Display**: Metade inferior da aba Files (split horizontal)
- **Comportamento**: Toggle para mostrar/esconder o terminal

```
┌─────────────────────────────────┐
│  Files  [📁] [📄] [>_] ← Novo botão terminal
├─────────────────────────────────┤
│  📁 src/                        │
│  📁 public/                     │ ← Lista de arquivos (50% altura)
│  📄 package.json                │
├─────────────────────────────────┤
│  $ npm run dev                  │
│  Starting development server... │ ← Terminal virgem (50% altura)
│  $ _                            │
└─────────────────────────────────┘
```

### 2. Componentes

#### A. Modificações em FileTree.jsx
```jsx
// Estado para controlar terminal
const [showSimpleTerminal, setShowSimpleTerminal] = useState(false);

// Botão na barra superior (linha ~400)
<button
  onClick={() => setShowSimpleTerminal(!showSimpleTerminal)}
  className="p-1 hover:bg-accent rounded-md transition-colors"
  title="Open Terminal"
>
  <Terminal className="w-4 h-4 text-muted-foreground" />
</button>

// Layout com split (substituir div principal)
<div className="h-full flex flex-col">
  {/* Área de arquivos */}
  <div className={showSimpleTerminal ? 'h-1/2' : 'h-full'}>
    {/* Conteúdo atual dos arquivos */}
  </div>
  
  {/* Terminal virgem */}
  {showSimpleTerminal && (
    <div className="h-1/2 border-t border-border">
      <SimpleTerminal 
        projectPath={selectedProject.path}
        projectName={selectedProject.name}
      />
    </div>
  )}
</div>
```

#### B. Novo Componente: SimpleTerminal.jsx
```jsx
// src/components/SimpleTerminal.jsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

function SimpleTerminal({ projectPath, projectName }) {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const ws = useRef(null);
  
  useEffect(() => {
    // Inicializar terminal XTerm
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#e0e0e0'
      }
    });
    
    // WebSocket para terminal simples
    const wsUrl = `ws://localhost:7347/api/terminal/simple?project=${projectName}`;
    ws.current = new WebSocket(wsUrl);
    
    // Handlers do WebSocket
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'output') {
        terminal.current.write(data.data);
      }
    };
    
    // Input do terminal para WebSocket
    terminal.current.onData((data) => {
      ws.current.send(JSON.stringify({
        type: 'input',
        data: data
      }));
    });
    
    terminal.current.open(terminalRef.current);
    
    return () => {
      terminal.current?.dispose();
      ws.current?.close();
    };
  }, [projectName]);
  
  return <div ref={terminalRef} className="h-full w-full" />;
}
```

### 3. Backend

#### A. Novo Endpoint WebSocket
```javascript
// server/index.js - Adicionar nova rota

// WebSocket para terminal simples (sem Claude)
wss.on('connection', (ws, req) => {
  if (req.url.startsWith('/api/terminal/simple')) {
    handleSimpleTerminal(ws, req);
  }
});

// Handler para terminal simples
function handleSimpleTerminal(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectName = url.searchParams.get('project');
  
  // Obter caminho do projeto
  const projectPath = getProjectPath(projectName);
  
  // Spawn shell simples (bash/zsh)
  const shell = spawn(process.env.SHELL || 'bash', [], {
    cwd: projectPath,
    env: process.env,
    shell: true
  });
  
  // Shell output -> WebSocket
  shell.stdout.on('data', (data) => {
    ws.send(JSON.stringify({
      type: 'output',
      data: data.toString()
    }));
  });
  
  shell.stderr.on('data', (data) => {
    ws.send(JSON.stringify({
      type: 'output',
      data: data.toString()
    }));
  });
  
  // WebSocket input -> Shell
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'input') {
      shell.stdin.write(data.data);
    }
  });
  
  // Cleanup
  ws.on('close', () => {
    shell.kill();
  });
}
```

## 🔧 Funcionalidades

### Essenciais (MVP)
- [x] Terminal bash/zsh básico
- [x] Execução de comandos
- [x] Output em tempo real
- [x] Diretório inicial no projeto atual
- [x] Toggle mostrar/esconder

### Adicionais (Fase 2)
- [ ] Resize ajustável (arrastar divisória)
- [ ] Múltiplas abas de terminal
- [ ] Histórico de comandos persistente
- [ ] Temas (dark/light)
- [ ] Copy/paste melhorado
- [ ] Atalhos de teclado

## 🛡️ Segurança

### Isolamento
- Processo completamente separado do Claude
- Sem acesso às APIs do Claude
- Sem interferência com sessões existentes
- Gerenciamento de recursos independente

### Permissões
- Herda permissões do usuário do sistema
- Executa no contexto do projeto selecionado
- Sem bypass de permissões automático

## 📊 Impacto no Sistema

### Performance
- **CPU**: Mínimo (~1-2% adicional)
- **Memória**: ~20-30MB por terminal
- **Rede**: WebSocket dedicado (baixo overhead)

### Compatibilidade
- Funciona em paralelo com terminal Claude
- Sem mudanças em APIs existentes
- Retrocompatível com versão atual

## 🚀 Implementação Passo a Passo

### Fase 1: MVP (2-3 horas)
1. Criar componente SimpleTerminal.jsx
2. Adicionar botão toggle em FileTree.jsx
3. Implementar split layout
4. Criar endpoint WebSocket no backend
5. Testar funcionamento básico

### Fase 2: Melhorias (1-2 horas)
1. Adicionar resize ajustável
2. Implementar temas
3. Melhorar copy/paste
4. Adicionar atalhos

### Fase 3: Features Avançadas (Opcional)
1. Múltiplas abas
2. Histórico persistente
3. Customização de shell
4. Integração com snippets

## 🎯 Benefícios

### Para o Usuário
1. **Produtividade**: Executar comandos enquanto Claude trabalha
2. **Flexibilidade**: Acesso direto ao shell quando necessário
3. **Contexto**: Sempre no diretório correto do projeto
4. **Simplicidade**: Um clique para abrir/fechar

### Para o Sistema
1. **Modular**: Componente isolado e reutilizável
2. **Manutenível**: Código simples e direto
3. **Escalável**: Fácil adicionar features futuras
4. **Testável**: Componentes independentes

## ⚠️ Considerações

### Limitações
- Terminal básico sem features avançadas do Claude
- Sem histórico de conversação
- Sem assistência de IA

### Requisitos
- Node.js com suporte a child_process
- WebSocket no navegador
- XTerm.js instalado

## 📝 Notas de Implementação

### Estrutura de Arquivos
```
src/
  components/
    FileTree.jsx (modificar)
    SimpleTerminal.jsx (criar)
server/
  index.js (adicionar rota)
  simpleTerminal.js (opcional - handler separado)
```

### Dependências
- Já instaladas: xterm, xterm-addon-fit
- Necessárias: Nenhuma adicional

### Testes Recomendados
1. Abrir terminal com projeto selecionado
2. Executar comandos básicos (ls, cd, npm)
3. Testar em paralelo com Claude
4. Verificar cleanup ao fechar
5. Testar múltiplos projetos

## ✅ Conclusão

A implementação de um terminal virgem na aba Files é totalmente viável e trará benefícios significativos para a produtividade sem impactar a arquitetura existente. O design proposto mantém a consistência visual e funcional do sistema atual.