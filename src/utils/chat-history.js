// Lightweight chat history persistence for OverlayChat
// Stores per-project last conversation with caps to avoid bloating localStorage

const STORAGE_KEY = 'overlayChatHistory';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

// Keep only necessary fields and cap entries/size
function normalizeMessages(messages) {
  const simplified = (messages || []).map(m => ({
    type: m.type,
    text: m.text,
    timestamp: m.timestamp || null
  }));
  // Cap to last 60 messages by default
  let trimmed = simplified.slice(-60);
  // Additional size guard ~200KB budget for safety
  try {
    let json = JSON.stringify(trimmed);
    const BUDGET = 200 * 1024;
    while (json.length > BUDGET && trimmed.length > 10) {
      trimmed = trimmed.slice(Math.floor(trimmed.length / 3));
      json = JSON.stringify(trimmed);
    }
  } catch {}
  return trimmed;
}

export function saveChatHistory(projectPath, messages) {
  if (!projectPath) return;
  const all = loadAll();
  const key = String(projectPath);
  all[key] = {
    updatedAt: Date.now(),
    messages: normalizeMessages(messages)
  };
  // Optional: cap total projects stored to last 8
  const entries = Object.entries(all).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  const capped = Object.fromEntries(entries.slice(0, 8));
  saveAll(capped);
}

export function loadChatHistory(projectPath) {
  if (!projectPath) return null;
  const all = loadAll();
  const entry = all[String(projectPath)];
  if (!entry || !Array.isArray(entry.messages) || entry.messages.length === 0) return null;
  return entry;
}

export function clearChatHistory(projectPath) {
  if (!projectPath) return;
  const all = loadAll();
  const key = String(projectPath);
  if (key in all) {
    delete all[key];
    saveAll(all);
  }
}

export function hasChatHistory(projectPath) {
  const entry = loadChatHistory(projectPath);
  return !!(entry && entry.messages && entry.messages.length);
}

