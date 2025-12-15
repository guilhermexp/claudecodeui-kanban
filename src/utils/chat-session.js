const KEY_PREFIX = 'last_session_'

export function hasLastSession(projectPath) {
  if (!projectPath) return false
  const key = KEY_PREFIX + projectPath
  return !!localStorage.getItem(key)
}

export function loadLastSession(projectPath) {
  if (!projectPath) return null
  const key = KEY_PREFIX + projectPath
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function saveLastSession(projectPath, sessionId) {
  if (!projectPath) return false
  const key = KEY_PREFIX + projectPath
  try {
    localStorage.setItem(key, JSON.stringify({ sessionId }))
    return true
  } catch { return false }
}

export function clearLastSession(projectPath) {
  if (!projectPath) return
  const key = KEY_PREFIX + projectPath
  try { localStorage.removeItem(key) } catch {}
}