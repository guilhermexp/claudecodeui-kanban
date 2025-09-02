// Lightweight local persistence for the Prompts Hub
// Data model supports prompts, code snippets, and env vars.

const STORAGE_KEY = 'prompts-hub-state-v1';

const seedData = {
  version: 1,
  updatedAt: Date.now(),
  prompts: [
    {
      id: 'p1',
      title: 'Personalized Fitness Plan',
      description: 'Generate a personalized fitness plan based on inputs',
      tags: ['fitness', 'example'],
      variables: [
        { name: 'fitness_goal', example: 'hypertrophy' },
        { name: 'fitness_level', example: 'intermediate' },
        { name: 'available_equipment', example: 'dumbbells, bench' },
        { name: 'time_available', example: '45 minutes/day' }
      ],
      template:
        'Generate a personalized fitness plan based on the following information:\n' +
        'Goal: {fitness_goal}\n' +
        'Fitness Level: {fitness_level}\n' +
        'Available Equipment: {available_equipment}\n' +
        'Time Available: {time_available}',
    },
  ],
  snippets: [
    {
      id: 's1',
      title: 'React useLocalStorage Hook',
      language: 'js',
      description: 'Persist state in localStorage with a hook',
      code:
`import { useState, useEffect } from 'react';
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}`,
    }
  ],
  env: [
    { key: 'API_BASE_URL', value: 'http://localhost:7347', masked: false },
    { key: 'OPENAI_API_KEY', value: 'sk-***', masked: true }
  ],
};

export function loadPromptsHubState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...seedData };
    const parsed = JSON.parse(raw);
    // Ensure required arrays exist
    return {
      version: 1,
      updatedAt: parsed.updatedAt || Date.now(),
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
      env: Array.isArray(parsed.env) ? parsed.env : [],
    };
  } catch {
    return { ...seedData };
  }
}

export function savePromptsHubState(state) {
  try {
    const data = { ...state, version: 1, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function upsertItem(list, item, idKey = 'id') {
  const idx = list.findIndex((x) => x[idKey] === item[idKey]);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = item;
    return next;
  }
  return [...list, item];
}

export function deleteItem(list, id, idKey = 'id') {
  return list.filter((x) => x[idKey] !== id);
}

export function detectTemplateVariables(template) {
  if (!template) return [];
  const set = new Set();
  const re = /\{([a-zA-Z0-9_\.]+)\}/g;
  let m;
  while ((m = re.exec(template))) set.add(m[1]);
  return Array.from(set);
}

