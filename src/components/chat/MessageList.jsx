import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Message list component with auto-scroll and message rendering
 * Extracted from OverlayChatClaude to improve maintainability
 */
export function MessageList({
  messages = [],
  isTyping = false,
  typingStatus = { mode: 'idle', label: '' },
  contextInfo = null,
  messagesScrollRef,
  className = ""
}) {
  const { theme } = useTheme();
  const bottomRef = useRef(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping]);

  // Message type icons
  const getMessageIcon = (type) => {
    switch (type) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return '⚙️';
      case 'error':
        return '❌';
      case 'tool_use':
        return '🔧';
      case 'tool_result':
        return '✅';
      default:
        return '💬';
    }
  };

  // Message type colors
  const getMessageColors = (type) => {
    switch (type) {
      case 'user':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'assistant':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'system':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'tool_use':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'tool_result':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-background border-border';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Render message content with markdown support
  const renderMessageContent = (message) => {
    if (!message.text) return null;

    // For code blocks, use syntax highlighting
    const isCodeBlock = message.text.includes('```');
    
    if (isCodeBlock) {
      return (
        <ReactMarkdown
          components={{
            code({node, inline, className, children, ...props}) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              
              return !inline && language ? (
                <SyntaxHighlighter
                  style={theme === 'dark' ? vscDarkPlus : oneLight}
                  language={language}
                  PreTag="div"
                  className="rounded-lg"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {message.text}
        </ReactMarkdown>
      );
    }

    // For simple text, render as plain text with basic formatting
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {message.text}
      </div>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg"
      >
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm text-muted-foreground">
          {typingStatus.label || 'AI is thinking...'}
        </span>
      </motion.div>
    );
  };

  // Render context info
  const renderContextInfo = () => {
    if (!contextInfo || !contextInfo.estimated_tokens) return null;

    const percentage = Math.round((contextInfo.estimated_tokens / contextInfo.max_context) * 100);
    const isHigh = percentage > 80;

    return (
      <div className={`text-xs p-2 rounded-lg border ${
        isHigh ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
               : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
      }`}>
        <div className="flex justify-between items-center">
          <span>Context: {contextInfo.estimated_tokens.toLocaleString()} / {contextInfo.max_context.toLocaleString()} tokens</span>
          <span className={isHigh ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}>
            {percentage}%
          </span>
        </div>
        {isHigh && (
          <div className="text-orange-600 dark:text-orange-400 mt-1">
            ⚠️ Context window usage is high. Consider starting a new session.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex-1 overflow-hidden ${className}`}>
      <div
        ref={messagesScrollRef}
        className="h-full overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      >
        {/* Context info at the top */}
        {contextInfo && renderContextInfo()}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-lg border ${getMessageColors(message.type)}`}
            >
              {/* Message header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getMessageIcon(message.type)}</span>
                <span className="font-medium text-sm capitalize">
                  {message.type === 'assistant' ? 'AI' : message.type}
                </span>
                {message.timestamp && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTimestamp(message.timestamp)}
                  </span>
                )}
              </div>

              {/* Message content */}
              <div className="ml-7">
                {renderMessageContent(message)}
              </div>

              {/* Message metadata */}
              {message.model && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Model: {message.model}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {renderTypingIndicator()}
        </AnimatePresence>

        {/* Empty state */}
        {messages.length === 0 && !isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center text-muted-foreground"
          >
            <div className="text-6xl mb-4">💭</div>
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm">
              Type a message below or use slash commands like <code>/help</code>
            </p>
          </motion.div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
