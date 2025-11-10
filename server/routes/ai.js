import express from 'express';
import fetch from 'node-fetch';
import { analyzePastedContentServer } from '../utils/promptAnalyzer.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AI-ANALYZE');
const router = express.Router();

router.post('/analyze', async (req, res) => {
  const { content, model } = req.body || {};
  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ error: 'content is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const chosenModel = model || process.env.GEMINI_THINKING_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro-exp-02';

  // If no key, fallback to local analyzer
  if (!apiKey) {
    const local = analyzePastedContentServer(content);
    return res.json({ source: 'local', ...local });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent?key=${apiKey}`;
    const schema = {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              variables: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, example: { type: 'string' } } } },
              template: { type: 'string' }
            },
            required: ['title', 'template']
          }
        },
        snippets: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, language: { type: 'string' }, description: { type: 'string' }, code: { type: 'string' } },
            required: ['title', 'language', 'code']
          }
        },
        env: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, masked: { type: 'boolean' } }, required: ['key', 'value'] } }
      },
      required: ['prompts', 'snippets', 'env']
    };

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Classifique o conteúdo a seguir em 3 coleções: prompts, snippets de código e variáveis de ambiente.' +
                ' Retorne APENAS JSON compatível com o schema fornecido. Respeite blocos ```lang para snippets e linhas KEY=VALUE para env.' +
                ' Detecte variáveis em prompts no formato {variavel}.\n\n' +
                content,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
      },
    };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      log.error(`Gemini error: ${r.status} ${text}`);
      const fallback = analyzePastedContentServer(content);
      return res.json({ source: 'local-fallback', ...fallback, error: 'gemini_error' });
    }
    const data = await r.json();
    const candidate = data.candidates?.[0];
    const jsonText = candidate?.content?.parts?.[0]?.text || candidate?.content?.parts?.[0]?.data || '';
    let parsed;
    try {
      parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    } catch (e) {
      log.warn('Failed to parse Gemini JSON, using local analyzer');
      parsed = analyzePastedContentServer(content);
      return res.json({ source: 'local-fallback', ...parsed, error: 'invalid_json' });
    }

    return res.json({ source: 'gemini', ...parsed });
  } catch (error) {
    log.error(`Analyze route failed: ${error.message}`);
    const fallback = analyzePastedContentServer(content);
    return res.json({ source: 'local-fallback', ...fallback, error: 'exception' });
  }
});

// Summarize large text/bundle into a concise overview (Gemini 2.5 Flash by default)
router.post('/summarize', async (req, res) => {
  const { text, model, language = 'pt-BR' } = req.body || {};
  if (!text || String(text).trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY/GOOGLE_API_KEY not set in environment' });

  // Use Gemini 2.5 Pro for highest quality summaries
  const chosen = model || process.env.GEMINI_SUMMARY_MODEL || 'gemini-exp-1206';
  
  // Calculate text size for context window awareness
  const textLength = text.length;
  const tokenEstimate = Math.ceil(textLength / 4); // Rough estimate: 1 token per 4 chars
  
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosen)}:generateContent?key=${apiKey}`;
    
    // Enhanced prompt for better formatting and comprehensive analysis
    const prompt = `Você é um especialista em análise de código e arquitetura de software com capacidade de processar grandes volumes de informação (janela de contexto de 1M+ tokens).

Analise o repositório abaixo e gere um resumo ESTRUTURADO e BEM FORMATADO seguindo estas diretrizes:

## FORMATO DE SAÍDA OBRIGATÓRIO:

### 📋 Resumo Executivo
Uma descrição clara e concisa do que é o projeto em 1-2 frases.

### 🎯 Objetivo Principal
O propósito central da aplicação/projeto.

### 🏗️ Arquitetura e Componentes
Liste os principais módulos/componentes do sistema de forma organizada.

### 💻 Stack Tecnológico
• **Frontend:** Tecnologias usadas no frontend
• **Backend:** Tecnologias usadas no backend
• **Banco de Dados:** Tipo de banco e tecnologia
• **Infraestrutura:** Deploy, CI/CD, etc.

### ⚙️ Funcionalidades Principais
Liste as principais features identificadas no código.

### 🚀 Como Executar
Instruções claras de instalação e execução (se identificáveis no código).

### 📦 Dependências Importantes
Principais bibliotecas e suas funções no projeto.

### 💡 Casos de Uso
Cenários onde este projeto seria útil.

### 🔑 Pontos de Destaque
Recursos especiais ou diferenciais técnicos notáveis.

## REGRAS IMPORTANTES:
1. Use formatação Markdown limpa e legível
2. Evite asteriscos excessivos ou formatação confusa
3. Seja específico mas conciso (máximo 15-20 linhas totais)
4. Foque em informações práticas e relevantes
5. Use emojis apenas nos títulos das seções
6. Mantenha consistência na formatação
7. Priorize clareza sobre detalhes técnicos excessivos
8. Responda em ${language}

## INFORMAÇÕES DO CONTEXTO:
- Tamanho do conteúdo: ${textLength} caracteres (~${tokenEstimate} tokens)
- Tipo: Bundle de arquivos de repositório
- Modelo processando: ${chosen} (janela de contexto de 1M tokens)

## CONTEÚDO DO REPOSITÓRIO:
${text}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.3, // Slightly higher for better creativity in formatting
        maxOutputTokens: 2048, // Allow for more detailed summaries
        topP: 0.9,
        topK: 40
      },
    };
    
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const t = await r.text();
      log.error(`Gemini summarize error: ${r.status} - ${t}`);
      return res.status(500).json({ error: 'gemini_error', details: t });
    }
    
    const data = await r.json();
    let summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!summary) return res.status(500).json({ error: 'empty_summary' });
    
    // Clean up any excessive markdown artifacts
    summary = summary
      .replace(/\*{3,}/g, '**') // Replace triple+ asterisks with double
      .replace(/\n{3,}/g, '\n\n') // Replace excessive newlines
      .trim();
    
    return res.json({ 
      summary, 
      model: chosen,
      metadata: {
        textLength,
        estimatedTokens: tokenEstimate,
        processedAt: new Date().toISOString()
      }
    });
  } catch (e) {
    log.error(`Summarize error: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
