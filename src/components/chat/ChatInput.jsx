import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Chat input component with attachment support and slash commands
 * Extracted from OverlayChatClaude to reduce complexity
 */
export function ChatInput({
  input,
  setInput,
  onSend,
  onSlashCommand,
  disabled = false,
  placeholder = "Type a message...",
  attachments = [],
  onAttachmentRemove,
  imageAttachments = [],
  onImageAttachmentRemove,
  showSlashMenu = false,
  slashCommands = [],
  selectedCommandIndex = 0,
  onSlashMenuSelect,
  trayInputRef,
  className = ""
}) {
  
  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (trayInputRef.current) {
      const textarea = trayInputRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 300);
      textarea.style.height = `${newHeight}px`;
    }
  }, [trayInputRef]);

  // Adjust height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Slash menu navigation
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (selectedCommandIndex + 1) % slashCommands.length;
        onSlashMenuSelect?.(nextIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = selectedCommandIndex === 0 ? slashCommands.length - 1 : selectedCommandIndex - 1;
        onSlashMenuSelect?.(prevIndex);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const command = slashCommands[selectedCommandIndex];
        if (command) {
          onSlashCommand?.(command.command);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSlashCommand?.(''); // Close menu
        return;
      }
    }

    // Send message on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey && !showSlashMenu) {
      e.preventDefault();
      if (input.trim() && onSend) {
        onSend();
      }
    }
  }, [showSlashMenu, selectedCommandIndex, slashCommands, onSlashMenuSelect, onSlashCommand, input, onSend]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInput(value);
    
    // Check for slash commands
    if (value.startsWith('/') && onSlashCommand) {
      const command = value.slice(1).toLowerCase();
      onSlashCommand(command);
    } else if (showSlashMenu && onSlashCommand) {
      // Close slash menu if input doesn't start with /
      onSlashCommand('');
    }
  }, [setInput, onSlashCommand, showSlashMenu]);

  // Remove attachment
  const handleRemoveAttachment = useCallback((index) => {
    if (onAttachmentRemove) {
      onAttachmentRemove(index);
    }
  }, [onAttachmentRemove]);

  // Remove image attachment
  const handleRemoveImageAttachment = useCallback((id) => {
    if (onImageAttachmentRemove) {
      onImageAttachmentRemove(id);
    }
  }, [onImageAttachmentRemove]);

  return (
    <div className={`relative ${className}`}>
      {/* Attachments display */}
      <AnimatePresence>
        {(attachments.length > 0 || imageAttachments.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 border-b border-border"
          >
            <div className="flex flex-wrap gap-2">
              {/* HTML Attachments */}
              {attachments.map((attachment, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-accent/20 text-accent-foreground rounded text-xs"
                >
                  <span className="capitalize">{attachment.tag}</span>
                  <button
                    onClick={() => handleRemoveAttachment(index)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    type="button"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
              
              {/* Image Attachments */}
              {imageAttachments.map((attachment) => (
                <motion.div
                  key={attachment.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs"
                >
                  <span>📷 {attachment.name}</span>
                  <button
                    onClick={() => handleRemoveImageAttachment(attachment.id)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    type="button"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slash commands menu */}
      <AnimatePresence>
        {showSlashMenu && slashCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 mb-1"
          >
            <div className="max-h-48 overflow-y-auto">
              {slashCommands.map((command, index) => (
                <button
                  key={command.command}
                  onClick={() => onSlashCommand?.(command.command)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                    index === selectedCommandIndex ? 'bg-accent' : ''
                  }`}
                  type="button"
                >
                  <div className="font-medium">{command.command}</div>
                  <div className="text-xs text-muted-foreground">{command.description}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-3">
        <div className="relative">
          <textarea
            ref={trayInputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-none bg-transparent border-none outline-none text-sm leading-5 placeholder-muted-foreground min-h-[40px] max-h-[300px] overflow-y-auto"
            rows={1}
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(156 163 175) transparent'
            }}
          />
          
          {/* Send button */}
          {input.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="absolute bottom-1 right-1 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
