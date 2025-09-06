import { useRef, useCallback } from 'react';
import { createLogger } from '../../utils/logger';
import { normalizeAssistantEvent, normalizeResultEvent } from '../../utils/claude/normalize';

// Handles Claude-specific WS messages and updates UI state via callbacks.
// Usage:
//  const { processClaudeMessage } = useClaudeStreamHandler({ ...callbacks, flags });
//  if (cliProvider === 'claude' && processClaudeMessage(lastMsg)) return;

export function useClaudeStreamHandler({
  // session
  claudeSessionId,
  setClaudeSessionId,
  claudeSessionActive,
  setClaudeSessionActive,
  setIsSessionInitializing,
  // typing/activity
  setIsTyping,
  setTypingStatus,
  setActivityLock,
  // client session linking
  clientSessionId,
  setClientSessionId,
  // info callbacks
  onSessionIdChange,
  onSessionInfoChange,
  currentModel,
  setCurrentModel,
  // project/session utils
  projectPath,
  clearLastSession,
  // messaging
  addMessage,
  // misc
  getToolIcon,
  optionsRestartingRef,
}) {
  const processedMessagesRef = useRef(new Set());
  const lastToolLabelRef = useRef(null);
  const lastAssistantTextRef = useRef(null);
  const log = createLogger('ClaudeStream');

  const processClaudeMessage = useCallback((lastMsg) => {
    if (!lastMsg || !lastMsg.type) return false;

    // Deduplicate
    const msgKey = `${lastMsg.type}-${lastMsg.sessionId || ''}-${JSON.stringify(lastMsg)}`;
    if (processedMessagesRef.current.has(msgKey)) {
      return true; // already handled
    }
    // Only track keys we handle
    const handledTypes = new Set(['claude-session-started','session-not-found','claude-session-closed','claude-response','claude-output','claude-error','claude-complete','session-aborted']);
    if (!handledTypes.has(lastMsg.type)) return false;
    processedMessagesRef.current.add(msgKey);
    if (processedMessagesRef.current.size > 200) {
      const entries = Array.from(processedMessagesRef.current);
      processedMessagesRef.current = new Set(entries.slice(-100));
    }

    // Handlers
    if (lastMsg.type === 'claude-session-started') {
      // finalize init
      if (lastMsg.sessionId) {
        if (claudeSessionId === lastMsg.sessionId) return true;
        setClaudeSessionId(lastMsg.sessionId);
        setIsSessionInitializing(false);
        setClaudeSessionActive(true);
        if (clientSessionId) setClientSessionId(null);
        try { if (onSessionIdChange) onSessionIdChange(lastMsg.sessionId); } catch {}
        try { if (onSessionInfoChange) onSessionInfoChange({ sessionId: lastMsg.sessionId, model: currentModel }); } catch {}
      }
      setIsTyping(false);
      return true;
    }

    if (lastMsg.type === 'session-not-found') {
      setClaudeSessionId(null);
      setClaudeSessionActive(false);
      try { clearLastSession && projectPath && clearLastSession(projectPath); } catch {}
      addMessage?.({ type: 'system', text: 'Previous session expired. A new session will be created.' });
      setIsSessionInitializing(false);
      setIsTyping(false);
      return true;
    }

    if (lastMsg.type === 'claude-session-closed') {
      if (claudeSessionActive) {
        setClaudeSessionId(null);
        setClaudeSessionActive(false);
        if (clientSessionId) setClientSessionId(null);
        if (!optionsRestartingRef?.current) {
          addMessage?.({ type: 'system', text: 'Claude session closed' });
        }
        if (optionsRestartingRef) optionsRestartingRef.current = false;
      }
      setIsSessionInitializing(false);
      setIsTyping(false);
      return true;
    }

    if (lastMsg.type === 'claude-response' && lastMsg.data) {
      const data = lastMsg.data;
      // Track model
      try {
        if (data.message && data.message.model) {
          setCurrentModel && setCurrentModel(data.message.model);
          try { onSessionInfoChange && onSessionInfoChange({ sessionId: claudeSessionId || data.session_id, model: data.message.model }); } catch {}
        }
      } catch {}

      // Safety: if backend missed 'claude-session-started' but we see a session_id here, treat as started
      try {
        if (data.session_id && !claudeSessionActive) {
          setClaudeSessionId && setClaudeSessionId(data.session_id);
          setClaudeSessionActive && setClaudeSessionActive(true);
          setIsSessionInitializing && setIsSessionInitializing(false);
          try { onSessionIdChange && onSessionIdChange(data.session_id); } catch {}
        }
      } catch {}

      try {
        if (data.type === 'tool_use') {
          const name = data.tool_name || data.name || 'tool';
          const label = String(name);
          if (lastToolLabelRef.current !== label) {
            setIsTyping(true);
            setTypingStatus({ mode: 'tool', label });
            // Do not emit a separate "Tool" message; OverlayChat creates the compact card
            lastToolLabelRef.current = label;
          }
          return true;
        }
        if (data.type === 'assistant') {
          const text = normalizeAssistantEvent(data);
          const t = text && String(text).trim();
          if (t) {
            // Deduplicate identical assistant texts (often followed by a 'result' event)
            if (lastAssistantTextRef.current !== t) {
              addMessage?.({ type: 'assistant', text: t });
              lastAssistantTextRef.current = t;
            } else {
              log.debug('Skipped duplicate assistant text');
            }
          }
          setIsTyping(false);
          setTypingStatus({ mode: 'idle', label: '' });
          setActivityLock(false);
          lastToolLabelRef.current = null;
          return true;
        }
        if (data.type === 'completion' || data.type === 'result') {
          const finalText = normalizeResultEvent(data);
          if (finalText) {
            const ft = String(finalText).trim();
            // If result repeats the same content as the last assistant event, skip to avoid duplicates
            if (lastAssistantTextRef.current && lastAssistantTextRef.current === ft) {
              log.debug('Skipped duplicate result text');
            } else {
              addMessage?.({ type: 'assistant', text: ft });
            }
          }
          setIsTyping(false);
          setTypingStatus({ mode: 'idle', label: '' });
          setActivityLock(false);
          lastToolLabelRef.current = null;
          // Reset remembered assistant text after finalization
          lastAssistantTextRef.current = null;
          return true;
        }
      } catch (e) {
        log.warn('response handling error:', e);
      }
      return false; // allow outer code to handle remaining cases
    }

    if (lastMsg.type === 'claude-output') {
      const raw = (lastMsg.data || '').trim();
      if (!raw) return true;
      if (raw.toLowerCase() === 'done') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setActivityLock(false);
        lastToolLabelRef.current = null;
        return true;
      }
      addMessage?.({ type: 'assistant', text: raw });
      setIsTyping(false);
      setTypingStatus({ mode: 'idle', label: '' });
      setActivityLock(false);
      return true;
    }

    if (lastMsg.type === 'claude-error') {
      setIsTyping(false);
      setTypingStatus({ mode: 'idle', label: '' });
      setActivityLock(false);
      addMessage?.({ type: 'error', text: lastMsg.error });
      return true;
    }

    if (lastMsg.type === 'session-aborted') {
      setIsTyping(false);
      setTypingStatus({ mode: 'idle', label: '' });
      setActivityLock(false);
      addMessage?.({ type: 'system', text: 'Aborted current operation' });
      return true;
    }

    if (lastMsg.type === 'claude-complete') {
      setIsTyping(false);
      setTypingStatus({ mode: 'idle', label: '' });
      setActivityLock(false);
      return true;
    }

    return false;
  }, [
    claudeSessionId,
    claudeSessionActive,
    setClaudeSessionId,
    setClaudeSessionActive,
    setIsSessionInitializing,
    setIsTyping,
    setTypingStatus,
    setActivityLock,
    clientSessionId,
    setClientSessionId,
    onSessionIdChange,
    onSessionInfoChange,
    currentModel,
    setCurrentModel,
    projectPath,
    clearLastSession,
    addMessage,
    getToolIcon,
    optionsRestartingRef,
  ]);

  return { processClaudeMessage };
}
