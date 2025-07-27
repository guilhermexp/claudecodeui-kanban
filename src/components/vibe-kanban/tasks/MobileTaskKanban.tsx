import { memo, useCallback, useEffect, useState } from 'react';
import {
  type DragEndEvent,
  KanbanBoard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '../ui/shadcn-io/kanban';
import { TaskCard } from './TaskCard';
import type { TaskStatus, TaskWithAttemptStatus } from '../../../lib/vibe-kanban/shared-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../../lib/vibe-kanban/utils';

type Task = TaskWithAttemptStatus;

interface MobileTaskKanbanProps {
  tasks: Task[];
  searchQuery?: string;
  onDragEnd: (event: DragEndEvent) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onViewTaskDetails: (task: Task) => void;
  groupedTasks: Record<TaskStatus, Task[]>;
  allTaskStatuses: readonly TaskStatus[];
  statusLabels: Record<TaskStatus, string>;
  statusBoardColors: Record<TaskStatus, string>;
  focusedTaskId: string | null;
}

function MobileTaskKanban({
  onDragEnd,
  onEditTask,
  onDeleteTask,
  onViewTaskDetails,
  groupedTasks,
  allTaskStatuses,
  statusLabels,
  statusBoardColors,
  focusedTaskId,
}: MobileTaskKanbanProps) {
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);

  // Handle column navigation
  const handleNextColumn = useCallback(() => {
    if (currentColumnIndex < allTaskStatuses.length - 1) {
      setCurrentColumnIndex(currentColumnIndex + 1);
    }
  }, [currentColumnIndex, allTaskStatuses.length]);

  const handlePrevColumn = useCallback(() => {
    if (currentColumnIndex > 0) {
      setCurrentColumnIndex(currentColumnIndex - 1);
    }
  }, [currentColumnIndex]);

  // Handle swipe gestures
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      
      const swipeThreshold = 50;
      const horizontalDiff = touchStartX - touchEndX;
      const verticalDiff = Math.abs(touchStartY - touchEndY);
      
      // Only trigger swipe if horizontal movement is greater than vertical
      if (Math.abs(horizontalDiff) > swipeThreshold && Math.abs(horizontalDiff) > verticalDiff) {
        if (horizontalDiff > 0) {
          // Swipe left - next column
          handleNextColumn();
        } else {
          // Swipe right - previous column
          handlePrevColumn();
        }
      }
    };

    const kanbanContainer = document.getElementById('mobile-kanban-container');
    if (kanbanContainer) {
      kanbanContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
      kanbanContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
      
      return () => {
        kanbanContainer.removeEventListener('touchstart', handleTouchStart);
        kanbanContainer.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [handleNextColumn, handlePrevColumn]);

  const currentStatus = allTaskStatuses[currentColumnIndex];
  const currentTasks = groupedTasks[currentStatus];

  return (
    <div className="relative w-full h-full" id="mobile-kanban-container">
      {/* Navigation header */}
      <div className="sticky top-0 z-10 bg-background border-b mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevColumn}
            disabled={currentColumnIndex === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-center gap-2">
            <h3 className="font-medium" style={{ color: statusBoardColors[currentStatus] }}>
              {statusLabels[currentStatus]}
            </h3>
            <div className="flex gap-1">
              {allTaskStatuses.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentColumnIndex(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    index === currentColumnIndex
                      ? "bg-primary scale-125"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Go to ${statusLabels[allTaskStatuses[index]]}`}
                />
              ))}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextColumn}
            disabled={currentColumnIndex === allTaskStatuses.length - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Single column view */}
      <div className="px-4 pb-4">
        <KanbanProvider onDragEnd={onDragEnd}>
          <KanbanBoard id={currentStatus}>
            <KanbanCards>
              {currentTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tasks in {statusLabels[currentStatus].toLowerCase()}</p>
                </div>
              ) : (
                currentTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    status={currentStatus}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onViewDetails={onViewTaskDetails}
                    isFocused={focusedTaskId === task.id}
                    tabIndex={focusedTaskId === task.id ? 0 : -1}
                  />
                ))
              )}
            </KanbanCards>
          </KanbanBoard>
        </KanbanProvider>
      </div>
    </div>
  );
}

export default memo(MobileTaskKanban);