// Lightweight Preview API utilities

export async function refreshPreviewStatus(projectName) {
  if (!projectName) return { running: false, url: null };
  const token = localStorage.getItem('auth-token');
  const r = await fetch(`/api/projects/${encodeURIComponent(projectName)}/preview/status`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!r.ok) return { running: false, url: null };
  const d = await r.json();
  return { running: !!d.running, url: d.url || null };
}

export async function startPreview(projectName) {
  if (!projectName) return { url: null };
  const token = localStorage.getItem('auth-token');
  const r = await fetch(`/api/projects/${encodeURIComponent(projectName)}/preview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: JSON.stringify({})
  });
  if (!r.ok) return { url: null };
  const d = await r.json();
  return { url: d.url || null };
}

export async function stopPreview(projectName) {
  if (!projectName) return false;
  const token = localStorage.getItem('auth-token');
  try {
    await fetch(`/api/projects/${encodeURIComponent(projectName)}/preview/stop`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchProjectFiles(projectName) {
  if (!projectName) return [];
  const token = localStorage.getItem('auth-token');
  const r = await fetch(`/api/projects/${encodeURIComponent(projectName)}/files`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

