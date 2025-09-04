// Lightweight local history for TimerChip sessions
// Stored in localStorage so it works offline and per-browser

const KEY = 'vibe_timer_history_v1';

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

export function saveHistory(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function addSession({ project, label, start, end, durationMs }) {
  if (!start || !end) return;
  const d = Math.max(0, durationMs ?? (new Date(end) - new Date(start)));
  if (d < 15 * 1000) return; // ignore very short sessions
  const entry = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    project: project || 'Unknown',
    label: label || '',
    start,
    end,
    durationMs: d,
  };
  const list = loadHistory();
  list.push(entry);
  saveHistory(list);
  return entry;
}

export function clearHistory() { saveHistory([]); }

export function groupByProject(list) {
  const map = new Map();
  for (const it of list) {
    const k = it.project || 'Unknown';
    const arr = map.get(k) || [];
    arr.push(it);
    map.set(k, arr);
  }
  return Array.from(map.entries()).map(([project, sessions]) => ({ project, sessions }));
}

export function sumDuration(list) { return list.reduce((a,b)=>a+(b?.durationMs||0),0); }

export function humanize(ms) {
  const totalSec = Math.round(ms/1000);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  if (h>0) return `${h}h ${String(m).padStart(2,'0')}m`;
  if (m>0) return `${m}m ${String(s).padStart(2,'0')}s`;
  return `${s}s`;
}

export function filterByDay(list, date) {
  const d0 = new Date(date); d0.setHours(0,0,0,0);
  const d1 = new Date(d0); d1.setDate(d1.getDate()+1);
  return list.filter((e)=>new Date(e.start)>=d0 && new Date(e.start)<d1);
}

export function filterByWeek(list, date) {
  const d = new Date(date);
  const day = (d.getDay()+6)%7; // Monday=0
  const start = new Date(d); start.setDate(start.getDate()-day); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+7);
  return list.filter((e)=>new Date(e.start)>=start && new Date(e.start)<end);
}

