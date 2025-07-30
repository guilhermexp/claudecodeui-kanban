import { memo, useState } from 'react';
import { Button } from '../../ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TaskDetailsToolbar from '../TaskDetailsToolbar';

function CollapsibleToolbar() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  return (
    <div className="border-b">
      <div className="px-3 sm:px-4 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Task Details
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsHeaderCollapsed((prev) => !prev)}
          className="h-6 w-6 p-0 hover:bg-muted/50 rounded transition-colors"
        >
          {isHeaderCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className={isHeaderCollapsed ? "hidden" : "px-3 sm:px-4 pb-2 animate-in slide-in-from-top-2 duration-200"}>
        <TaskDetailsToolbar />
      </div>
    </div>
  );
}

export default memo(CollapsibleToolbar);
