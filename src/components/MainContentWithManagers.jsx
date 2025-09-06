import React from 'react';
import MainContent from './MainContent';
import { ModalManager } from './managers/ModalManager';

// Intermediate wrapper component for gradual manager integration
const MainContentWithManagers = (props) => {
  // Extract modal-related props for ModalManager
  const modalManagerProps = {
    projects: props.projects,
    selectedProject: props.selectedProject,
    selectedSession: props.selectedSession,
    onProjectSelect: props.onProjectSelect,
    onSessionSelect: props.onSessionSelect,
    onNewSession: props.onNewSession,
    onSessionDelete: props.onSessionDelete,
    onProjectDelete: props.onProjectDelete,
    onRefresh: props.onRefresh,
    // These will be passed from MainContent initially
    onExecutePrompt: null, // Will be set by MainContent
    onSendToClaude: null,  // Will be set by MainContent
    onSendToCodex: null,   // Will be set by MainContent
    editingFile: null,     // Will be managed by MainContent initially
    onCloseEditor: null,   // Will be set by MainContent
    forceMdPreview: false, // Will be managed by MainContent initially
  };

  return (
    <ModalManager {...modalManagerProps}>
      <MainContent {...props} />
    </ModalManager>
  );
};

export default MainContentWithManagers;
