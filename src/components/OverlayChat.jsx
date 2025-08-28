import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../utils/websocket';

// Overlay Chat com formatação bonita usando ReactMarkdown
// Usa NOSSO backend interno (porta 7347) - sem servidores externos!
export default function OverlayChat({ projectPath, previewUrl, embedded = false, disableInlinePanel = false, useSidebarWhenOpen = false, sidebarContainerRef = null, onBeforeOpen, onPanelClosed }) {
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
  const trayInputRef = useRef(null);
  const bottomRef = useRef(null);
  
  // Estado para controlar modo de comunicação
  const [useVibeBackend, setUseVibeBackend] = useState(false); // Use Node backend (WebSocket) by default
  
  // Usar o WebSocket INTERNO (porta 7347, /ws) - fallback if needed
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
      
      // Debug log to see what messages we're receiving
      console.log('[OverlayChat] Received WebSocket message:', lastMsg);
      
      // Handle different message types from our backend
      if (lastMsg.type === 'codex-response') {
        console.log('[OverlayChat] Processing codex-response:', lastMsg.text || lastMsg.data);
        setIsTyping(false);
        addMessage({ type: 'assistant', text: lastMsg.text || lastMsg.data });
      } else if (lastMsg.type === 'codex-output') {
        // Show all output from Codex, including JSON responses
        const output = lastMsg.data;
        console.log('[OverlayChat] Processing codex-output:', output);
        
        if (output && output.trim()) {
          // Parse JSON responses if they look like structured data
          try {
            const parsed = JSON.parse(output);
            console.log('[OverlayChat] Parsed JSON:', parsed);
            
            // If it's a message object with type and content/text
            if (parsed.type === 'agent_message' && parsed.message) {
              console.log('[OverlayChat] Adding agent_message:', parsed.message);
              setIsTyping(false);
              addMessage({ type: 'assistant', text: parsed.message });
            } else if (parsed.type === 'token_count' || parsed.type === 'task_started') {
              // Skip these system messages
              console.log('[OverlayChat] Skipping system message:', parsed.type);
            } else if (parsed.msg) {
              // Handle simple message format
              console.log('[OverlayChat] Adding simple message:', parsed.msg);
              setIsTyping(false);
              addMessage({ type: 'assistant', text: parsed.msg });
            } else {
              // For other JSON, only show if it's not purely technical
              if (!output.includes('sandbox') && !output.includes('reasoning')) {
                console.log('[OverlayChat] Adding other JSON output:', output);
                addMessage({ type: 'assistant', text: output });
              } else {
                console.log('[OverlayChat] Filtering technical output:', output);
              }
            }
          } catch (e) {
            // Not JSON, show as regular text if it's not technical output
            console.log('[OverlayChat] Not JSON, processing as text:', output);
            if (!output.includes('sandbox') && !output.includes('reasoning')) {
              addMessage({ type: 'assistant', text: output });
            } else {
              console.log('[OverlayChat] Filtering technical text:', output);
            }
          }
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
      if (onBeforeOpen) onBeforeOpen();
      setOpen(true);
    };
    window.pushToOverlayChat = fn;
    
    return () => {
      if (window.pushToOverlayChat === fn) {
        delete window.pushToOverlayChat;
      }
    };
  }, [addMessage]);

  // Docked mode: open via the bottom tray input or quick actions
  
  const getHost = () => {
    try {
      return previewUrl ? new URL(previewUrl).host : 'Current Page';
    } catch {
      return 'Current Page';
    }
  };

  // Resolve sidebar element when needed to support portal
  const [resolvedSidebarEl, setResolvedSidebarEl] = useState(null);
  useEffect(() => {
    if (useSidebarWhenOpen && open) {
      const tryResolve = () => {
        const el = sidebarContainerRef?.current || null;
        if (el) {
          setResolvedSidebarEl(el);
        } else {
          // Try again next frame until it mounts
          requestAnimationFrame(tryResolve);
        }
      };
      tryResolve();
    } else {
      setResolvedSidebarEl(null);
    }
  }, [useSidebarWhenOpen, open, sidebarContainerRef]);

  // Shared chat panel content (can render inline or into a portal)
  const renderPanelContent = () => (
    <div className="w-full max-h-[70vh] bg-background/95 backdrop-blur border border-border rounded-2xl flex flex-col overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/80">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Codex Assistant</div>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
        </div>
        <button
          onClick={() => { setOpen(false); onPanelClosed && onPanelClosed(); }}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto p-4 space-y-4 bg-background/60 max-h-[50vh]">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isUser = m.type === 'user';
            const isError = m.type === 'error';
            const isSystem = m.type === 'system';
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] px-4 py-3 rounded-2xl shadow-sm ${
                  isUser
                    ? 'bg-muted text-foreground ml-10'
                    : isError
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : isSystem
                    ? 'bg-muted text-muted-foreground text-sm italic'
                    : 'bg-card border border-border'
                }`}>
                  {/^(Updated Todo List|Lista de tarefas atualizada)/i.test(m.text || '') ? (
                    <div>
                      <div className="text-sm font-semibold mb-2">{(m.text.split('\n')[0] || '').trim()}</div>
                      <ul className="space-y-1 ml-1">
                        {m.text.split('\n').slice(1).filter(line => line.trim()).slice(0, 30).map((line, idx) => {
                          const checked = /(^|\s)(\[x\]|✔)/i.test(line);
                          const content = line.replace(/^[-*\d\.\)\s]+/, '');
                          return (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
                              <span>{content}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                      <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                    </div>
                  )}
                  {!isSystem && (
                    <div className={`mt-2 text-[11px] opacity-60 ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-border bg-card">
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
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask a follow-up..." className="flex-1 text-sm bg-background border border-border rounded-2xl px-3 py-2 min-h-[56px] max-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all" disabled={!isConnected} rows={2} style={{ height: 'auto', overflow: 'auto' }} />
          <button onClick={handleSend} className="w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center" disabled={!isConnected || (!input.trim() && attachments.length === 0)} title="Send">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {!isConnected && (
          <div className="mt-2 text-xs text-destructive">Disconnected from backend. Please sign in and ensure the server is running.</div>
        )}
      </div>
    </div>
  );

  // Send message to backend (either Vibe Kanban or Node.js)
  const handleSend = async () => {
    const message = input.trim();
    if (!message) return;
    
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
    
    if (useVibeBackend) {
      // Use Vibe Kanban REST API (Rust backend on port 6734)
      try {
        const response = await fetch('http://localhost:6734/api/codex/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: fullMessage,
            project_path: projectPath || process.cwd()
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsTyping(false);
          
          if (data.success && data.data) {
            addMessage({ type: 'assistant', text: data.data.response });
          } else {
            addMessage({ type: 'error', text: data.message || 'Failed to get response from Codex' });
          }
        } else {
          setIsTyping(false);
          const errorText = await response.text();
          console.error('Vibe Kanban API error:', errorText);
          addMessage({ type: 'error', text: `API Error: ${response.status} - ${errorText}` });
        }
      } catch (error) {
        setIsTyping(false);
        console.error('Failed to call Vibe Kanban API:', error);
        addMessage({ type: 'error', text: `Connection error: ${error.message}` });
      }
    } else {
      // Fallback to Node.js WebSocket (if needed)
      if (!isConnected) {
        setIsTyping(false);
        addMessage({ type: 'error', text: 'WebSocket not connected' });
        return;
      }
      
      const options = {
        projectPath: projectPath || process.cwd(),
        cwd: projectPath || process.cwd()
      };
      
      sendMessage({ type: 'codex-command', command: fullMessage, options });
    }
    
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
        const CodeWithCopy = ({ text }) => {
          const [copied, setCopied] = useState(false);
          const handleCopy = async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
          };
          return (
            <div className="relative group">
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleCopy} className="px-2 py-1 text-[11px] rounded-md bg-background/80 border border-border hover:bg-accent">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                customStyle={{ margin: '0.5rem 0', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                {...props}
              >
                {String(text).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          );
        };
        return <CodeWithCopy text={String(children)} />;
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
    },
    // Basic task list support: - [ ] / - [x]
    li({ children, ...props }) {
      const raw = String(children && children[0] ? (children[0].props ? children[0].props.children : children[0]) : '');
      const unchecked = raw.startsWith('[ ] ') || raw.startsWith('[  ] ');
      const checked = raw.startsWith('[x] ') || raw.startsWith('[X] ');
      if (unchecked || checked) {
        const label = raw.replace(/^\[[xX\s]\]\s+/, '');
        return (
          <li className="list-none my-1">
            <label className="inline-flex items-start gap-2">
              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
              <span>{label}</span>
            </label>
          </li>
        );
      }
      return <li {...props}>{children}</li>;
    }
  };

  // Docked panel positioning handled via absolute CSS classes

  if (embedded) {
    return (
      <div className="h-full w-full">
        {renderPanelContent()}
      </div>
    );
  }

  return (
    <>
      {/* Docked Chat Panel (expanded) */}
      {open && !disableInlinePanel && !useSidebarWhenOpen && (
        <div 
          className="absolute right-4 bottom-12 w-[min(360px,80vw)] z-50"
        >
          {renderPanelContent()}
        </div>
      )}
      {open && useSidebarWhenOpen && resolvedSidebarEl && (
        ReactDOM.createPortal(
          renderPanelContent(),
          resolvedSidebarEl
        )
      )}
      

      {/* Persistent Open Button */}
      <div className="absolute right-4 bottom-4 z-40">
        <button
          onClick={() => {
            if (onBeforeOpen) onBeforeOpen();
            setOpen(true);
          }}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-sm"
          title={`Ask about ${getHost()}`}
        >
          Ask about this page
        </button>
      </div>
    </>
  );
}
