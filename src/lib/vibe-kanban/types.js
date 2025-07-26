// Basic types for VibeKanban integration
// This file provides basic type structures for the VibeKanban components
// to work properly without TypeScript dependencies

export const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const ExecutorType = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  AMP: 'amp',
  AIDER: 'aider'
};

export const EditorType = {
  VSCODE: 'vscode',
  CURSOR: 'cursor',
  SUBLIME: 'sublime',
  VIM: 'vim'
};

// Default configuration object
export const defaultConfig = {
  disclaimer_acknowledged: false,
  onboarding_acknowledged: false,
  github_login_acknowledged: false,
  telemetry_acknowledged: false,
  analytics_enabled: false,
  theme: 'system',
  executor: ExecutorType.CLAUDE,
  editor: EditorType.VSCODE
};

// Helper functions for working with types
export const createProject = (data) => ({
  id: null,
  name: '',
  description: '',
  repository_url: null,
  local_path: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...data
});

export const createTask = (data) => ({
  id: null,
  project_id: '',
  title: '',
  description: '',
  status: TaskStatus.TODO,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  parent_task_id: null,
  ...data
});

export const createTaskAttempt = (data) => ({
  id: null,
  task_id: '',
  executor_type: ExecutorType.CLAUDE,
  status: 'pending',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
  branch_name: null,
  pr_url: null,
  ...data
});