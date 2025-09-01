import { useCallback, useState } from 'react';

// Minimal session state hook for Claude overlay
// Centralizes session id/active flags and exposes a reset helper.
export function useClaudeSessionState(initialId = null, initialActive = false) {
  const [claudeSessionId, setClaudeSessionId] = useState(initialId);
  const [claudeSessionActive, setClaudeSessionActive] = useState(initialActive);

  const resetClaudeSession = useCallback(() => {
    setClaudeSessionId(null);
    setClaudeSessionActive(false);
  }, []);

  return {
    claudeSessionId,
    setClaudeSessionId,
    claudeSessionActive,
    setClaudeSessionActive,
    resetClaudeSession,
  };
}

