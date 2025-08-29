const MODE_KEY = 'codex-planner-mode';
const MODEL_KEY = 'codex-model-label';
const PROVIDER_KEY = 'chat-cli-provider';

export function loadPlannerMode() {
  try {
    return localStorage.getItem(MODE_KEY) || 'Planer';
  } catch { return 'Planer'; }
}

export function savePlannerMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
}

export function loadModelLabel() {
  try {
    return localStorage.getItem(MODEL_KEY) || 'gpt-5';
  } catch { return 'gpt-5'; }
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

