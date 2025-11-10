export function analyzePastedContentServer(input) {
  const text = String(input || '').trim();
  const result = { prompts: [], snippets: [], env: [] };
  if (!text) return result;

  const codeBlocks = [];
  let remaining = text;
  const fenceRe = /```(\w+)?\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(text))) {
    codeBlocks.push({ language: (m[1] || 'text').toLowerCase(), code: m[2].trim() });
  }
  remaining = text.replace(fenceRe, '').trim();

  const envLines = [];
  const nonEnvLines = [];
  remaining.split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l) return;
    if (/^(export\s+)?[A-Z0-9_]+\s*=/.test(l)) envLines.push(l.replace(/^export\s+/, ''));
    else nonEnvLines.push(line);
  });

  envLines.forEach((l) => {
    const idx = l.indexOf('=');
    const key = l.slice(0, idx).trim();
    const value = l.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
    if (key) result.env.push({ key, value, masked: /key|token|secret/i.test(key) });
  });

  codeBlocks.forEach((b, i) => {
    const firstLine = (b.code.split(/\r?\n/).find((l) => l.trim()) || '').trim();
    const title = `${capitalize(b.language)} Snippet ${i + 1}${firstLine ? `: ${firstLine.slice(0, 40)}` : ''}`;
    result.snippets.push({ id: `sn-${Date.now()}-${i}`, title, language: b.language, description: '', code: b.code });
  });

  const promptText = nonEnvLines.join('\n').trim();
  if (promptText) {
    const title = (promptText.split(/\n/)[0] || 'Prompt').slice(0, 80).replace(/^#+\s*/, '') || 'Prompt';
    const variables = detectTemplateVariables(promptText).map((name) => ({ name, example: '' }));
    result.prompts.push({ id: `pr-${Date.now()}`, title, description: '', tags: [], variables, template: promptText });
  }

  codeBlocks.forEach((b) => {
    if (['env', 'dotenv', 'properties', 'sh', 'bash'].includes(b.language)) {
      b.code.split(/\r?\n/).forEach((line) => {
        const l = line.trim();
        if (/^(export\s+)?[A-Z0-9_]+\s*=/.test(l)) {
          const s = l.replace(/^export\s+/, '');
          const idx = s.indexOf('=');
          const key = s.slice(0, idx).trim();
          const value = s.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
          if (key) result.env.push({ key, value, masked: /key|token|secret/i.test(key) });
        }
      });
    }
  });

  return result;
}

function detectTemplateVariables(template) {
  const set = new Set();
  const re = /\{([a-zA-Z0-9_\.]+)\}/g;
  let m;
  while ((m = re.exec(String(template || '')))) set.add(m[1]);
  return Array.from(set);
}

function capitalize(s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); }

