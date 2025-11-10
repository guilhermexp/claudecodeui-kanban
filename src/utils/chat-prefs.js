const MODE_KEY = 'codex-planner-mode';
const MODEL_KEY = 'codex-model-label';
const PROVIDER_KEY = 'chat-cli-provider';

export function loadPlannerMode() {
  try {
    // Default to 'Off' to avoid planner/auto prefix
    return localStorage.getItem(MODE_KEY) || 'Off';
  } catch { return 'Off'; }
}

export function savePlannerMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
}

export function loadModelLabel() {
  try {
    let v = localStorage.getItem(MODEL_KEY);
    if (!v) return 'gpt-high';
    const norm = String(v).trim().toLowerCase();
    // Normalize common variants to the canonical label
    if (norm === 'gpt-high' || norm === 'gpt high' || norm === 'gpt hag') return 'gpt-high';
    return v;
  } catch { return 'Full Access'; }
}

export function saveModelLabel(label) {
  try { localStorage.setItem(MODEL_KEY, label); } catch {}
}

export function loadCliProvider() {
  try {
    return localStorage.getItem(PROVIDER_KEY) || 'codex';
  } catch { return 'codex'; }
}

export function saveCliProvider(provider) {
  try { localStorage.setItem(PROVIDER_KEY, provider); } catch {}
}
