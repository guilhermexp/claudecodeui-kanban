import express from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../utils/logger.js';

const log = createLogger('PROMPT-ENHANCER');
const router = express.Router();

// POST /api/prompt-enhancer/enhance
// Body: { input: string, format: 'text'|'json'|'xml'|'yaml', system?: string, model?: string, temperature?: number }
router.post('/enhance', async (req, res) => {
  const { input, format = 'text', system = '', model, temperature = 0.3, mode = 'standard' } = req.body || {};
  if (!input || String(input).trim().length === 0) {
    return res.status(400).json({ error: 'input is required' });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ_TOKEN;
  const chosenModel = model || process.env.GROQ_MODEL || 'moonshotai/kimi-k2-instruct';

  if (!apiKey) {
    return res.status(400).json({ error: 'missing_groq_key' });
  }

  // Build formatter guardrails
  const fmt = String(format).toLowerCase();
  const formatHints = {
    text: `Return only the improved instructions as plain text. Use structured sections: Objective, Constraints, Steps, Acceptance Criteria.`,
    json: `Return ONLY strict JSON. Schema: { "meta": {"enhanced": true}, "instructions": string, "structure": {"goals": string[], "constraints": string[], "deliverables": string[], "steps": string[]} }`,
    xml: `Return ONLY XML with root <prompt>. Include <generatedAt>, <instructions>, and <structure> with <goals>, <constraints>, <steps>.`,
    yaml: `Return ONLY YAML with keys: meta: { enhanced: true }, instructions: |, structure: { goals: [..], constraints: [..], steps: [..] }`,
  };

  const presetHints = {
    standard: '',
    implementacao: 'Foco: implementação de funcionalidade. Gere plano de implementação, passos objetivos, impactos em código/arquitetura e critérios de aceite. Inclua exemplos curtos quando útil.',
    bugs: 'Foco: correção de bugs. Gere passos de reprodução, hipótese de causa raiz, plano de correção, riscos, testes de regressão e validação final.',
    refatoracao: 'Foco: refatoração. Gere objetivos técnicos, escopo, riscos, plano incremental, melhoria de legibilidade/complexidade e critérios de aceite.'
  };

  const systemPrompt =
    (system || '').trim() ||
    'Você é um Aprimorador de Prompt. Reescreva a entrada de forma clara, estruturada e objetiva, mantendo intenção e contexto. Organize por objetivo, restrições, passos e critérios de aceite. Adapte o formato (Text/JSON/XML/YAML) conforme solicitado.';

  const modeNote = presetHints[String(mode).toLowerCase()] || '';
  const userPrompt = `Entrada a aprimorar (formato: ${fmt.toUpperCase()}):\n\n${input}\n\nDiretiva de saída: ${formatHints[fmt] || formatHints.text}${modeNote ? `\n\nContexto do modo: ${modeNote}` : ''}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      log.error(`Groq error ${r.status}: ${text}`);
      return res.status(500).json({ error: 'groq_error', details: text });
    }
    const data = await r.json();
    let content = data?.choices?.[0]?.message?.content || '';

    // Strict format validation
    const ensureStrict = (out) => {
      if (fmt === 'json') {
        // Try to extract and parse JSON strictly
        const tryParse = (txt) => {
          try { return { ok: true, value: JSON.parse(txt) }; } catch { return { ok: false }; }
        };
        // Bare attempt
        let parsed = tryParse(out.trim());
        if (!parsed.ok) {
          // Try between first { and last }
          const i = out.indexOf('{');
          const j = out.lastIndexOf('}');
          if (i !== -1 && j !== -1 && j > i) {
            parsed = tryParse(out.slice(i, j + 1));
            if (parsed.ok) out = out.slice(i, j + 1);
          }
        }
        if (!parsed.ok) return { ok: false, error: 'invalid_json' };
        // Optionally, check required keys
        const { meta, instructions, structure } = parsed.value || {};
        if (!structure || !Array.isArray(structure.steps)) return { ok: false, error: 'json_schema_mismatch' };
        return { ok: true, output: JSON.stringify(parsed.value, null, 2) };
      }
      if (fmt === 'xml') {
        const ok = /<prompt[\s>]/.test(out) && /<\/prompt>/.test(out);
        return ok ? { ok: true, output: out } : { ok: false, error: 'invalid_xml' };
      }
      if (fmt === 'yaml') {
        // Heuristic check for required sections
        const hasKeys = /\bmeta:\b/.test(out) && /\binstructions:\b/.test(out) && /\bstructure:\b/.test(out);
        return hasKeys ? { ok: true, output: out } : { ok: false, error: 'invalid_yaml' };
      }
      return { ok: true, output: out }; // text
    };

    const strict = ensureStrict(content);
    if (!strict.ok) {
      return res.status(422).json({ error: 'format_validation_failed', reason: strict.error, raw: content });
    }

    return res.json({ output: strict.output, model: chosenModel, provider: 'groq', format: fmt });
  } catch (e) {
    log.error(`Enhance exception: ${e.message}`);
    return res.status(500).json({ error: 'exception', message: e.message });
  }
});

export default router;
