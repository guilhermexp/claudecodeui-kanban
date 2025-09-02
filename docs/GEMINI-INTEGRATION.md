# 🤖 Integração com Gemini AI

## Visão Geral

O Claude Code UI integra com a API do Google Gemini para fornecer funcionalidades avançadas de IA:

- **Análise de Conteúdo**: Extrai automaticamente prompts, snippets de código e variáveis de ambiente
- **Resumo de Texto**: Gera resumos concisos de código e documentação  
- **Text-to-Speech**: Converte texto em áudio narrado usando vozes naturais

## 🚀 Configuração Rápida

### 1. Obter Chave API do Gemini

1. Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Clique em "Create API Key" 
3. Copie a chave gerada

### 2. Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```bash
# Gemini API Key (obrigatório)
GEMINI_API_KEY=sua_chave_aqui
# ou
GOOGLE_API_KEY=sua_chave_aqui

# Modelos Gemini (opcional - usa defaults se não configurado)
GEMINI_MODEL=gemini-2.5-pro-exp-02          # Para análise
GEMINI_THINKING_MODEL=gemini-2.5-pro-exp-02  # Para análise complexa
GEMINI_SUMMARY_MODEL=gemini-2.5-flash        # Para resumos rápidos
```

### 3. Instalar Dependências Python (para TTS)

```bash
# macOS/Linux
pip3 install --user --break-system-packages google-genai

# Windows
pip install google-genai
```

## 📋 Endpoints Disponíveis

### POST /api/ai/analyze
Analisa conteúdo e extrai prompts, código e variáveis.

**Request:**
```json
{
  "content": "texto com prompts, código e variáveis",
  "model": "gemini-2.5-pro-exp-02" // opcional
}
```

**Response:**
```json
{
  "source": "gemini",
  "prompts": [...],
  "snippets": [...],
  "env": [...]
}
```

### POST /api/ai/summarize
Gera resumo de texto/código.

**Request:**
```json
{
  "text": "conteúdo para resumir",
  "model": "gemini-2.5-flash", // opcional
  "language": "pt-BR" // opcional
}
```

**Response:**
```json
{
  "summary": "resumo gerado",
  "model": "gemini-2.5-flash"
}
```

### POST /api/tts/gemini-summarize
Converte texto em áudio narrado.

**Request:**
```json
{
  "text": "texto para narrar",
  "voiceName": "Zephyr", // opcional
  "maxSeconds": 30 // opcional
}
```

**Response:**
```json
{
  "url": "/api/audios/aud-xxxxx"
}
```

## 🧪 Teste de Integração

Execute o script de teste:

```bash
node scripts/test-gemini-api.js
```

O script verifica:
- ✅ Configuração de chaves API
- ✅ Instalação de dependências
- ✅ Funcionamento dos endpoints
- ✅ Geração de áudio

## 🎯 Casos de Uso

### 1. PromptsHub
- Analisa conteúdo colado automaticamente
- Detecta e organiza prompts, código e variáveis
- Suporta resumo e TTS de bundles indexados

### 2. Análise de Repositórios
- Resume conteúdo de projetos indexados
- Gera descrições em áudio dos projetos
- Identifica stack tecnológico e funcionalidades

### 3. Documentação Assistida
- Extrai documentação de código
- Gera resumos executivos
- Cria audiobooks técnicos

## ⚙️ Configuração Avançada

### Limites de Payload
O servidor aceita até 50MB de payload JSON:

```javascript
// server/index.js
app.use(express.json({ limit: '50mb' }));
```

### Vozes Disponíveis para TTS
- Zephyr (padrão) - Voz masculina natural
- Breeze - Voz feminina suave
- Thunder - Voz masculina grave
- Rain - Voz feminina neutra

### Modelos Gemini Disponíveis
- **gemini-2.5-pro-exp-02**: Análise complexa e raciocínio
- **gemini-2.5-flash**: Respostas rápidas e resumos
- **gemini-2.5-flash-preview-tts**: Geração de áudio

## 🐛 Troubleshooting

### Erro: "GEMINI_API_KEY not set"
- Verifique se a variável está no `.env`
- Reinicie o servidor após adicionar a chave

### Erro: "No module named 'google.genai'"
```bash
pip3 install --user --break-system-packages google-genai
```

### Erro: "413 Payload Too Large"
- Já corrigido! O limite foi aumentado para 50MB
- Para payloads maiores, considere dividir em chunks

### Erro: "Failed to start python3 process"
- Verifique se Python 3 está instalado: `python3 --version`
- Instale se necessário: `brew install python3` (macOS)

## 📊 Métricas e Limites

### Limites da API Gemini (Free Tier)
- 60 requests por minuto
- 1500 requests por dia
- Máximo 128k tokens por request

### Performance
- Análise: ~1-3 segundos
- Resumo: ~1-2 segundos  
- TTS: ~2-5 segundos (depende do tamanho)

## 🔒 Segurança

- **Nunca commite chaves API**: Use `.env` e `.gitignore`
- **Validação de entrada**: Todos os endpoints validam input
- **Rate limiting**: Proteção contra abuse
- **Fallback local**: Análise funciona sem API em modo degradado

## 📚 Referências

- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API Docs](https://ai.google.dev/docs)
- [google-genai Python](https://pypi.org/project/google-genai/)

---

**Última atualização**: Janeiro 2025  
**Mantenedor**: Claude Code UI Team