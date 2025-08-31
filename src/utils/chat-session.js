// Persist session metadata per project for resume capability

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

function keyFor(projectPath, provider) {
  const p = String(projectPath);
  return provider ? `${p}::${provider}` : p;
}

export function saveLastSession(projectPath, { sessionId, rolloutPath }, provider = null) {
  if (!projectPath || (!sessionId && !rolloutPath)) return;
  const all = loadAll();
  all[keyFor(projectPath, provider)] = {
    sessionId: sessionId || null,
    rolloutPath: rolloutPath || null,
    updatedAt: Date.now()
  };
  // cap total entries to 8 most recent
  const entries = Object.entries(all).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  saveAll(Object.fromEntries(entries.slice(0, 8)));
}

export function loadLastSession(projectPath, provider = null) {
  if (!projectPath) return null;
  const all = loadAll();
  if (provider) {
    return all[keyFor(projectPath, provider)] || all[String(projectPath)] || null; // fallback to legacy
  }
  return all[String(projectPath)] || null;
}

export function hasLastSession(projectPath, provider = null) {
  const s = loadLastSession(projectPath, provider);
  return !!(s && (s.sessionId || s.rolloutPath));
}

export function clearLastSession(projectPath, provider = null) {
  if (!projectPath) return;
  const all = loadAll();
  if (provider) {
    delete all[keyFor(projectPath, provider)];
  } else {
    delete all[String(projectPath)];
  }
  saveAll(all);
}
