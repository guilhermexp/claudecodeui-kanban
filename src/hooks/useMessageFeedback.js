import { useCallback, useMemo, useState } from 'react'
import { createTemporaryMessage, processMessage, filterExpiredMessages, createLoadingMessage, replaceLoadingMessage, createStatusMessage, deduplicateMessages } from '../utils/message-feedback'

export function useMessageFeedback() {
  const [messages, setMessages] = useState([])

  const addMessage = useCallback((msg) => {
    const m = processMessage(msg)
    setMessages((prev) => deduplicateMessages([...prev, m]))
  }, [])

  const addTemporary = useCallback((text, type = 'system', timeout = null) => {
    const m = createTemporaryMessage(text, type, timeout)
    setMessages((prev) => [...prev, m])
    return m.id
  }, [])

  const startLoading = useCallback((operation) => {
    const m = createLoadingMessage(operation)
    setMessages((prev) => [...prev, m])
    return m.id
  }, [])

  const completeLoading = useCallback((loadingId, resultMessage) => {
    setMessages((prev) => replaceLoadingMessage(prev, loadingId, processMessage(resultMessage)))
  }, [])

  const updateStatus = useCallback((operation, progress = null) => {
    const m = createStatusMessage(operation, progress)
    setMessages((prev) => [...prev, m])
    return m.id
  }, [])

  const clearTemporary = useCallback(() => {
    setMessages((prev) => filterExpiredMessages(prev))
  }, [])

  const clearAll = useCallback(() => {
    setMessages([])
  }, [])

  const removeMessage = useCallback((id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const updateMessage = useCallback((id, updates) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }, [])

  const statusMessage = useMemo(() => messages.find((m) => m.type === 'status' && m.sticky) || null, [messages])

  return {
    messages,
    setMessages,
    addMessage,
    addTemporary,
    startLoading,
    completeLoading,
    updateStatus,
    clearTemporary,
    clearAll,
    removeMessage,
    updateMessage,
    statusMessage,
  }
}