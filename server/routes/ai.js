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

  const chosen = model || process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash';
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosen)}:generateContent?key=${apiKey}`;
    const prompt = `Você é um analista técnico. Resuma, de forma clara e objetiva, o conteúdo a seguir (um bundle de arquivos de um repositório). Responda em ${language}. Explique:\n` +
                   `- O que a aplicação/projeto faz\n` +
                   `- Principais áreas/componentes\n` +
                   `- Tecnologias e stack\n` +
                   `- Como usar/rodar (se dedutível)\n` +
                   `- Possíveis casos de uso\n\n` +
                   `SEMPRE seja sucinto, em 6-10 bullets no máximo.\n\n` +
                   `CONTEÚDO:\n` + text;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    };
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'gemini_error', details: t });
    }
    const data = await r.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!summary) return res.status(500).json({ error: 'empty_summary' });
    return res.json({ summary, model: chosen });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
