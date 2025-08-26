import { TaskDetailsPanel } from './TaskDetailsPanel';
import type { TaskWithAttemptStatus } from '../../../lib/vibe-kanban/shared-types';

interface TaskDetailsPanelWrapperProps {
  task: TaskWithAttemptStatus | null;
  projectId: string;
  onClose: () => void;
  onEditTask?: (task: TaskWithAttemptStatus) => void;
  onDeleteTask?: (taskId: string) => void;
}

export function TaskDetailsPanelWrapper({
  task,
  projectId,
  onClose,
  onEditTask,
  onDeleteTask,
}: TaskDetailsPanelWrapperProps) {
  if (!task) return null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <style>{`
        /* Override the fixed positioning from TaskDetailsPanel */
        .fixed.inset-y-0.right-0.z-50 {
          position: relative !important;
          inset: auto !important;
          z-index: auto !important;
          height: 100% !important;
          width: 100% !important;
          max-width: none !important;
        }
        
        /* Hide the backdrop */
        .fixed.inset-0.z-40.bg-black\\/50 {
          display: none !important;
        }
        
        /* Override internal widths to use full panel width */
        [class*="max-w-"] {
          max-width: none !important;
        }
        
        /* Remove any max-height constraints from overlay classes when embedded */
        [class*="max-h-"] {
          max-height: none !important;
        }
        [class*="sm:max-h-"],
        [class*="md:max-h-"],
        [class*="lg:max-h-"],
        [class*="xl:max-h-"],
        [class*="2xl:max-h-"] {
          max-height: none !important;
        }
        
        /* Ensure content uses available space */
        .flex.flex-col.overflow-hidden {
          width: 100% !important;
          min-height: 0 !important;
        }
        
        /* Adjust padding for better space usage */
        @media (min-width: 1280px) {
          .p-3.sm\\:p-4,
          .px-3.sm\\:px-4 {
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }
        }
      `}</style>
      <TaskDetailsPanel
        task={task}
        projectHasDevScript={false}
        projectId={projectId}
        onClose={onClose}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        isDialogOpen={false}
      />
    </div>
  );
}