import { AlertCircle, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { FileSearchTextarea } from '../ui/file-search-textarea';
import { useContext, useMemo, useState } from 'react';
import { attemptsApi } from '../../../lib/vibe-kanban/api';
import {
  TaskAttemptDataContext,
  TaskDetailsContext,
  TaskSelectedAttemptContext,
} from '../context/taskDetailsContext';
import { Loader } from '../ui/loader';

export function TaskFollowUpSection() {
  const { task, projectId } = useContext(TaskDetailsContext);
  const { selectedAttempt } = useContext(TaskSelectedAttemptContext);
  const { attemptData, fetchAttemptData, isAttemptRunning } = useContext(
    TaskAttemptDataContext
  );

  const [followUpMessage, setFollowUpMessage] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const canSendFollowUp = useMemo(() => {
    if (
      !selectedAttempt ||
      attemptData.processes.length === 0 ||
      isAttemptRunning ||
      isSendingFollowUp
    ) {
      return false;
    }

    const completedOrKilledCodingAgentProcesses = attemptData.processes.filter(
      (process) =>
        process.process_type === 'codingagent' &&
        (process.status === 'completed' || process.status === 'killed')
    );

    return completedOrKilledCodingAgentProcesses.length > 0;
  }, [
    selectedAttempt,
    attemptData.processes,
    isAttemptRunning,
    isSendingFollowUp,
  ]);

  const onSendFollowUp = async () => {
    if (!task || !selectedAttempt || !followUpMessage.trim()) return;

    try {
      setIsSendingFollowUp(true);
      setFollowUpError(null);
      await attemptsApi.followUp(
        projectId!,
        selectedAttempt.task_id,
        selectedAttempt.id,
        {
          prompt: followUpMessage.trim(),
        }
      );
      setFollowUpMessage('');
      fetchAttemptData(selectedAttempt.id, selectedAttempt.task_id);
    } catch (error: unknown) {
      // @ts-expect-error it is type ApiError
      setFollowUpError(`Failed to start follow-up execution: ${error.message}`);
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  return (
    selectedAttempt && (
      <div className="border-t p-3 sm:p-4 bg-background w-full flex-shrink-0 ios-bottom-safe">
        <div className="space-y-3 w-full">
          {followUpError && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm break-words">{followUpError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-start w-full">
            <FileSearchTextarea
              placeholder="Continue working on this task... Type @ to search files."
              value={followUpMessage}
              onChange={(value) => {
                setFollowUpMessage(value);
                if (followUpError) setFollowUpError(null);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (
                    canSendFollowUp &&
                    followUpMessage.trim() &&
                    !isSendingFollowUp
                  ) {
                    onSendFollowUp();
                  }
                }
              }}
              className="min-h-[40px] sm:min-h-[44px] resize-none"
              disabled={!canSendFollowUp}
              projectId={projectId}
              rows={1}
              maxRows={6}
            />
            <Button
              onClick={onSendFollowUp}
              disabled={
                !canSendFollowUp || !followUpMessage.trim() || isSendingFollowUp
              }
              size="sm"
              className="w-full sm:w-auto self-stretch sm:self-start gap-2 flex-shrink-0"
            >
              {isSendingFollowUp ? (
                <Loader size={16} />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="sm:hidden">Send Message</span>
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  );
}
