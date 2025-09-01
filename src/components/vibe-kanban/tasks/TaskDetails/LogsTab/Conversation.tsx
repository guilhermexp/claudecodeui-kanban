import { NormalizedConversationViewer } from './NormalizedConversationViewer';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TaskAttemptDataContext } from '../../../context/taskDetailsContext.ts';
import { useTaskPlan } from '../../../context/TaskPlanContext.ts';
import { Loader } from '../../../ui/loader';
import { Button } from '../../../ui/button';
import { AlertTriangle } from 'lucide-react';
import Prompt from './Prompt';
import ConversationEntry from './ConversationEntry';
import { ConversationEntryDisplayType } from '../../../../../lib/vibe-kanban/types';

function Conversation() {
  const { attemptData, isAttemptRunning } = useContext(TaskAttemptDataContext);
  const { isPlanningMode, latestProcessHasNoPlan } = useTaskPlan();
  
  const [shouldAutoScrollLogs, setShouldAutoScrollLogs] = useState(true);
  const [conversationUpdateTrigger, setConversationUpdateTrigger] = useState(0);
  const [visibleCount, setVisibleCount] = useState(100);
  const [visibleRunningEntriesCount, setVisibleRunningEntriesCount] =
    useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Callback to trigger auto-scroll when conversation updates
  const handleConversationUpdate = useCallback(() => {
    setConversationUpdateTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (shouldAutoScrollLogs && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [attemptData?.allLogs, conversationUpdateTrigger, shouldAutoScrollLogs]);

  const handleLogsScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

      if (isAtBottom && !shouldAutoScrollLogs) {
        setShouldAutoScrollLogs(true);
      } else if (!isAtBottom && shouldAutoScrollLogs) {
        setShouldAutoScrollLogs(false);
      }
    }
  }, [shouldAutoScrollLogs]);

  // Find main and follow-up processes from allLogs
  const mainCodingAgentLog = useMemo(
    () =>
      attemptData?.allLogs?.find(
        (log) =>
          log.process_type.toLowerCase() === 'codingagent' &&
          log.command === 'executor'
      ),
    [attemptData?.allLogs]
  );
  const followUpLogs = useMemo(
    () =>
      attemptData?.allLogs?.filter(
        (log) =>
          log.process_type.toLowerCase() === 'codingagent' &&
          log.command === 'followup_executor'
      ) || [],
    [attemptData?.allLogs]
  );

  // Combine all logs in order (main first, then follow-ups)
  const allProcessLogs = useMemo(
    () =>
      [mainCodingAgentLog, ...followUpLogs].filter(Boolean) as Array<
        NonNullable<typeof mainCodingAgentLog>
      >,
    [mainCodingAgentLog, followUpLogs]
  );

  // Flatten all entries, keeping process info for each entry
  const allEntries = useMemo(() => {
    const entries: Array<ConversationEntryDisplayType> = [];
    allProcessLogs.forEach((log, processIndex) => {
      if (!log) return;
      if (log.status === 'running') return; // Skip static entries for running processes
      const processId = String(log.id); // Ensure string
      const processPrompt = log.normalized_conversation.prompt || undefined; // Ensure undefined, not null
      const entriesArr = log.normalized_conversation.entries || [];
      entriesArr.forEach((entry, entryIndex) => {
        entries.push({
          entry,
          processId,
          processPrompt,
          processStatus: log.status,
          processIsRunning: false, // Only completed processes here
          process: log,
          isFirstInProcess: entryIndex === 0,
          processIndex,
          entryIndex,
        });
      });
    });
    // Sort by timestamp (entries without timestamp go last)
    entries.sort((a, b) => {
      if (a.entry.timestamp && b.entry.timestamp) {
        return a.entry.timestamp.localeCompare(b.entry.timestamp);
      }
      if (a.entry.timestamp) return -1;
      if (b.entry.timestamp) return 1;
      return 0;
    });
    return entries;
  }, [allProcessLogs]);

  // Identify running processes (main + follow-ups)
  const runningProcessLogs = useMemo(
    () => allProcessLogs.filter((log) => log.status === 'running'),
    [allProcessLogs]
  );

  // Paginate: show only the last visibleCount entries
  const visibleEntries = useMemo(
    () => allEntries.slice(-(visibleCount - visibleRunningEntriesCount)),
    [allEntries, visibleCount, visibleRunningEntriesCount]
  );

  const renderedVisibleEntries = useMemo(
    () =>
      visibleEntries.map((entry, index) => (
        <ConversationEntry
          key={entry.entry.timestamp || index}
          idx={index}
          item={entry}
          handleConversationUpdate={handleConversationUpdate}
          visibleEntriesLength={visibleEntries.length}
          runningProcessDetails={attemptData?.runningProcessDetails || {}}
        />
      )),
    [
      visibleEntries,
      handleConversationUpdate,
      attemptData?.runningProcessDetails,
    ]
  );

  const renderedRunningProcessLogs = useMemo(() => {
    return runningProcessLogs.map((log, i) => {
      const runningProcess = attemptData?.runningProcessDetails?.[String(log.id)];
      if (!runningProcess) return null;
      // Show prompt only if this is the first entry in the process (i.e., no completed entries for this process)
      const showPrompt =
        log.normalized_conversation.prompt &&
        !allEntries.some((e) => e.processId === String(log.id));
      return (
        <div key={String(log.id)} className={i > 0 ? 'mt-8' : ''}>
          {showPrompt && (
            <Prompt prompt={log.normalized_conversation.prompt || ''} />
          )}
          <NormalizedConversationViewer
            executionProcess={runningProcess}
            onConversationUpdate={handleConversationUpdate}
            diffDeletable
            visibleEntriesNum={visibleCount}
            onDisplayEntriesChange={setVisibleRunningEntriesCount}
          />
        </div>
      );
    });
  }, [
    runningProcessLogs,
    attemptData?.runningProcessDetails,
    handleConversationUpdate,
    allEntries,
    visibleCount,
  ]);

  // Check if we should show the status banner - only if the most recent process failed/stopped
  const getMostRecentProcess = () => {
    if (followUpLogs.length > 0) {
      // Sort by creation time or use last in array as most recent
      return followUpLogs[followUpLogs.length - 1];
    }
    return mainCodingAgentLog;
  };

  const mostRecentProcess = getMostRecentProcess();
  const showStatusBanner =
    mostRecentProcess &&
    (mostRecentProcess.status === 'failed' ||
      mostRecentProcess.status === 'killed');

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleLogsScroll}
      className="flex-1 overflow-y-auto min-h-0 dark:bg-black"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Process status summary */}
      <ProcessStatusSummary allProcessLogs={allProcessLogs} />
      {visibleCount - visibleRunningEntriesCount < allEntries.length && (
        <div className="flex justify-center mb-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setVisibleCount((c) => c + 100)}
          >
            Load previous logs
          </Button>
        </div>
      )}
      {visibleEntries.length > 0 && (
        <div className="space-y-2">{renderedVisibleEntries}</div>
      )}
      {/* Render live viewers for running processes (after paginated list) */}
      {renderedRunningProcessLogs}
      {/* If nothing to show at all, show loader */}
      {visibleEntries.length === 0 && runningProcessLogs.length === 0 && (
        <Loader
          message={
            <>
              Coding Agent Starting
              <br />
              Initializing conversation...
            </>
          }
          size={48}
          className="py-8"
        />
      )}

      {/* Status banner for failed/stopped states - shown at bottom */}
      {showStatusBanner && mostRecentProcess && (
        <div className="mt-4 p-4 rounded-lg border">
          <p
            className={`text-lg font-semibold mb-2 ${
              mostRecentProcess.status === 'failed'
                ? 'text-destructive'
                : 'text-orange-600'
            }`}
          >
            {mostRecentProcess.status === 'failed'
              ? 'Coding Agent Failed'
              : 'Coding Agent Stopped'}
          </p>
          <p className="text-muted-foreground">
            {mostRecentProcess.status === 'failed'
              ? 'The coding agent encountered an error.'
              : 'The coding agent was stopped.'}
          </p>
        </div>
      )}

      {/* Warning banner for planning mode without plan */}
      {isPlanningMode && latestProcessHasNoPlan && !isAttemptRunning && (
        <div className="mt-4 p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <p className="text-lg font-semibold text-orange-800 dark:text-orange-300">
              No Plan Generated
            </p>
          </div>
          <p className="text-orange-700 dark:text-orange-400">
            The last execution attempt did not produce a plan. Task creation is
            disabled until a plan is available. Try providing more specific
            instructions or check the conversation for any errors.
          </p>
        </div>
      )}
    </div>
  );
}

export default Conversation;

// Compact status summary bar and chips for process statuses
function ProcessStatusSummary({
  allProcessLogs,
}: {
  allProcessLogs: Array<{
    status: string;
  }>;
}) {
  const counts = useMemo(() => {
    const acc: Record<string, number> = {
      running: 0,
      complete: 0,
      failed: 0,
      stopped: 0,
      other: 0,
    };
    (allProcessLogs || []).forEach((log) => {
      const s = String(log.status || '').toLowerCase();
      if (s === 'running') acc.running += 1;
      else if (s === 'complete') acc.complete += 1;
      else if (s === 'failed') acc.failed += 1;
      else if (s === 'killed' || s === 'stopped') acc.stopped += 1;
      else acc.other += 1;
    });
    return acc;
  }, [allProcessLogs]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const colorMap: Record<string, string> = {
    running: 'hsl(var(--info))',
    complete: 'hsl(var(--success))',
    failed: 'hsl(var(--destructive))',
    stopped: 'hsl(var(--warning))',
    other: 'hsl(var(--neutral))',
  };

  const labelMap: Record<string, string> = {
    running: 'Running',
    complete: 'Complete',
    failed: 'Failed',
    stopped: 'Stopped',
    other: 'Other',
  };

  const order = ['running', 'complete', 'failed', 'stopped', 'other'];

  return (
    <div className="px-2 sm:px-4 pt-2 pb-2">
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className="flex h-full w-full">
          {order.map((key) => {
            const count = counts[key] || 0;
            if (count === 0) return null;
            const width = `${Math.round((count / total) * 100)}%`;
            return (
              <div
                key={key}
                className="h-full"
                style={{ width, backgroundColor: colorMap[key] }}
                aria-label={`${labelMap[key]}: ${count}`}
                title={`${labelMap[key]}: ${count}`}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {order.map((key) => (
          <div
            key={key}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
            title={labelMap[key]}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colorMap[key] }}
            />
            <span className="font-medium">{labelMap[key]}</span>
            <span className="text-muted-foreground">{counts[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}