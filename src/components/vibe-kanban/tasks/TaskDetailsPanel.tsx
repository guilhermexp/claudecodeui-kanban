import { useEffect, useState } from 'react';
import TaskDetailsHeader from './TaskDetailsHeader';
import { TaskFollowUpSection } from './TaskFollowUpSection';
import { EditorSelectionDialog } from './EditorSelectionDialog';
import {
  getBackdropClasses,
  getTaskPanelClasses,
} from '../../../lib/vibe-kanban/responsive-config';
import type { TaskWithAttemptStatus } from '../../../lib/vibe-kanban/shared-types';
import DiffTab from './TaskDetails/DiffTab';
import LogsTab from './TaskDetails/LogsTab';
import RelatedTasksTab from './TaskDetails/RelatedTasksTab';
import ProcessesTab from './TaskDetails/ProcessesTab';
import PlanTab from './TaskDetails/PlanTab';
import DeleteFileConfirmationDialog from './DeleteFileConfirmationDialog';
import TabNavigation from './TaskDetails/TabNavigation';
import CollapsibleToolbar from './TaskDetails/CollapsibleToolbar';
import TaskDetailsProvider from '../context/TaskDetailsContextProvider';

interface TaskDetailsPanelProps {
  task: TaskWithAttemptStatus | null;
  projectHasDevScript?: boolean;
  projectId: string;
  onClose: () => void;
  onEditTask?: (task: TaskWithAttemptStatus) => void;
  onDeleteTask?: (taskId: string) => void;
  isDialogOpen?: boolean;
}

export function TaskDetailsPanel({
  task,
  projectHasDevScript,
  projectId,
  onClose,
  onEditTask,
  onDeleteTask,
  isDialogOpen = false,
}: TaskDetailsPanelProps) {
  const [showEditorDialog, setShowEditorDialog] = useState(false);

  // Tab and collapsible state
  const [activeTab, setActiveTab] = useState<
    'logs' | 'diffs' | 'related' | 'processes' | 'plan'
  >('logs');

  // Reset to logs tab when task changes
  useEffect(() => {
    if (task?.id) {
      setActiveTab('logs');
    }
  }, [task?.id]);

  // Handle ESC key locally to prevent global navigation
  useEffect(() => {
    if (isDialogOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, isDialogOpen]);

  return (
    <>
      {!task ? null : (
        <TaskDetailsProvider
          key={task.id}
          task={task}
          projectId={projectId}
          setShowEditorDialog={setShowEditorDialog}
          projectHasDevScript={projectHasDevScript}
        >
          {/* Backdrop - only on smaller screens (overlay mode) */}
          <div className={getBackdropClasses()} onClick={onClose} />

          {/* Panel */}
          <div className={getTaskPanelClasses()}>
            <TaskDetailsHeader
              onClose={onClose}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />

            <CollapsibleToolbar />

            <TabNavigation
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            {/* Tab Content */}
            <div
              className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'logs' ? 'p-2 sm:p-4 dark:bg-black' : 'pt-2 sm:pt-4'}`}
            >
              {activeTab === 'diffs' ? (
                <DiffTab />
              ) : activeTab === 'related' ? (
                <RelatedTasksTab />
              ) : activeTab === 'processes' ? (
                <ProcessesTab />
              ) : activeTab === 'plan' ? (
                <PlanTab />
              ) : (
                <LogsTab />
              )}
            </div>

            <TaskFollowUpSection />
          </div>

          <EditorSelectionDialog
            isOpen={showEditorDialog}
            onClose={() => setShowEditorDialog(false)}
          />

          <DeleteFileConfirmationDialog />
        </TaskDetailsProvider>
      )}
    </>
  );
}
