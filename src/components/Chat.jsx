import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { MicButton } from './MicButton';

function Chat({ selectedProject, selectedSession, onNavigateToSession }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [contextUsage, setContextUsage] = useState(0);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const token = localStorage.getItem('auth-token');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
      const wsUrl = `${protocol}//${host}:${port}/ws?token=${encodeURIComponent(token)}`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ Chat WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('❌ Chat WebSocket disconnected');
        setIsConnected(false);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'claude-response':
        if (data.data.type === 'message_start') {
          setIsStreaming(true);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            id: Date.now(),
            isStreaming: true
          }]);
        } else if (data.data.type === 'content_block_delta') {
          const delta = data.data.delta?.text || '';
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content += delta;
            }
            return newMessages;
          });
        } else if (data.data.type === 'message_stop') {
          setIsStreaming(false);
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.isStreaming = false;
            }
            return newMessages;
          });
        } else if (data.data.type === 'usage') {
          // Update context usage
          const usage = (data.data.input_tokens / 200000) * 100; // Assuming 200k context
          setContextUsage(Math.round(usage));
        }
        break;
      
      case 'claude-output':
        // Plain text output
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            lastMessage.content += data.data;
          } else {
            newMessages.push({
              role: 'assistant',
              content: data.data,
              id: Date.now(),
              isStreaming: false
            });
          }
          return newMessages;
        });
        break;

      case 'claude-error':
        setMessages(prev => [...prev, {
          role: 'error',
          content: data.error,
          id: Date.now()
        }]);
        setIsStreaming(false);
        break;

      case 'claude-complete':
        setIsStreaming(false);
        break;

      case 'session-created':
        if (onNavigateToSession) {
          onNavigateToSession(data.sessionId);
        }
        break;
    }
  };

  // Connect on mount
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connectWebSocket]);

  // Handle send message
  const handleSend = () => {
    if (!input.trim() || !isConnected || isStreaming || !selectedProject) return;

    const userMessage = {
      role: 'user',
      content: input,
      id: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);

    // Send to Claude via WebSocket
    ws.current.send(JSON.stringify({
      type: 'claude-command',
      command: input,
      options: {
        projectPath: selectedProject.name,
        sessionId: selectedSession?.id,
        cwd: selectedProject.name.replace(/-/g, '/')
      }
    }));

    setInput('');
    textareaRef.current.style.height = 'auto';
  };

  // Handle file attachment
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle microphone transcription
  const handleTranscription = (text) => {
    setInput(prev => prev + text);
    adjustTextareaHeight();
  };

  // Model options
  const models = [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: '⚡' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', icon: '🎯' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', icon: '🚀' }
  ];

  const currentModel = models.find(m => m.id === selectedModel);

  // Custom markdown components
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="relative group my-3">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            >
              Copy
            </button>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="px-1.5 py-0.5 bg-gray-800 text-blue-300 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <div className="overflow-x-auto">{children}</div>;
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {children}
        </a>
      );
    },
    ul({ children }) {
      return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
    },
    li({ children }) {
      return <li className="ml-4">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="text-2xl font-bold my-3">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-xl font-bold my-2">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-lg font-bold my-2">{children}</h3>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-gray-600 pl-4 italic my-2 text-gray-400">
          {children}
        </blockquote>
      );
    },
    // Custom checkbox rendering
    input({ type, checked, ...props }) {
      if (type === 'checkbox') {
        return (
          <span className="inline-flex items-center mr-2">
            {checked ? '✅' : '❌'}
          </span>
        );
      }
      return <input type={type} checked={checked} {...props} />;
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p className="text-sm">Choose a project to start chatting with Claude</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] text-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">
              {selectedSession ? `Session: ${selectedSession.summary.slice(0, 30)}...` : 'New Chat'}
            </span>
          </div>
          {isStreaming && (
            <span className="text-xs text-blue-400 animate-pulse">Claude is thinking...</span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Start a conversation with Claude</p>
            <p className="text-sm">Type your message below or paste an image</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'error'
                    ? 'bg-red-900/50 border border-red-700'
                    : 'bg-gray-800'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Terragon Style */}
      <div className="flex-shrink-0 border-t border-gray-800 p-4">
        <div className="bg-[#2a2a2a] rounded-lg">
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="px-3 pt-3 pb-2 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs">
                  <span>📎 {file.name}</span>
                  <button
                    onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                    className="ml-1 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="w-full p-3 bg-transparent resize-none text-gray-200 placeholder-gray-500 
                     focus:outline-none min-h-[60px] max-h-[200px]"
            disabled={!isConnected || isStreaming}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 
                           rounded-lg text-sm transition-colors"
                >
                  <span>{currentModel?.icon}</span>
                  <span>{currentModel?.name}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showModelDropdown && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800 rounded-lg 
                                shadow-lg border border-gray-700 overflow-hidden">
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setShowModelDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 
                                 flex items-center gap-2 transition-colors"
                      >
                        <span>{model.icon}</span>
                        <span>{model.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach File */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Attach files"
              >
                ➕
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Copy Last Message */}
              <button
                onClick={() => {
                  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                  if (lastAssistant) {
                    navigator.clipboard.writeText(lastAssistant.content);
                  }
                }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Copy last response"
              >
                📋
              </button>

              {/* Microphone */}
              <MicButton
                onTranscript={handleTranscription}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              />
            </div>

            {/* Context Usage */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {contextUsage}% context until auto-compact
              </span>
              
              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || !isConnected || isStreaming}
                className={`px-4 py-1.5 rounded-lg font-medium transition-colors ${
                  input.trim() && isConnected && !isStreaming
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;