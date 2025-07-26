// Adapted VibeKanban API for ClaudeCodeUI integration
// Uses /api/vibe-kanban prefix which gets proxied to localhost:8080 by Vite

export const makeRequest = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Prefix all API calls with /api/vibe-kanban for proper proxying
  const prefixedUrl = url.startsWith('/api/') ? url.replace('/api/', '/api/vibe-kanban/') : url;

  return fetch(prefixedUrl, {
    ...options,
    headers,
  });
};

export class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

const handleApiResponse = async (response) => {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    console.error('[VibeKanban API Error]', {
      message: errorMessage,
      status: response.status,
      response,
      endpoint: response.url,
      timestamp: new Date().toISOString(),
    });
    throw new ApiError(errorMessage, response.status, response);
  }

  const result = await response.json();

  if (!result.success) {
    console.error('[VibeKanban API Error]', {
      message: result.message || 'API request failed',
      status: response.status,
      response,
      endpoint: response.url,
      timestamp: new Date().toISOString(),
    });
    throw new ApiError(result.message || 'API request failed');
  }

  return result.data;
};

// Project Management APIs
export const projectsApi = {
  getAll: async () => {
    const response = await makeRequest('/api/projects');
    return handleApiResponse(response);
  },

  getById: async (id) => {
    const response = await makeRequest(`/api/projects/${id}`);
    return handleApiResponse(response);
  },

  getWithBranch: async (id) => {
    const response = await makeRequest(`/api/projects/${id}/with-branch`);
    return handleApiResponse(response);
  },

  create: async (data) => {
    const response = await makeRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  update: async (id, data) => {
    const response = await makeRequest(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  delete: async (id) => {
    const response = await makeRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    });
    return handleApiResponse(response);
  },

  openEditor: async (id) => {
    const response = await makeRequest(`/api/projects/${id}/open-editor`, {
      method: 'POST',
      body: JSON.stringify(null),
    });
    return handleApiResponse(response);
  },

  getBranches: async (id) => {
    const response = await makeRequest(`/api/projects/${id}/branches`);
    return handleApiResponse(response);
  },

  searchFiles: async (id, query) => {
    const response = await makeRequest(
      `/api/projects/${id}/search?q=${encodeURIComponent(query)}`
    );
    return handleApiResponse(response);
  },
};

// Task Management APIs
export const tasksApi = {
  getAll: async (projectId) => {
    const response = await makeRequest(`/api/projects/${projectId}/tasks`);
    return handleApiResponse(response);
  },

  getById: async (projectId, taskId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}`
    );
    return handleApiResponse(response);
  },

  create: async (projectId, data) => {
    const response = await makeRequest(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  createAndStart: async (projectId, data) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/create-and-start`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse(response);
  },

  update: async (projectId, taskId, data) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse(response);
  },

  delete: async (projectId, taskId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}`,
      {
        method: 'DELETE',
      }
    );
    return handleApiResponse(response);
  },

  getChildren: async (projectId, taskId, attemptId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}/children`
    );
    return handleApiResponse(response);
  },
};

// Task Attempts APIs  
export const attemptsApi = {
  getAll: async (projectId, taskId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts`
    );
    return handleApiResponse(response);
  },

  create: async (projectId, taskId, data) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse(response);
  },

  getState: async (projectId, taskId, attemptId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}`
    );
    return handleApiResponse(response);
  },

  stop: async (projectId, taskId, attemptId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}/stop`,
      {
        method: 'POST',
      }
    );
    return handleApiResponse(response);
  },

  followUp: async (projectId, taskId, attemptId, data) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}/follow-up`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return handleApiResponse(response);
  },

  getDiff: async (projectId, taskId, attemptId) => {
    const response = await makeRequest(
      `/api/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}/diff`
    );
    return handleApiResponse(response);
  },

  // Add other attempts methods as needed...
};

// Config APIs
export const configApi = {
  getConfig: async () => {
    const response = await makeRequest('/api/config');
    return handleApiResponse(response);
  },
  
  saveConfig: async (config) => {
    const response = await makeRequest('/api/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return handleApiResponse(response);
  },
  
  getConstants: async () => {
    const response = await makeRequest('/api/config/constants');
    return handleApiResponse(response);
  },
};

// File System APIs
export const fileSystemApi = {
  list: async (path) => {
    const queryParam = path ? `?path=${encodeURIComponent(path)}` : '';
    const response = await makeRequest(`/api/filesystem/list${queryParam}`);
    return handleApiResponse(response);
  },
};

// GitHub Device Auth APIs
export const githubAuthApi = {
  checkGithubToken: async () => {
    try {
      const response = await makeRequest('/api/auth/github/check');
      const result = await response.json();
      if (!result.success && result.message === 'github_token_invalid') {
        return false;
      }
      return result.success;
    } catch (err) {
      return undefined;
    }
  },
  
  start: async () => {
    const response = await makeRequest('/api/auth/github/device/start', {
      method: 'POST',
    });
    return handleApiResponse(response);
  },
  
  poll: async (device_code) => {
    const response = await makeRequest('/api/auth/github/device/poll', {
      method: 'POST',
      body: JSON.stringify({ device_code }),
      headers: { 'Content-Type': 'application/json' },
    });
    return handleApiResponse(response);
  },
};

// Task Templates APIs
export const templatesApi = {
  list: async () => {
    const response = await makeRequest('/api/templates');
    return handleApiResponse(response);
  },

  listGlobal: async () => {
    const response = await makeRequest('/api/templates/global');
    return handleApiResponse(response);
  },

  listByProject: async (projectId) => {
    const response = await makeRequest(`/api/projects/${projectId}/templates`);
    return handleApiResponse(response);
  },

  get: async (templateId) => {
    const response = await makeRequest(`/api/templates/${templateId}`);
    return handleApiResponse(response);
  },

  create: async (data) => {
    const response = await makeRequest('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  update: async (templateId, data) => {
    const response = await makeRequest(`/api/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  delete: async (templateId) => {
    const response = await makeRequest(`/api/templates/${templateId}`, {
      method: 'DELETE',
    });
    return handleApiResponse(response);
  },
};

// MCP Servers APIs
export const mcpServersApi = {
  load: async (executor) => {
    const response = await makeRequest(
      `/api/mcp-servers?executor=${encodeURIComponent(executor)}`
    );
    return handleApiResponse(response);
  },
  
  save: async (executor, serversConfig) => {
    const response = await makeRequest(
      `/api/mcp-servers?executor=${encodeURIComponent(executor)}`,
      {
        method: 'POST',  
        body: JSON.stringify(serversConfig),
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[VibeKanban API Error] Failed to save MCP servers', {
        message: errorData.message,
        status: response.status,
        response,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        errorData.message || 'Failed to save MCP servers',
        response.status,
        response
      );
    }
  },
};

// GitHub APIs (only available in cloud mode)
export const githubApi = {
  listRepositories: async (page = 1) => {
    const response = await makeRequest(`/api/github/repositories?page=${page}`);
    return handleApiResponse(response);
  },
  
  createProjectFromRepository: async (data) => {
    const response = await makeRequest('/api/projects/from-github', {
      method: 'POST',
      body: JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? Number(value) : value
      ),
    });
    return handleApiResponse(response);
  },
};

// Execution Process APIs
export const executionProcessesApi = {
  getDetails: async (processId) => {
    const response = await makeRequest(`/api/execution-processes/${processId}`);
    return handleApiResponse(response);
  },
};