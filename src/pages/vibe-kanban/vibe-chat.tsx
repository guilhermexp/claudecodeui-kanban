import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi, tasksApi, githubApi, templatesApi } from '../../lib/vibe-kanban/api';
import { Button } from '../../components/vibe-kanban/ui/button';
import { MicButton } from '../../components/MicButton';
import { ProjectForm } from '../../components/vibe-kanban/projects/project-form';
import { EXECUTOR_TYPES, EXECUTOR_LABELS } from '../../lib/vibe-kanban/shared-types';
import { useConfig } from '../../components/vibe-kanban/config-provider';
import { 
  FolderOpen, 
  GitBranch, 
  Archive, 
  Calendar,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Settings2,
  Clock,
  Circle
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
  repository_url?: string;
  local_path: string;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  has_in_progress_attempt?: boolean;
  has_merged_attempt?: boolean;
  last_attempt_failed?: boolean;
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

interface TaskTemplate {
  id: string;
  template_name: string;
  title: string;
  description: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export function VibeChat() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [selectedExecutor, setSelectedExecutor] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showExecutorDropdown, setShowExecutorDropdown] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load projects on mount and set default executor
  useEffect(() => {
    loadProjects();
    // Set default executor from config
    if (config?.default_executor && EXECUTOR_TYPES.includes(config.default_executor)) {
      setSelectedExecutor(config.default_executor);
    } else {
      // Default to claude if not set
      setSelectedExecutor('claude');
    }
  }, [config]);

  // Load tasks when project changes
  useEffect(() => {
    if (selectedProject) {
      loadTasks();
      loadBranches();
    }
  }, [selectedProject]);

  // Load all tasks when projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      loadAllTasks();
    }
  }, [projects]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [taskDescription]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowProjectDropdown(false);
        setShowBranchDropdown(false);
        setShowTemplatesDropdown(false);
        setShowExecutorDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const data = await projectsApi.getAll();
      setProjects(data);
      
      // Auto-select first project
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadTasks = async () => {
    if (!selectedProject) return;
    
    try {
      setIsLoadingTasks(true);
      const data = await tasksApi.getAll(selectedProject.id);
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadAllTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const taskPromises = projects.map(project => 
        tasksApi.getAll(project.id).catch(() => [])
      );
      const allTasksArrays = await Promise.all(taskPromises);
      const combinedTasks = allTasksArrays.flat();
      
      // Sort by created_at descending (newest first)
      combinedTasks.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setAllTasks(combinedTasks);
    } catch (error) {
      console.error('Failed to load all tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadBranches = async () => {
    if (!selectedProject?.repository_url) {
      setBranches([]);
      return;
    }
    
    try {
      const data = await projectsApi.getBranches(selectedProject.id);
      setBranches(data);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setBranches([]);
    }
  };

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      
      // Load both global templates and project-specific templates
      const [globalTemplates, projectTemplates] = await Promise.all([
        templatesApi.listGlobal(),
        selectedProject ? templatesApi.listByProject(selectedProject.id) : Promise.resolve([])
      ]);
      
      // Combine and sort templates (project templates first, then global)
      const allTemplates = [...projectTemplates, ...globalTemplates];
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskDescription?.trim() || !selectedProject || isCreatingTask) return;
    
    try {
      setIsCreatingTask(true);
      
      // Generate automatic title from description (first 50 chars or first line)
      const firstLine = taskDescription?.trim().split('\n')[0] || '';
      const autoTitle = firstLine.length > 50 
        ? firstLine.substring(0, 47) + '...' 
        : firstLine;
      
      const newTask = {
        project_id: selectedProject.id,
        title: autoTitle,
        description: taskDescription?.trim() || null,
        parent_task_attempt: null,
        executor: selectedExecutor ? {
          type: selectedExecutor,
          config: {}
        } : null
      };
      
      // Use createAndStart to create the task and immediately start it
      await tasksApi.createAndStart(selectedProject.id, newTask);
      
      // Clear input and reload tasks
      setTaskDescription('');
      await loadTasks();
      await loadAllTasks(); // Also reload all tasks
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to create and start task:', error);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleCreateTask();
    }
  };

  const handleTranscriptionComplete = (text: string) => {
    setTaskDescription(text);
  };

  const handleTemplateSelect = (template: TaskTemplate) => {
    // The template content is in the 'description' field
    setTaskDescription(template.description || '');
    setShowTemplatesDropdown(false);
    
    // Focus on the textarea after applying template
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  };

  const handleProjectFormSuccess = () => {
    setShowProjectForm(false);
    loadProjects();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: 'numeric', 
        month: 'short' 
      }).replace('.', '');
    }
  };

  const getProjectDisplayName = (project: Project) => {
    if (project.repository_url) {
      // Extract repo name from URL
      const match = project.repository_url.match(/github\.com[:/](.+?)(?:\.git)?$/);
      if (match) {
        return match[1];
      }
    }
    return project.name;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-8">
        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-8 text-gray-900 dark:text-white">
          O que vamos programar a seguir?
        </h1>

        {/* Main Input Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border mb-4 sm:mb-8">
          <div className="p-4 sm:p-6">
            {!selectedProject && (
              <div className="mb-4 p-2 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                  Selecione um projeto para começar a criar tarefas
                </p>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva uma tarefa e pressione Cmd+Enter para criar"
              className="w-full min-h-[100px] sm:min-h-[120px] resize-none bg-transparent text-base sm:text-lg placeholder-muted-foreground focus:outline-none text-foreground"
              disabled={isCreatingTask || !selectedProject}
            />
          </div>
          
          {/* Controls Bar */}
          <div className="border-t border-border px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Project Selector */}
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProjectDropdown(!showProjectDropdown);
                      setShowBranchDropdown(false);
                      setShowTemplatesDropdown(false);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="max-w-[120px] sm:max-w-[200px] truncate">
                      {selectedProject ? getProjectDisplayName(selectedProject) : 'Selecione um projeto'}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", showProjectDropdown && "rotate-180")} />
                  </button>
                  
                  {/* Project Dropdown */}
                  {showProjectDropdown && (
                    <div className="absolute top-full left-0 right-0 sm:right-auto mt-1 w-full sm:w-64 bg-popover rounded-xl shadow-lg border border-border z-10 max-h-48 sm:max-h-64 overflow-y-auto">
                      {isLoadingProjects ? (
                        <div className="px-3 py-4 text-xs sm:text-sm text-muted-foreground text-center">
                          Carregando projetos...
                        </div>
                      ) : projects.length === 0 ? (
                        <div className="px-3 py-4 text-xs sm:text-sm text-muted-foreground text-center">
                          <p>Nenhum projeto encontrado</p>
                          <button
                            onClick={() => navigate('/vibe-kanban/projects')}
                            className="mt-2 text-primary hover:underline"
                          >
                            Criar projeto
                          </button>
                        </div>
                      ) : (
                        projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => {
                              setSelectedProject(project);
                              setShowProjectDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {getProjectDisplayName(project)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Executor Selector */}
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExecutorDropdown(!showExecutorDropdown);
                      setShowProjectDropdown(false);
                      setShowBranchDropdown(false);
                      setShowTemplatesDropdown(false);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="max-w-[80px] sm:max-w-[120px] truncate">
                      {EXECUTOR_LABELS[selectedExecutor] || selectedExecutor || 'Agente'}
                    </span>
                    <ChevronDown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform", showExecutorDropdown && "rotate-180")} />
                  </button>
                  
                  {/* Executor Dropdown */}
                  {showExecutorDropdown && (
                    <div className="absolute top-full left-0 right-0 sm:right-auto mt-1 w-full sm:w-56 bg-popover rounded-xl shadow-lg border border-border z-10 max-h-48 sm:max-h-64 overflow-y-auto">
                      {EXECUTOR_TYPES.map((executor) => (
                        <button
                          key={executor}
                          onClick={() => {
                            setSelectedExecutor(executor);
                            setShowExecutorDropdown(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            selectedExecutor === executor && "bg-accent text-accent-foreground"
                          )}
                        >
                          {EXECUTOR_LABELS[executor] || executor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Templates Button */}
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTemplatesDropdown(!showTemplatesDropdown);
                      setShowProjectDropdown(false);
                      setShowBranchDropdown(false);
                      setShowExecutorDropdown(false);
                      // Load templates when opening dropdown
                      if (!showTemplatesDropdown) {
                        loadTemplates();
                      }
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    title="Templates"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className="hidden sm:inline">Templates</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform", showTemplatesDropdown && "rotate-180")} />
                  </button>
                  
                  {/* Templates Dropdown */}
                  {showTemplatesDropdown && (
                    <div className="absolute top-full left-0 right-0 sm:right-auto mt-1 w-full sm:w-64 bg-popover rounded-xl shadow-lg border border-border z-10 max-h-48 sm:max-h-64 overflow-y-auto">
                      {isLoadingTemplates ? (
                        <div className="px-3 py-4 text-xs sm:text-sm text-muted-foreground text-center">
                          Carregando templates...
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="px-3 py-4 text-xs sm:text-sm text-muted-foreground text-center">
                          Nenhum template disponível
                        </div>
                      ) : (
                        <div>
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleTemplateSelect(template)}
                              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <div className="text-xs sm:text-sm font-medium text-foreground">
                                {template.template_name}
                              </div>
                              {template.title && (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {template.title}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {template.project_id ? 'Projeto' : 'Global'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Send Button */}
                <button
                  onClick={handleCreateTask}
                  disabled={!taskDescription?.trim() || isCreatingTask || !selectedProject}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg transition-colors",
                    taskDescription?.trim() && selectedProject && !isCreatingTask
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  title="Criar tarefa (Cmd+Enter)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>

                {/* Mic Button */}
                <MicButton
                  onTranscript={handleTranscriptionComplete}
                  className="bg-muted hover:bg-muted/80"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="bg-card rounded-2xl shadow-sm border border-border">
          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex">
              <button
                onClick={() => setActiveTab('tasks')}
                className={cn(
                  "px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'tasks'
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Tarefas
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={cn(
                  "px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'projects'
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Projetos
              </button>
            </div>
          </div>

          {/* Content based on active tab */}
          <div className="p-3 sm:p-4">
            {activeTab === 'tasks' ? (
              // Tasks Tab Content
              isLoadingTasks ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando tarefas...
                </div>
              ) : allTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tarefa encontrada
                </div>
              ) : (
                <div className="space-y-3">
                  {allTasks
                    .filter(task => task.status !== 'archived')
                    .map((task) => {
                      const project = projects.find(p => p.id === task.project_id);
                      return (
                        <div
                          key={task.id}
                          className="p-3 sm:p-4 rounded-xl border border-border hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => navigate(`/vibe-kanban/projects/${task.project_id}/tasks/${task.id}`)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm sm:text-base text-foreground mb-1 flex-1">
                              {task.title}
                            </h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* TODO Indicator - Gray/Muted */}
                              {task.status === 'todo' && !task.has_in_progress_attempt && !task.has_merged_attempt && !task.last_attempt_failed && (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              {/* In Review Indicator - Orange */}
                              {task.status === 'inreview' && (
                                <Clock className="h-4 w-4 text-orange-500" />
                              )}
                              {/* In Progress Spinner - Blue */}
                              {task.status === 'inprogress' && task.has_in_progress_attempt && (
                                <div className="relative flex h-4 w-4">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                                </div>
                              )}
                              {/* Done/Merged Indicator - Green */}
                              {(task.status === 'done' || task.has_merged_attempt) && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {/* Failed Indicator - Red */}
                              {task.last_attempt_failed && task.status !== 'done' && !task.has_merged_attempt && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(task.created_at)}
                            </span>
                            {project && (
                              <span>• {getProjectDisplayName(project)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )
            ) : (
              // Projects Tab Content
              <>
                {/* Create Project Button */}
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => setShowProjectForm(true)}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Criar Projeto</span>
                    <span className="sm:hidden">Criar</span>
                  </Button>
                </div>
                
                {isLoadingProjects ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando projetos...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum projeto encontrado</p>
                    <button
                      onClick={() => navigate('/vibe-kanban/projects')}
                      className="mt-2 text-primary hover:underline"
                    >
                      Criar seu primeiro projeto
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="p-3 sm:p-4 rounded-xl border border-border hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => navigate(`/vibe-kanban/projects/${project.id}/tasks`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-sm sm:text-base text-foreground mb-1">
                              {getProjectDisplayName(project)}
                            </h3>
                            {project.description && (
                              <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                                {project.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="hidden sm:inline">Criado em</span> {formatDate(project.created_at)}
                              </span>
                              {project.repository_url && (
                                <span className="flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  GitHub
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
      
      {/* Project Form Modal */}
      <ProjectForm
        open={showProjectForm}
        onClose={() => setShowProjectForm(false)}
        onSuccess={handleProjectFormSuccess}
        project={null}
      />
    </div>
  );
}