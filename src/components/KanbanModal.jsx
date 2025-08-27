import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Kanban, ChevronDown, Loader2, Folder } from 'lucide-react';
import KanbanModalContent from './KanbanModalContent';
import { projectsApi } from '../lib/vibe-kanban/api';
import { api } from '../utils/api';
import { cn } from '../lib/utils';

function KanbanModal({ 
  isOpen, 
  onClose, 
  selectedProject: initialProject,
  isMobile 
}) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [vibeProjects, setVibeProjects] = useState([]);
  const [claudeProjects, setClaudeProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAllProjects();
    }
  }, [isOpen]);
  
  // Process initial project after projects are loaded
  useEffect(() => {
    if (projectsLoaded && initialProject && !selectedProject) {
      setupProjectIfNeeded(initialProject);
    }
  }, [projectsLoaded, initialProject]);

  const loadAllProjects = async () => {
    try {
      setLoadingProjects(true);
      
      // Load Vibe Kanban projects
      try {
        const vibeProjectsData = await projectsApi.getAll();
        setVibeProjects(vibeProjectsData || []);
      } catch (error) {
        console.error('Error loading Vibe projects:', error);
        setVibeProjects([]);
      }
      
      // Load Claude projects from the main app
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const claudeProjectsData = await response.json();
          setClaudeProjects(claudeProjectsData || []);
        } else {
          setClaudeProjects([]);
        }
      } catch (error) {
        console.error('Error loading Claude projects:', error);
        setClaudeProjects([]);
      }
      
      setProjectsLoaded(true);
      
      // If initialProject is provided, check if it needs a Vibe project
      if (initialProject && !selectedProject) {
        await setupProjectIfNeeded(initialProject);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const setupProjectIfNeeded = async (claudeProject) => {
    if (!claudeProject) return null;
    
    // First try to find in already loaded Vibe projects
    const existingVibe = vibeProjects.find(vp => 
      vp.local_path === claudeProject.path || 
      vp.name === claudeProject.name || 
      vp.name === claudeProject.displayName
    );
    
    if (existingVibe) {
      setSelectedProject(existingVibe);
      return existingVibe;
    }
    
    // If not found, try to get from API to check if it exists
    try {
      const allVibeProjects = await projectsApi.getAll();
      const foundVibe = allVibeProjects.find(vp => 
        vp.local_path === claudeProject.path || 
        vp.name === claudeProject.name || 
        vp.name === claudeProject.displayName
      );
      
      if (foundVibe) {
        setSelectedProject(foundVibe);
        return foundVibe;
      }
    } catch (error) {
      console.error('Error checking existing Vibe projects:', error);
    }
    
    // Create a new Vibe project for this Claude project
    try {
      const projectName = claudeProject.displayName || claudeProject.name || 'Unnamed Project';
      const projectPath = claudeProject.path || claudeProject.fullPath || '/';
      
      const newVibeProject = await projectsApi.create({
        name: projectName,
        description: `Project for ${projectPath}`,
        local_path: projectPath,
        repository_url: '',
        task_server_config: {
          executor: 'local',
          editor: 'vscode'
        }
      });
      
      setSelectedProject(newVibeProject);
      setVibeProjects(prev => [...prev, newVibeProject]);
      return newVibeProject;
    } catch (error) {
      console.error('Error creating Vibe project:', error);
      // If creation fails, create a temporary project object
      const tempProject = {
        id: `temp-${Date.now()}`,
        name: claudeProject.displayName || claudeProject.name || 'Unnamed Project',
        description: 'Temporary project',
        local_path: claudeProject.path || claudeProject.fullPath || '/',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSelectedProject(tempProject);
      return tempProject;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] p-0" onOpenChange={onClose}>
        <DialogHeader className="px-4 pr-12 pt-4 pb-3 border-b border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Kanban className="w-5 h-5 text-primary/70" />
              <DialogTitle className="text-lg font-semibold text-foreground">
                Task Board
              </DialogTitle>
              
              {/* Project Dropdown */}
              <div className="ml-4 relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <span className="text-foreground">
                    {selectedProject ? selectedProject.name : (initialProject ? (initialProject.displayName || initialProject.name) : 'Select Project')}
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    dropdownOpen && "rotate-180"
                  )} />
                </button>
                
                {/* Dropdown Menu - Grid Layout */}
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[600px] bg-background border border-border rounded-xl shadow-2xl z-50 p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Select Project</h3>
                      <p className="text-xs text-muted-foreground mt-1">Choose a project to view its task board</p>
                    </div>
                    
                    {loadingProjects ? (
                      <div className="py-8 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
                      </div>
                    ) : (claudeProjects.length > 0 || vibeProjects.length > 0) ? (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {/* Claude Projects Section */}
                        {claudeProjects.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Claude Projects</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {claudeProjects.map(project => (
                                <button
                                  key={`claude-${project.id}`}
                                  onClick={async () => {
                                    const vibeProject = await setupProjectIfNeeded(project);
                                    if (vibeProject) {
                                      setDropdownOpen(false);
                                    }
                                  }}
                                  className={cn(
                                    "relative p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-all duration-200 text-left group",
                                    "hover:shadow-md hover:border-primary/20"
                                  )}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-foreground text-sm truncate flex-1">
                                      {project.displayName || project.name}
                                    </h4>
                                    <Folder className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {project.path}
                                  </p>
                                  {project.sessionsCount > 0 && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        {project.sessionsCount} session{project.sessionsCount !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Vibe Kanban Projects Section */}
                        {vibeProjects.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vibe Kanban Projects</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {vibeProjects.map(project => {
                                const createdDate = new Date(project.created_at);
                                const formattedDate = `${createdDate.getMonth() + 1}/${createdDate.getDate()}/${createdDate.getFullYear()}`;
                                
                                return (
                                  <button
                                    key={project.id}
                                    onClick={() => {
                                      setSelectedProject(project);
                                      setDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "relative p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-all duration-200 text-left group",
                                      "hover:shadow-md hover:border-primary/20",
                                      selectedProject?.id === project.id && "bg-card border-primary/50 shadow-md"
                                    )}
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-semibold text-foreground text-sm truncate flex-1">
                                        {project.name}
                                      </h4>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />
                                      </div>
                                    </div>
                                    
                                    {project.description && (
                                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                        {project.description}
                                      </p>
                                    )}
                                    
                                    <div className="flex items-center text-xs text-muted-foreground">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Created {formattedDate}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No projects found</p>
                        <p className="text-xs text-muted-foreground">Create a project or select from your Claude projects</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[calc(85vh-4rem)] overflow-hidden bg-background/30">
          <KanbanModalContent 
            selectedProject={selectedProject}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KanbanModal;