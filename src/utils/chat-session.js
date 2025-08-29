// Persist Codex session metadata per project for resume capability

const STORAGE_KEY = 'overlayChatSessions';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch { return {}; }
}

function saveAll(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {}
}

export function saveLastSession(projectPath, { sessionId, rolloutPath }) {
  if (!projectPath || (!sessionId && !rolloutPath)) return;
  const all = loadAll();
  all[String(projectPath)] = {
    sessionId: sessionId || null,
    rolloutPath: rolloutPath || null,
    updatedAt: Date.now()
  };
  // cap total entries to 8 most recent
  const entries = Object.entries(all).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  saveAll(Object.fromEntries(entries.slice(0, 8)));
}

export function loadLastSession(projectPath) {
  if (!projectPath) return null;
  const all = loadAll();
  return all[String(projectPath)] || null;
}

export function hasLastSession(projectPath) {
  const s = loadLastSession(projectPath);
  return !!(s && (s.sessionId || s.rolloutPath));
}

export function clearLastSession(projectPath) {
  if (!projectPath) return;
  const all = loadAll();
  delete all[String(projectPath)];
  saveAll(all);
}

