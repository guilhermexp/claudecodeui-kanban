# Claude Code SDK Integration

Este projeto agora inclui os SDKs oficiais do Claude Code para Python e JavaScript/TypeScript, permitindo integração programática com o Claude Code CLI.

## 📦 SDKs Instalados

### 1. **Python SDK** (`claude-code-sdk/`)
- **Localização**: `/claude-code-sdk/`
- **Documentação**: [Claude Code SDK Python](https://github.com/anthropics/claude-code-sdk-python)
- **Versão**: Latest from GitHub

### 2. **JavaScript/TypeScript SDK** 
- **Pacote NPM**: `@anthropic-ai/claude-code`
- **Versão**: 1.0.98
- **Instalado via**: `npm install --save-dev @anthropic-ai/claude-code`

### 3. **Community JS SDK**
- **Pacote NPM**: `claude-code-js`
- **SDK alternativo da comunidade com funcionalidades adicionais**

## 🚀 Como Usar

### Pré-requisitos
```bash
# Instalar Claude Code CLI globalmente
npm install -g @anthropic-ai/claude-code

# Verificar instalação
claude --version
```

### JavaScript/TypeScript
```javascript
import { ClaudeCodeSDK } from '@anthropic-ai/claude-code';

const claude = new ClaudeCodeSDK();
const response = await claude.query({
  prompt: "Sua pergunta aqui",
  allowedTools: ['Read', 'Write', 'Bash']
});
```

### Python
```python
from claude_code_sdk import query, ClaudeCodeOptions

async for message in query(prompt="Sua pergunta aqui"):
    print(message)
```

## 📝 Exemplos Disponíveis

### 1. **JavaScript Demo** (`examples/claude-code-sdk-demo.js`)
Exemplos práticos incluindo:
- Queries simples
- Uso com ferramentas (tools)
- Sessões interativas
- Streaming de respostas
- Geração de código

**Executar:**
```bash
node examples/claude-code-sdk-demo.js [simple|tools|interactive|stream|codegen]
```

### 2. **TypeScript Demo** (`examples/claude-code-sdk-demo.ts`)
Implementação tipada com:
- Cliente wrapper customizado
- Análise de código
- Geração de testes
- Refatoração automática
- Criação de features completas

**Executar:**
```bash
npx tsx examples/claude-code-sdk-demo.ts
```

### 3. **Python Demo** (`examples/claude_code_sdk_demo.py`)
Exemplos em Python incluindo:
- Cliente wrapper com métodos utilitários
- Análise de código estruturada
- Geração de testes com pytest
- Refatoração com melhorias específicas
- Tratamento de erros

**Executar:**
```bash
python examples/claude_code_sdk_demo.py [all|simple|analysis|tests|refactor|feature|error]
```

## 🔧 Integração com o Projeto

### Possíveis Integrações

1. **Backend Integration** (`server/`)
   - Adicionar endpoints que usam o SDK para operações avançadas
   - Criar serviço de análise de código em tempo real
   - Implementar geração automática de testes

2. **Frontend Features** (`src/`)
   - Botão "Analyze with Claude" no editor de código
   - Geração de código assistida por IA
   - Refatoração automática com preview

3. Vibe Kanban Integration: removed from this repository
   - Criar tasks automaticamente baseadas em análise de código
   - Sugerir melhorias como tasks
   - Auto-completar descrições de tasks

4. **CLI Tools** (`scripts/`)
   - Scripts de automação usando o SDK
   - Ferramentas de CI/CD com Claude Code
   - Validação de código antes de commits

## 🛠️ Configuração Avançada

### Opções do SDK

```javascript
const options = {
  // Sistema de prompts
  systemPrompt: "You are a helpful coding assistant",
  
  // Ferramentas permitidas
  allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
  
  // Modo de permissão
  permissionMode: 'acceptEdits', // auto-aceitar edições
  
  // Limites
  maxTurns: 5,
  timeout: 60000,
  
  // Diretório de trabalho
  workingDirectory: process.cwd()
};
```

### Tratamento de Erros

```javascript
try {
  const response = await claude.query({...});
} catch (error) {
  if (error.code === 'CLI_NOT_FOUND') {
    console.error('Claude Code CLI não instalado');
  } else if (error.code === 'CONNECTION_ERROR') {
    console.error('Erro de conexão');
  }
}
```

## 📚 Recursos Adicionais

- [Documentação Oficial do SDK](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [Claude Code CLI](https://github.com/anthropics/claude-code)
- [SDK Python GitHub](https://github.com/anthropics/claude-code-sdk-python)
- [Exemplos de Uso](https://github.com/hesreallyhim/awesome-claude-code)

## 🔐 Segurança

- O SDK requer autenticação via Claude Code CLI
- Certifique-se de estar logado: `claude login`
- As ferramentas (tools) precisam ser explicitamente permitidas
- Use `permissionMode` para controlar aprovações automáticas

## 🐛 Troubleshooting

### Claude Code CLI não encontrado
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### Erro de autenticação
```bash
claude logout
claude login
```

### Timeout em operações longas
```javascript
const options = {
  timeout: 120000 // 2 minutos
};
```

## 🎯 Próximos Passos

1. **Integrar SDK no backend** para operações avançadas
2. **Criar endpoints API** para funcionalidades do SDK
3. **Adicionar UI components** para interação com Claude
4. **Implementar webhooks** para automação
5. **Criar testes automatizados** usando o SDK

---

Para mais informações, consulte os exemplos em `/examples/` ou a documentação oficial.
