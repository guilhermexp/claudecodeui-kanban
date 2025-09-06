import React, { createContext, useContext, useState, useCallback } from 'react';
import ProjectsModal from '../ProjectsModal';
import PromptsModal from '../PromptsModal';
import PromptEnhancer from '../PromptEnhancer';
import CodeEditor from '../CodeEditor';
import GitPanel from '../GitPanel';

// Context
const ModalManagerContext = createContext();

// Custom hook
export const useModalManager = () => {
  const context = useContext(ModalManagerContext);
  if (!context) {
    throw new Error('useModalManager must be used within a ModalManager');
  }
  return context;
};

// Manager component
export const ModalManager = ({ 
  children, 
  // Project-related props
  projects,
  selectedProject,
  selectedSession,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  onRefresh,
  // Prompt execution handler
  onExecutePrompt,
  // Prompt enhancer handlers  
  onSendToClaude,
  onSendToCodex,
  // File editing
  editingFile,
  onCloseEditor,
  forceMdPreview,
  ...otherProps
}) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPropsState, setModalPropsState] = useState({});

  // Actions
  const showModal = useCallback((modalType, props = {}) => {
    setActiveModal(modalType);
    setModalPropsState(prev => ({ ...prev, [modalType]: props }));
  }, []);

  const hideModal = useCallback((modalType = null) => {
    if (modalType === null || modalType === activeModal) {
      setActiveModal(null);
    }
  }, [activeModal]);

  const hideAllModals = useCallback(() => {
    setActiveModal(null);
    setModalPropsState({});
  }, []);

  const setModalProps = useCallback((modalType, props) => {
    setModalPropsState(prev => ({ ...prev, [modalType]: props }));
  }, []);

  // Context value
  const value = {
    // State
    activeModal,
    modals: {
      projects: activeModal === 'projects',
      git: activeModal === 'git',
      prompts: activeModal === 'prompts',
      enhancer: activeModal === 'enhancer',
    },
    
    // Actions
    showModal,
    hideModal,
    hideAllModals,
    
    // Props management
    modalProps: modalPropsState,
    setModalProps,
    
    // Pass through props from parent
    ...modalProps,
  };

  return (
    <ModalManagerContext.Provider value={value}>
      {children}
      
      {/* Code Editor Modal */}
      {editingFile && (
        <CodeEditor
          file={editingFile}
          onClose={onCloseEditor}
          projectPath={selectedProject?.path}
          preferMarkdownPreview={forceMdPreview}
        />
      )}
      
      {/* Projects Modal */}
      <ProjectsModal
        isOpen={activeModal === 'projects'}
        onClose={() => hideModal('projects')}
        projects={projects}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onNewSession={onNewSession}
        onSessionDelete={onSessionDelete}
        onProjectDelete={onProjectDelete}
        isLoading={false}
        onRefresh={onRefresh}
      />
      
      {/* Git Modal */}
      {activeModal === 'git' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => hideModal('git')} />
          <div className="relative z-50 w-full max-w-4xl max-h-[85vh] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <GitPanel 
              selectedProject={selectedProject} 
              isMobile={false} 
              isVisible={true} 
              onClose={() => hideModal('git')} 
            />
          </div>
        </div>
      )}

      {/* Prompts Modal */}
      <PromptsModal 
        isOpen={activeModal === 'prompts'} 
        onClose={() => hideModal('prompts')}
        onExecutePrompt={onExecutePrompt}
      />

      {/* Prompt Enhancer Modal */}
      <PromptEnhancer
        open={activeModal === 'enhancer'}
        onClose={() => hideModal('enhancer')}
        onSendToClaude={onSendToClaude}
        onSendToCodex={onSendToCodex}
      />
    </ModalManagerContext.Provider>
  );
};

export default ModalManager;
