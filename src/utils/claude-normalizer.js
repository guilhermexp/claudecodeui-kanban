// Utility to normalize Claude Code CLI streaming JSON responses into chat messages
// Based on the existing codex-normalizer pattern

/**
 * Normalize Claude Code CLI events into chat messages
 * Claude uses a different JSON format than Codex
 */
export function normalizeClaudeEvent(evt) {
  try {
    // Handle Claude-specific response types
    if (evt.type === 'claude-response' && evt.data) {
      const data = evt.data;
      
      // Session started event
      if (data.type === 'session_started' || data.session_id) {
        return [];
      }
      
      // Text content
      if (data.type === 'text' || data.content) {
        const text = data.text || data.content || '';
        if (text.trim()) {
          return [{ type: 'assistant', text }];
        }
      }
      
      // Tool use
      if (data.type === 'tool_use' && data.name) {
        const toolName = data.name;
        // Skip internal thinking/reasoning tools
        if (['thinking', 'reasoning', 'str_replace_based_edit_tool'].includes(toolName.toLowerCase())) {
          return [];
        }
        
        // Get appropriate icon for tool
        const icon = getToolIcon(toolName);
        
        // For commands, try to extract the actual command
        if (toolName.toLowerCase().includes('bash') || toolName.toLowerCase().includes('shell')) {
          const input = data.input || {};
          const command = input.command || input.cmd || '';
          if (command) {
            return [{ type: 'system', text: `${icon} ${toolName}\n\n\`${command}\`` }];
          }
        }
        
        return [{ type: 'system', text: `${icon} ${toolName}` }];
      }
      
      // Tool result
      if (data.type === 'tool_result') {
        const output = data.output || data.content || '';
        if (output && output.trim() && output.length < 5000) {
          // Format as code block for command outputs
          if (output.includes('\n') || output.length > 100) {
            return [{ type: 'system', text: `\`\`\`\n${output}\n\`\`\`` }];
          }
          return [{ type: 'system', text: output }];
        }
      }
      
      // Thinking/reasoning blocks (Claude-specific)
      if (data.type === 'thinking' || data.type === 'reasoning') {
        const content = data.content || data.text || '';
        if (content && content.trim()) {
          return [{ type: 'system', text: `Thinking…\n\n${content}` }];
        }
      }
      
      // Error messages
      if (data.type === 'error' || data.error) {
        const errorMsg = data.error || data.message || 'Unknown error';
        return [{ type: 'error', text: errorMsg }];
      }
      
      // Stream delta (incremental text)
      if (data.type === 'content_block_delta' && data.delta) {
        const deltaText = data.delta.text || '';
        if (deltaText) {
          return [{ type: 'assistant', text: deltaText, isStream: true }];
        }
      }
    }
    
    // Handle direct Claude events
    if (evt.type === 'claude-output' && evt.data) {
      const line = String(evt.data).trim();
      if (!line) return [];
      
      // Try to parse as JSON
      try {
        const obj = JSON.parse(line);
        
        // Recursively process parsed object
        return normalizeClaudeEvent({ type: 'claude-response', data: obj });
      } catch {
        // If not JSON and meaningful, show as system message
        if (line.length < 200 && !line.includes('DEBUG') && !line.includes('TRACE')) {
          return [{ type: 'system', text: line }];
        }
      }
    }
    
    // Handle errors
    if (evt.type === 'claude-error' && evt.error) {
      return [{ type: 'error', text: String(evt.error) }];
    }
    
    // Session management
    if (evt.type === 'session-created') {
      return [{ type: 'system', text: `Claude session started (${evt.sessionId?.slice(0, 8)}…)` }];
    }
    
    if (evt.type === 'claude-complete') {
      // Session complete, no message needed
      return [];
    }
    
  } catch (error) {
    console.error('Error normalizing Claude event:', error);
    return [];
  }
  
  return [];
}

/**
 * Get appropriate icon for tool name
 */
function getToolIcon(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('bash') || n.includes('shell') || n.includes('command')) return '💻';
  if (n.includes('edit') || n.includes('write') || n.includes('patch')) return '✏️';
  if (n.includes('read') || n.includes('view')) return '📖';
  if (n.includes('search') || n.includes('find') || n.includes('grep')) return '🔍';
  if (n.includes('git')) return '🌿';
  if (n.includes('test') || n.includes('check')) return '✅';
  if (n.includes('install') || n.includes('npm') || n.includes('pip')) return '📦';
  if (n.includes('delete') || n.includes('remove')) return '🗑️';
  if (n.includes('create') || n.includes('make')) return '➕';
  return '🔧';
}