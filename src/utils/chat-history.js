const KEY_PREFIX = 'chat_history_'

export function hasChatHistory(projectPath) {
  if (!projectPath) return false
  const key = KEY_PREFIX + projectPath
  return !!localStorage.getItem(key)
}

export function loadChatHistory(projectPath) {
  if (!projectPath) return null
  const key = KEY_PREFIX + projectPath
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function saveChatHistory(projectPath, history) {
  if (!projectPath) return false
  const key = KEY_PREFIX + projectPath
  try {
    localStorage.setItem(key, JSON.stringify(history || {}))
    return true
  } catch { return false }
}