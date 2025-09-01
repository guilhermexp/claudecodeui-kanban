// Lightweight normalizer to present Claude events cleanly
// Inspired by Vibe-Kanban normalized conversation (but trimmed for UI overlay)

function asTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && block.type === 'text') return block.text || '';
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (typeof content === 'object') return content.text || '';
  return '';
}

function formatToolUse(block) {
  // Convert tool_use blocks into short, readable lines
  if (!block || typeof block !== 'object') return '';
  const name = String(block.tool_name || block.name || 'tool');
  const type = name.toLowerCase();
  // Common tools mapped to one-liners
  if (type.includes('read')) {
    const p = block.input?.file_path || block.input?.path || block.input?.file || '';
    return p ? `📖 Read: ${p}` : '📖 Read';
  }
  if (type.includes('glob')) {
    const pat = block.input?.pattern || block.input?.glob || '';
    return pat ? `🧭 Find files: ${pat}` : '🧭 Find files';
  }
  if (type.includes('grep')) {
    const q = block.input?.query || block.input?.pattern || '';
    return q ? `🔎 Grep: ${q}` : '🔎 Grep';
  }
  if (type.includes('bash')) {
    const cmd = block.input?.command || block.input?.cmd || '';
    return cmd ? `💻 Bash: ${cmd}` : '💻 Bash';
  }
  if (type.includes('write') || type.includes('edit')) {
    const p = block.input?.file_path || block.input?.path || '';
    return p ? `✏️ Edit: ${p}` : '✏️ Edit';
  }
  // Default
  return `🔧 ${name}`;
}

function extractToolLinesFromContent(content) {
  if (!Array.isArray(content)) return [];
  const lines = [];
  for (const block of content) {
    if (block && typeof block === 'object' && block.type === 'tool_use') {
      const line = formatToolUse(block);
      if (line) lines.push(line);
    }
  }
  return lines;
}

function tryExtractTodoList(text) {
  if (!text) return null;
  const m = /^(?:TODO List:|Todo List:|Updated Todo List:)([\s\S]*)/i.exec(text);
  if (!m) return null;
  const body = m[1] || '';
  const items = body
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (s.startsWith('- ') ? s.slice(2) : s));
  if (!items.length) return null;
  const lines = ['✅ TODO List:'];
  for (const it of items) {
    lines.push(`• ${it}`);
  }
  return lines.join('\n');
}

export function normalizeAssistantEvent(data) {
  // data is lastMsg.data for type === 'claude-response'
  // Return a pretty text (markdown) or empty string
  try {
    const content = data?.message?.content ?? data?.message?.text ?? data?.text;
    const rawText = asTextFromContent(content);
    const todo = tryExtractTodoList(rawText);
    const toolLines = extractToolLinesFromContent(Array.isArray(content) ? content : []);
    const pieces = [];
    if (todo) pieces.push(todo);
    if (toolLines.length) pieces.push(toolLines.join('\n'));
    if (rawText && (!todo || rawText.trim() !== todo.trim())) pieces.push(rawText);
    return pieces.filter(Boolean).join('\n\n');
  } catch {
    return '';
  }
}

export function normalizeResultEvent(data) {
  try {
    if (typeof data?.result === 'string' && data.result.trim()) return data.result.trim();
  } catch {}
  return '';
}

