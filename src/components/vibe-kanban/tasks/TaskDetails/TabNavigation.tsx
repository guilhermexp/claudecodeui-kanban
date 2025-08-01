import {
  GitCompare,
  MessageSquare,
  Network,
  Cog,
  FileText,
} from 'lucide-react';
import { useContext } from 'react';
import {
  TaskAttemptDataContext,
  TaskDiffContext,
  TaskRelatedTasksContext,
} from '../../context/taskDetailsContext.ts';
import { useTaskPlan } from '../../context/TaskPlanContext.ts';

type Props = {
  activeTab: 'logs' | 'diffs' | 'related' | 'processes' | 'plan';
  setActiveTab: (
    tab: 'logs' | 'diffs' | 'related' | 'processes' | 'plan'
  ) => void;
};

function TabNavigation({ activeTab, setActiveTab }: Props) {
  const { diff } = useContext(TaskDiffContext);
  const { totalRelatedCount } = useContext(TaskRelatedTasksContext);
  const { attemptData } = useContext(TaskAttemptDataContext);
  const { isPlanningMode, planCount } = useTaskPlan();
  return (
    <div className="border-b bg-muted/30">
      <div className="flex px-2 sm:px-4 overflow-x-auto scrollbar-thin">
        <button
          onClick={() => {
            setActiveTab('logs');
          }}
          className={`flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Logs
        </button>
        {isPlanningMode && (
          <button
            onClick={() => {
              setActiveTab('plan');
            }}
            className={`flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'plan'
                ? 'border-primary text-primary bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Plans
            <span className="ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-primary/10 text-primary rounded-full">
              {planCount}
            </span>
          </button>
        )}
        <button
          onClick={() => {
            setActiveTab('diffs');
          }}
          className={`flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'diffs'
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <GitCompare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Diffs
          {diff?.files && diff.files.length > 0 && (
            <span className="ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-primary/10 text-primary rounded-full">
              {diff?.files?.length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('related');
          }}
          className={`flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'related'
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Network className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Related Tasks
          {totalRelatedCount > 0 && (
            <span className="ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-primary/10 text-primary rounded-full">
              {totalRelatedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('processes');
          }}
          className={`flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'processes'
              ? 'border-primary text-primary bg-background'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Cog className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Processes
          {attemptData?.processes && attemptData.processes.length > 0 && (
            <span className="ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs bg-primary/10 text-primary rounded-full">
              {attemptData?.processes?.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default TabNavigation;
