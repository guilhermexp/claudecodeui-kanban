import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import FolderPicker from './FolderPicker';
import { Folder, FolderOpen, FolderPlus, RefreshCw, Loader2, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';

const STORAGE_KEY = 'app-project-browser-root';
const browserLogger = createLogger('ProjectBrowserSidebar');

const normalizePath = (value = '') => {
  if (!value) return '';
  return String(value).replace(/\/+$/, '').toLowerCase();
};

const getStoredRootPath = () => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const storeRootPath = (path) => {
  if (typeof window === 'undefined') return;
  try {
    if (path) {
      localStorage.setItem(STORAGE_KEY, path);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures silently
  }
};

function ProjectBrowserSidebar({
  projects = [],
  selectedProject = null,
  onProjectSelect = null,
  onProjectsRefresh = null,
  onCollapse = null,
  className
}) {
  const [rootPath, setRootPath] = useState(() => getStoredRootPath());
  const [directories, setDirectories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingPath, setCreatingPath] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  const projectByPath = useMemo(() => {
    const map = new Map();
    (projects || []).forEach((project) => {
      const normalized = normalizePath(project.fullPath || project.path);
      if (normalized) {
        map.set(normalized, project);
      }
    });
    return map;
  }, [projects]);

  const activeProjectPath = normalizePath(selectedProject?.fullPath || selectedProject?.path);

  const loadDirectories = useCallback(async (targetPath) => {
    if (!targetPath) {
      setDirectories([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.authenticatedFetch(`/api/files/list-dirs?path=${encodeURIComponent(targetPath)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to list folders');
      }
      setDirectories(Array.isArray(payload?.files) ? payload.files : []);
      setStatusMessage(null);
    } catch (err) {
      browserLogger.error('Failed to load directories', { error: err });
      setDirectories([]);
      setError(err.message || 'Unable to read folders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rootPath) {
      loadDirectories(rootPath);
    } else {
      setDirectories([]);
    }
  }, [rootPath, loadDirectories]);

  const handleRootChange = (path) => {
    setRootPath(path || '');
    storeRootPath(path || '');
    setStatusMessage(null);
  };

  const handleSelectDirectory = async (directory) => {
    if (!directory?.path) return;
    if (creatingPath) return;

    const normalized = normalizePath(directory.path);
    const existingProject = projectByPath.get(normalized);

    if (existingProject) {
      browserLogger.info('Selecting existing project from browser', { path: directory.path });
      onProjectSelect?.(existingProject);
      setStatusMessage({ type: 'success', text: `Projeto ${existingProject.displayName || existingProject.name} selecionado.` });
      return;
    }

    setCreatingPath(directory.path);
    setStatusMessage({ type: 'info', text: 'Criando projeto…' });

    try {
      const response = await api.createProject(directory.path);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Falha ao criar projeto');
      }
      const payload = await response.json().catch(() => ({}));
      const createdProject = payload.project || payload;

      if (typeof onProjectsRefresh === 'function') {
        try {
          await onProjectsRefresh();
        } catch (refreshError) {
          browserLogger.warn('Failed to refresh projects after creation', { error: refreshError });
        }
      }

      if (createdProject) {
        onProjectSelect?.(createdProject);
        setStatusMessage({ type: 'success', text: 'Projeto criado e selecionado!' });
      } else {
        setStatusMessage({ type: 'success', text: 'Projeto criado. Atualize a lista para vê-lo.' });
      }
    } catch (err) {
      browserLogger.error('Failed to create project from browser', { error: err });
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao criar projeto' });
    } finally {
      setCreatingPath('');
    }
  };

  return (
    <>
      <div className={cn(
        'relative h-full flex flex-col rounded-3xl border border-border/40',
        'bg-gradient-to-b from-background/75 via-background/55 to-background/35',
        'backdrop-blur-2xl text-xs overflow-hidden'
      , className)}>
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
                Projetos locais
              </p>
              {rootPath ? (
                <p className="text-[11px] text-foreground/90 mt-1 truncate" title={rootPath}>{rootPath}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">Escolha seu diretório base.</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => rootPath && loadDirectories(rootPath)}
                disabled={!rootPath || isLoading}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-border/20 disabled:opacity-40 transition-colors"
                title="Atualizar"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setPickerOpen(true)}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-border/20 transition-colors"
                title="Selecionar pasta"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              {onCollapse && (
                <button
                  onClick={onCollapse}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-border/20 transition-colors"
                  title="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {rootPath && (
            <button
              className="mt-2 text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors"
              onClick={() => handleRootChange('')}
            >
              Limpar seleção
            </button>
          )}
          {!rootPath && (
            <Button
              className="mt-3 w-full h-8 text-xs rounded-full"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Escolher pasta
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 py-3 space-y-1.5">
          {!rootPath ? (
            <div className="text-center text-muted-foreground/80 text-[11px] px-3 py-8 border border-dashed border-border/60 rounded-xl bg-background/30">
              Selecione um diretório para listar os projetos.
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 text-[11px]">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando pastas…
            </div>
          ) : error ? (
            <div className="text-center text-destructive text-[11px] px-3 py-5 border border-destructive/40 bg-destructive/10 rounded-xl">
              {error}
            </div>
          ) : directories.length === 0 ? (
            <div className="text-center text-muted-foreground/80 text-[11px] px-3 py-8 border border-dashed border-border/60 rounded-xl">
              Nenhuma subpasta encontrada.
            </div>
          ) : (
            directories.map((dir) => {
              const normalized = normalizePath(dir.path);
              const isActive = normalized === activeProjectPath;
              const linkedProject = projectByPath.get(normalized);
              const isCreating = creatingPath === dir.path;

              return (
                <button
                  key={dir.path}
                  onClick={() => handleSelectDirectory(dir)}
                  className={cn(
                    'w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-3 transition-colors',
                    'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                    isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
                    isCreating && 'opacity-70'
                  )}
                  disabled={!!creatingPath && creatingPath !== dir.path}
                >
                  <div className={cn(
                    'h-7 w-7 rounded-md border border-border/40 flex items-center justify-center shrink-0',
                    isActive ? 'bg-primary/20 text-primary-foreground border-primary/30' : 'bg-background/40 text-foreground/70'
                  )}>
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', isActive ? 'text-foreground' : 'text-foreground/90')}>
                      {dir.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate" title={dir.path}>{dir.path}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {linkedProject && (
                      <Badge className="text-[10px] font-medium uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                        {linkedProject.displayName || linkedProject.name}
                      </Badge>
                    )}
                    {isActive && (
                      <Badge className="text-[10px] font-medium uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-400/20">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : linkedProject ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>

        {statusMessage && (
          <div className="px-4 py-3 border-t border-border/40 bg-background/40 text-[11px]">
            <p
              className={cn(
                statusMessage.type === 'success' && 'text-emerald-400',
                statusMessage.type === 'error' && 'text-destructive',
                statusMessage.type === 'info' && 'text-muted-foreground'
              )}
            >
              {statusMessage.text}
            </p>
          </div>
        )}
      </div>

      <FolderPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(folderPath) => {
          handleRootChange(folderPath);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

export default ProjectBrowserSidebar;
