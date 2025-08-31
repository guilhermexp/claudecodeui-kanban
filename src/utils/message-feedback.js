/**
 * Message Feedback Management System
 * Handles temporary messages, auto-dismissal, and visual indicators
 */

// Message types that should auto-dismiss
const AUTO_DISMISS_TYPES = {
  'session_start': 3000,
  'session_resume': 2000,
  'tool_use': 1500,
  'status': 2500,
  'queue': 2000,
  'limits': 4000,
  'default': 3000
};

// Message patterns and their categories
const MESSAGE_PATTERNS = {
  'Resuming previous session': 'session_resume',
  'Session started': 'session_start',
  'Session closed': 'session_close',
  'Using ': 'tool_use',
  'Queued': 'queue',
  'Limits:': 'limits',
  'Session start timeout': 'error',
  'Previous session expired': 'session_expire'
};

/**
 * Determine if a message should auto-dismiss
 */
export function shouldAutoDismiss(message) {
  if (message.type !== 'system') return false;
  if (message.persistent) return false;
  
  const text = message.text || '';
  for (const [pattern, category] of Object.entries(MESSAGE_PATTERNS)) {
    if (text.includes(pattern)) {
      return { 
        shouldDismiss: true, 
        timeout: AUTO_DISMISS_TYPES[category] || AUTO_DISMISS_TYPES.default,
        category 
      };
    }
  }
  
  return { shouldDismiss: false };
}

/**
 * Create a temporary message that auto-dismisses
 */
export function createTemporaryMessage(text, type = 'system', timeout = null) {
  const id = `temp-${Date.now()}-${Math.random()}`;
  const category = Object.entries(MESSAGE_PATTERNS).find(([pattern]) => 
    text.includes(pattern)
  )?.[1] || 'default';
  
  return {
    id,
    text,
    type,
    timestamp: Date.now(),
    temporary: true,
    timeout: timeout || AUTO_DISMISS_TYPES[category] || AUTO_DISMISS_TYPES.default,
    category
  };
}

/**
 * Process and enhance messages with metadata
 */
export function processMessage(message) {
  const enhanced = { ...message };
  
  // Add timestamp if missing
  if (!enhanced.timestamp) {
    enhanced.timestamp = Date.now();
  }
  
  // Add unique ID if missing
  if (!enhanced.id) {
    enhanced.id = `msg-${Date.now()}-${Math.random()}`;
  }
  
  // Check if should auto-dismiss
  const dismissInfo = shouldAutoDismiss(message);
  if (dismissInfo.shouldDismiss) {
    enhanced.temporary = true;
    enhanced.dismissTimeout = dismissInfo.timeout;
    enhanced.category = dismissInfo.category;
  }
  
  return enhanced;
}

/**
 * Filter out expired temporary messages
 */
export function filterExpiredMessages(messages, currentTime = Date.now()) {
  return messages.filter(msg => {
    if (!msg.temporary || !msg.dismissTimeout) return true;
    const age = currentTime - msg.timestamp;
    return age < msg.dismissTimeout;
  });
}

/**
 * Create a loading indicator message
 */
export function createLoadingMessage(operation) {
  return {
    id: `loading-${Date.now()}`,
    type: 'loading',
    text: operation,
    timestamp: Date.now(),
    temporary: true,
    isLoading: true
  };
}

/**
 * Replace loading message with result
 */
export function replaceLoadingMessage(messages, loadingId, resultMessage) {
  return messages.map(msg => 
    msg.id === loadingId ? { ...resultMessage, id: loadingId } : msg
  );
}

/**
 * Group consecutive system messages for cleaner display
 */
export function groupSystemMessages(messages) {
  const grouped = [];
  let currentGroup = null;
  
  for (const msg of messages) {
    if (msg.type === 'system' && !msg.important) {
      if (!currentGroup) {
        currentGroup = {
          id: `group-${Date.now()}`,
          type: 'system-group',
          messages: [msg],
          timestamp: msg.timestamp
        };
      } else {
        currentGroup.messages.push(msg);
      }
    } else {
      if (currentGroup) {
        grouped.push(currentGroup);
        currentGroup = null;
      }
      grouped.push(msg);
    }
  }
  
  if (currentGroup) {
    grouped.push(currentGroup);
  }
  
  return grouped;
}

/**
 * Get visual indicator for message category
 */
export function getMessageIndicator(category) {
  const indicators = {
    'session_start': '🟢',
    'session_resume': '🔄',
    'session_close': '🔴',
    'tool_use': '🔧',
    'queue': '⏳',
    'limits': '⚠️',
    'error': '❌',
    'loading': '⏳',
    'success': '✅'
  };
  
  return indicators[category] || '';
}

/**
 * Create a status bar message for ongoing operations
 */
export function createStatusMessage(operation, progress = null) {
  return {
    id: `status-${Date.now()}`,
    type: 'status',
    operation,
    progress,
    timestamp: Date.now(),
    sticky: true // Stays at bottom until replaced
  };
}

/**
 * Smart message deduplication
 */
export function deduplicateMessages(messages, timeWindow = 1000) {
  const seen = new Map();
  
  return messages.filter(msg => {
    const key = `${msg.type}-${msg.text}`;
    const lastSeen = seen.get(key);
    
    if (lastSeen && msg.timestamp - lastSeen < timeWindow) {
      return false; // Duplicate within time window
    }
    
    seen.set(key, msg.timestamp);
    return true;
  });
}