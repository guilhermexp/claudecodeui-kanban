import { authPersistence } from './auth-persistence';

// Store for refresh token promise to prevent multiple simultaneous refreshes
let refreshPromise = null;

// Function to refresh token
const refreshToken = async () => {
  const token = await authPersistence.getToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      await authPersistence.saveToken(data.token);
      return data.token;
    }
  } catch (error) {
    // Token refresh failed
  }

  return null;
};

// Utility function for authenticated API calls with automatic token refresh
export const authenticatedFetch = async (url, options = {}) => {
  const makeRequest = (token) => {
    const defaultHeaders = {};
    
    // Only set Content-Type if not dealing with FormData
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }
    
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    // Ensure URL is properly formatted
    const fullUrl = url.startsWith('http') ? url : url;
    
    return fetch(fullUrl, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  };
  
  let token = await authPersistence.getToken();
  let response = await makeRequest(token);
  
  // If we get a 401 with TOKEN_EXPIRED, try to refresh
  if (response.status === 401 && token) {
    try {
      // Clone the response to read it without consuming the original
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data.code === 'TOKEN_EXPIRED') {
        // Only one refresh at a time
        if (!refreshPromise) {
          refreshPromise = refreshToken();
        }
        
        const newToken = await refreshPromise;
        refreshPromise = null;
        
        if (newToken) {
          // Retry the request with new token
          response = await makeRequest(newToken);
        }
      }
    } catch (error) {
      // If parsing fails, just return the original response
    }
  }
  
  return response;
};

// API endpoints
export const api = {
  // Export authenticatedFetch for direct use
  authenticatedFetch,
  // Auth endpoints (no token required)
  auth: {
    status: () => fetch('/api/auth/status'),
    login: (username, password) => fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    register: (username, password) => fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    reset: (username, newPassword, resetCode) => fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPassword, resetCode }),
    }),
    refresh: () => refreshToken(),
    user: () => authenticatedFetch('/api/auth/user'),
    logout: () => authenticatedFetch('/api/auth/logout', { method: 'POST' }),
  },
  
  // Protected endpoints
  config: () => authenticatedFetch('/api/config'),
  projects: () => authenticatedFetch('/api/projects'),
  sessions: (projectName, limit = 5, offset = 0) => 
    authenticatedFetch(`/api/projects/${projectName}/sessions?limit=${limit}&offset=${offset}`),
  sessionMessages: (projectName, sessionId) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}/messages`),
  renameProject: (projectName, displayName) =>
    authenticatedFetch(`/api/projects/${projectName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  deleteSession: (projectName, sessionId) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  deleteProject: (projectName) =>
    authenticatedFetch(`/api/projects/${projectName}`, {
      method: 'DELETE',
    }),
  deleteProjectCompletely: (projectName) =>
    authenticatedFetch(`/api/projects/${projectName}/force`, {
      method: 'DELETE',
    }),
  codex: {
    lastSession: (projectPath = null) => authenticatedFetch(`/api/codex/last-session${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ''}`),
    rolloutRead: (rolloutPath) => authenticatedFetch(`/api/codex/rollout-read?path=${encodeURIComponent(rolloutPath)}`)
  },
  images: {
    uploadData: (dataUrl, fileName) => authenticatedFetch('/api/images/upload-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, fileName })
    })
  },
  createProject: (path) =>
    authenticatedFetch('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  readFile: (filePath, projectPath) =>
    authenticatedFetch(`/api/files/read?path=${encodeURIComponent(filePath)}${projectPath ? `&projectPath=${encodeURIComponent(projectPath)}` : ''}`),
  saveFile: (projectName, filePath, content) =>
    authenticatedFetch(`/api/projects/${projectName}/file`, {
      method: 'PUT',
      body: JSON.stringify({ filePath, content }),
    }),
  getFiles: (projectName) =>
    authenticatedFetch(`/api/files/tree/${encodeURIComponent(projectName)}`),
  transcribe: (formData) =>
    authenticatedFetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      // Don't override headers completely - authenticatedFetch will handle Authorization
      // and browser will set Content-Type for FormData automatically
    }),
  // Repo indexer
  indexer: {
    list: () => authenticatedFetch('/api/indexer'),
    create: (absPath, name) => authenticatedFetch('/api/indexer/create', { method: 'POST', body: JSON.stringify({ path: absPath, name }) }),
    get: (id) => authenticatedFetch(`/api/indexer/${id}`),
    bundle: (id) => authenticatedFetch(`/api/indexer/${id}/bundle`),
    remove: (id) => authenticatedFetch(`/api/indexer/${id}`, { method: 'DELETE' }),
    search: (id, query) => authenticatedFetch('/api/indexer/search', { method: 'POST', body: JSON.stringify({ id, query }) }),
    github: (url, name, branch) => authenticatedFetch('/api/indexer/github', { method: 'POST', body: JSON.stringify({ url, name, branch }) }),
  },
  system: {
    pickFolder: () => authenticatedFetch('/api/system/pick-folder', { method: 'POST' }),
  },
};
