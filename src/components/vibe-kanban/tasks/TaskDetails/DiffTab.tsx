import { DiffCard } from './DiffCard';
import { useContext } from 'react';
import { TaskDiffContext } from '../../context/taskDetailsContext.ts';
import { Loader } from '../../ui/loader';

function DiffTab() {
  const { diff, diffLoading, diffError } = useContext(TaskDiffContext);

  if (diffLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader message="Loading changes..." size={32} />
      </div>
    );
  }

  if (diffError) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>{diffError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
      <DiffCard diff={diff} deletable compact={false} className="flex-1 overflow-auto" />
    </div>
  );
}

export default DiffTab;
