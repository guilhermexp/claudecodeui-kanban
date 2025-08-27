import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../utils/websocket';

// Overlay Chat com formatação bonita usando ReactMarkdown
// Usa NOSSO backend interno (porta 7347) - sem servidores externos!
export default function OverlayChat({ projectPath }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { 
      type: 'assistant', 
      text: 'Hello! I\'m connected to **Codex** via your internal backend.\n\nI can help you:\n- Modify your code\n- Explain components\n- Fix bugs\n- Add new features\n\nHow can I help you today?',
      timestamp: new Date().toISOString(),
      id: 'welcome-msg'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [attachments, setAttachments] = useState([]); // chips like "div", "span" etc
  const [buttonPosition, setButtonPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);
  const bottomRef = useRef(null);
  
  // Usar o WebSocket INTERNO (porta 7347, /ws)
  const { ws, sendMessage, messages: wsMessages, isConnected } = useWebSocket(true);

  // Smart message merging logic inspired by Claudable
  const addMessage = useCallback((newMessage) => {
    setMessages(prev => {
      const timestamp = new Date().toISOString();
      const messageWithMeta = {
        ...newMessage,
        timestamp,
        id: `msg-${Date.now()}-${Math.random()}`
      };
      
      // Smart merging: combine messages from same role within 5 seconds
      if (prev.length > 0) {
        const lastMessage = prev[prev.length - 1];
        const timeDiff = new Date(timestamp).getTime() - new Date(lastMessage.timestamp).getTime();
        
        // Merge if same type, within 5 seconds, and not a tool message
        if (
          lastMessage.type === newMessage.type && 
          timeDiff < 5000 && 
          lastMessage.type === 'assistant' &&
          !lastMessage.text.includes('Using tool:')
        ) {
          // Merge content
          const mergedMessage = {
            ...lastMessage,
            text: lastMessage.text + '\n\n' + newMessage.text,
            timestamp,
            id: messageWithMeta.id
          };
          return [...prev.slice(0, -1), mergedMessage];
        }
      }
      
      return [...prev, messageWithMeta];
    });
  }, []);
  
  // Process messages from WebSocket with cleaner formatting
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      
      // Handle different message types from our backend
      if (lastMsg.type === 'codex-response') {
        setIsTyping(false);
        addMessage({ type: 'assistant', text: lastMsg.text || lastMsg.data });
      } else if (lastMsg.type === 'codex-output') {
        // Filter out technical CLI output unless it's important
        const output = lastMsg.data;
        if (!output.includes('sandbox') && !output.includes('reasoning') && !output.trim().startsWith('{')) {
          addMessage({ type: 'assistant', text: output });
        }
      } else if (lastMsg.type === 'codex-error') {
        setIsTyping(false);
        addMessage({ type: 'error', text: lastMsg.error });
      } else if (lastMsg.type === 'codex-tool') {
        // Only show tool notifications for important tools
        const toolData = lastMsg.data;
        if (toolData && toolData.name && !['reasoning', 'thinking'].includes(toolData.name.toLowerCase())) {
          addMessage({ 
            type: 'system', 
            text: `🔧 ${toolData.name}` 
          });
        }
      } else if (lastMsg.type === 'codex-start' || lastMsg.type === 'task_started') {
        setIsTyping(true);
      } else if (lastMsg.type === 'codex-complete') {
        setIsTyping(false);
      }
    }
  }, [wsMessages, addMessage]);

  // Expose global function for element selection
  useEffect(() => {
    const fn = (html, elementData) => {
      if (!html) return;
      const tag = (elementData?.tag || 'div').toLowerCase();
      // Add as an attachment chip (do NOT send yet)
      setAttachments(prev => [...prev, { type: 'html', tag, html }]);
      setSelectedElement(elementData || null);
      setOpen(true);
    };
    window.pushToOverlayChat = fn;
    
    return () => {
      if (window.pushToOverlayChat === fn) {
        delete window.pushToOverlayChat;
      }
    };
  }, [addMessage]);

  // Improved dragging functionality
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = buttonRef.current.getBoundingClientRect();
    
    // Calculate offset from click point to button position
    const currentX = buttonPosition.x !== null ? buttonPosition.x : rect.left;
    const currentY = buttonPosition.y !== null ? buttonPosition.y : rect.top;
    
    const offsetX = e.clientX - currentX;
    const offsetY = e.clientY - currentY;
    
    let hasMoved = false;
    
    const handleMouseMove = (e) => {
      hasMoved = true;
      setIsDragging(true);
      
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      
      // Keep button within viewport
      const maxX = window.innerWidth - 50;
      const maxY = window.innerHeight - 50;
      
      setButtonPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Only open/close if we didn't drag
      if (!hasMoved) {
        setOpen(!open);
      }
      
      setTimeout(() => setIsDragging(false), 10);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Send message to our backend
  const handleSend = () => {
    const message = input.trim();
    if (!message || !isConnected) return;
    
    // Display user message with timestamp
    addMessage({ type: 'user', text: message });
    
    // Build final content: attachments as code blocks + user text
    let prefix = '';
    if (attachments.length > 0) {
      const blocks = attachments.map((att, idx) => `Selected ${att.tag} (${idx + 1}):\n\n\u0060\u0060\u0060html\n${att.html}\n\u0060\u0060\u0060`).join('\n\n');
      prefix = blocks + '\n\n';
    }
    const fullMessage = prefix + message;
    
    // Show typing indicator
    setIsTyping(true);
    
    // Send to OUR backend using codex-command
    const options = {
      projectPath: projectPath || process.cwd(),
      cwd: projectPath || process.cwd()
    };
    
    sendMessage({ type: 'codex-command', command: fullMessage, options });
    setAttachments([]);
    setInput('');
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Custom components for ReactMarkdown
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            customStyle={{
              margin: '0.5rem 0',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }
      
      return (
        <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono" {...props}>
          {children}
        </code>
      );
    },
    a({ children, href, ...props }) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc list-inside ml-4 my-2" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal list-inside ml-4 my-2" {...props}>
          {children}
        </ol>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground" {...props}>
          {children}
        </blockquote>
      );
    },
    h1({ children, ...props }) {
      return <h1 className="text-xl font-bold mt-3 mb-2" {...props}>{children}</h1>;
    },
    h2({ children, ...props }) {
      return <h2 className="text-lg font-semibold mt-2 mb-1" {...props}>{children}</h2>;
    },
    h3({ children, ...props }) {
      return <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>;
    },
    p({ children, ...props }) {
      return <p className="my-2" {...props}>{children}</p>;
    }
  };

  // Calculate button position style
  const buttonStyle = buttonPosition.x !== null ? {
    position: 'fixed',
    left: `${buttonPosition.x}px`,
    top: `${buttonPosition.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  } : {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    cursor: 'grab',
    userSelect: 'none',
  };

  // Calculate panel position based on button position
  const getPanelPosition = () => {
    if (buttonPosition.x === null) {
      return { bottom: '80px', right: '20px' };
    }
    
    const panelWidth = 450;
    const panelHeight = 600;
    
    // Check if panel fits on the right
    if (buttonPosition.x + 60 + panelWidth <= window.innerWidth) {
      return { 
        top: `${Math.min(buttonPosition.y, window.innerHeight - panelHeight - 20)}px`,
        left: `${buttonPosition.x + 60}px` 
      };
    } 
    // Otherwise show on the left
    else {
      return { 
        top: `${Math.min(buttonPosition.y, window.innerHeight - panelHeight - 20)}px`,
        right: `${window.innerWidth - buttonPosition.x + 20}px` 
      };
    }
  };

  return (
    <>
      {/* Draggable floating button with system colors */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        className={`z-[999999] w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-200 ${
          isDragging ? '' : 'hover:scale-105'
        } ${
          open 
            ? 'bg-accent text-accent-foreground shadow-lg' 
            : 'bg-card border border-border text-foreground shadow-md hover:bg-accent/10'
        }`}
        style={buttonStyle}
        title="Codex AI Chat (drag to move, click to toggle)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l.8-4A8.94 8.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Chat Panel with system colors */}
      {open && (
        <div 
          className="fixed z-[999998] w-[450px] max-w-[90vw] h-[600px] bg-background border border-border rounded-xl flex flex-col overflow-hidden shadow-xl"
          style={getPanelPosition()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Codex Assistant</div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-destructive'}`} />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Messages area with animations */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isUser = m.type === 'user';
                const isError = m.type === 'error';
                const isSystem = m.type === 'system';
                
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        isUser
                          ? 'bg-primary text-primary-foreground ml-12'
                          : isError
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : isSystem
                          ? 'bg-muted text-muted-foreground text-sm italic'
                          : 'bg-card border border-border'
                      }`}
                    >
                      {isError && (
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-sm">Error</span>
                        </div>
                      )}
                      
                      {/* Message content with ReactMarkdown */}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown components={markdownComponents}>
                          {m.text}
                        </ReactMarkdown>
                      </div>
                      
                      {/* Timestamp */}
                      {!isSystem && (
                        <div className="mt-2 text-xs opacity-50">
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" 
                         style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" 
                         style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" 
                         style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={bottomRef} />
          </div>
          
          {/* Input area */}
          <div className="p-4 border-t border-border bg-card">
            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <span key={idx} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#101826] border border-border text-xs">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l7 4-7 4-7-4 7-4z" />
                      </svg>
                      <span className="text-blue-300 font-medium">{att.tag}</span>
                    </span>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => setAttachments(a => a.filter((_, i) => i !== idx))} title="Remove">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                className="flex-1 text-sm bg-background border border-border rounded-2xl px-3 py-2 min-h-[56px] max-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                disabled={!isConnected}
                rows={2}
                style={{ height: 'auto', overflow: 'auto' }}
              />
              <button
                onClick={handleSend}
                className="w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                disabled={!isConnected || (!input.trim() && attachments.length === 0)}
                title="Send"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {!isConnected && (
              <div className="mt-2 text-xs text-destructive">
                Disconnected from backend. Check if server is running on port 7347.
              </div>
            )}
            {selectedElement && (
              <div className="mt-2 text-xs text-muted-foreground">
                Element context will be included in next message
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
