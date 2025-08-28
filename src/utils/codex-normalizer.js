// Utility to normalize Codex CLI JSONL/events into clean chat messages
// Inspired by Vibe Kanban's codex executor normalization logic

const CONFIG_HINT_KEYS = [
  'sandbox',
  'reasoning summaries',
  'approval',
  'provider',
  'reasoning effort',
  'workdir',
  'model'
];

function isSystemConfigMessage(obj) {
  if (!obj || typeof obj !== 'object' || obj.msg || obj.prompt) return false;
  let present = 0;
  for (const key of CONFIG_HINT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) present++;
  }
  if (present >= 2) return true;
  // Minimal config: model + provider
  if (obj.model && obj.provider) return true;
  return false;
}

function formatSessionParams(obj) {
  const parts = [];
  if (obj.model) parts.push(`model: ${obj.model}`);
  if (obj['reasoning effort']) parts.push(`reasoning effort: ${obj['reasoning effort']}`);
  if (obj.provider) parts.push(`provider: ${obj.provider}`);
  return parts.length ? `Session Parameters:\n${parts.join('\n')}` : null;
}

function joinCommand(cmdArr) {
  try {
    return cmdArr.map((c) => (/[\s"']/g.test(c) ? JSON.stringify(c) : c)).join(' ');
  } catch {
    return Array.isArray(cmdArr) ? cmdArr.join(' ') : String(cmdArr || '');
  }
}

function toolNameForCommand(first) {
  if (!first) return 'tool';
  if (first === 'bash') return 'bash';
  if (first === 'sh') return 'shell';
  return first;
}

function handleMsg(json) {
  const msg = json.msg || {};
  const t = msg.type;
  switch (t) {
    case 'task_started':
    case 'task_complete':
    case 'token_count':
    case 'exec_command_end':
    case 'patch_apply_end':
      return [];
    case 'agent_message': {
      const content = msg.message || '';
      return content ? [{ type: 'assistant', text: content }] : [];
    }
    case 'error': {
      const content = msg.message || 'Unknown error occurred';
      return [{ type: 'error', text: content }];
    }
    case 'agent_reasoning':
    case 'agent_thinking':
    case 'reasoning': {
      const content = msg.content || msg.message || '';
      if (!content) return [];
      // Keep concise thinking block
      return [{ type: 'system', text: `Thinking…\n\n${content}` }];
    }
    case 'exec_command_begin': {
      const cmd = Array.isArray(msg.command) ? msg.command : [];
      const full = joinCommand(cmd);
      const tool = toolNameForCommand(cmd[0]);
      return [{ type: 'system', text: `🔧 ${tool}\n\n\`${full}\`` }];
    }
    case 'patch_apply_begin': {
      const changes = msg.changes || {};
      const files = Object.keys(changes).map((p) => p.split('/').pop());
      if (files.length === 0) return [{ type: 'system', text: '🔧 edit: applying changes' }];
      const summary = files.length <= 5 ? files.join(', ') : `${files.slice(0, 5).join(', ')} (+${files.length - 5} more)`;
      return [{ type: 'system', text: `🔧 edit: updated files\n\n- ${summary}` }];
    }
    default: {
      // Generic fallback: if message string present
      if (typeof msg.message === 'string' && msg.message.trim()) {
        return [{ type: 'assistant', text: msg.message }];
      }
      return [];
    }
  }
}

function handleParsedObject(obj) {
  // Skip prompt echo
  if (obj && Object.prototype.hasOwnProperty.call(obj, 'prompt')) return [];

  // Show system config nicely
  if (isSystemConfigMessage(obj)) {
    const text = formatSessionParams(obj);
    return text ? [{ type: 'system', text }] : [];
  }

  if (obj && obj.msg) {
    return handleMsg(obj);
  }

  // tool_use style
  if (obj && obj.type === 'tool_use' && obj.name) {
    const tool = obj.name.toLowerCase();
    if (['reasoning', 'thinking'].includes(tool)) return [];
    return [{ type: 'system', text: `🔧 ${obj.name}` }];
  }

  // text block
  if (obj && obj.type === 'text' && obj.text) {
    return [{ type: 'assistant', text: obj.text }];
  }

  if (obj && obj.content) {
    return [{ type: 'assistant', text: obj.content }];
  }

  return [];
}

export function normalizeCodexEvent(evt) {
  try {
    // Direct response
    if (evt.type === 'codex-response' && evt.text) {
      return [{ type: 'assistant', text: evt.text }];
    }
    if (evt.type === 'codex-error' && evt.error) {
      return [{ type: 'error', text: String(evt.error) }];
    }
    if (evt.type === 'codex-tool' && evt.data) {
      return handleParsedObject(evt.data);
    }
    if (evt.type === 'codex-output' && evt.data) {
      const line = String(evt.data).trim();
      if (!line) return [];
      // Heuristic: drop pure config-ish noise lines if not JSON
      if (/reasoning|sandbox|approval|provider|model|workdir/i.test(line)) return [];
      try {
        const obj = JSON.parse(line);
        return handleParsedObject(obj);
      } catch {
        // Non-JSON: surface only if short and user-friendly
        if (line.length < 200 && !/debug|trace|warn/i.test(line)) {
          return [{ type: 'system', text: line }];
        }
        return [];
      }
    }
  } catch {
    return [];
  }
  return [];
}

